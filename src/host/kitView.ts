// THE KIT VIEW (`?kitview`): this page as a PICTURE of the team as picked, stood at the mission's own way-in door — the start page's Team & kit step shows it
// in an iframe where the standing man was (src/ui/kitView.ts; the maintainer's pick, 10-13). The Game behind the start page is not the picked mission's level,
// and a mission's level and team exist only after Deploy's page load; so the picture is drawn by a SECOND instance of the page, opened on the very query
// Deploy would load plus `&kitview&mute&noreplay`, and thrown away. Nothing staged here can reach a run.
//
// IN THIS MODE: no title, start page, pause card, HUD or cursor (index.html body.kitview hides all but the canvas), no sound, no key or mouse, and NOT ONE
// WRITE to the origin's storage, which this instance shares with the real page (the guard below: this window's Storage writes do nothing, it has no IndexedDB and asks for no
// persistence). After the scenario
// from the URL has staged its team (main.ts scenarioFromUrl): the fog of war off, everybody who is not the team parked far off and dark (as `__stage` parks),
// the team put on slots by the door, turned and held, the lamps hung, ONE zero-length game step to pose them (as main.ts refreshFrozenStill does), the camera
// pinned — and from then on, by the mode:
//   THE LOOP (the page's own; the owner after seeing the held picture on a GPU, 10-14: "it stutters … really it should be looping some animation showing off
//   the currently selected gear"): the world RUNS — stepped and drawn at an even pace (kitViewPacer below), the rain falling, the bodies idling — and a
//   small director plays BEATS in it (below), for as long as the parent says the step is showing (`pause`: nothing stepped or drawn until it shows again).
//   STILL (`&stillkit` on the query — the parent's KIT_VIEW.acts off): the world frozen (`loop.frozen`), the picture drawn for a warm window
//   (KIT_VIEW_STAGE.warm frames: the denoisers' histories) and then HELD: the frame loop stops stepping and drawing until asked again (a restage, a resize,
//   a frame message). No beat, no dissolve: every kit message a plain restage.
//
// WHERE: level data, `scenarios.kitView.ways[way]` (scene/scenarios.ts KitViewWay; `way` = RoomClearScenario.way — 0 the level's own start, k its starts[k − 1]).
// Only the door is needed: stack slots along the wall on the team's side, KIT_VIEW_STAGE.off m off the wall line and KIT_VIEW_STAGE.gap m apart from KIT_VIEW_STAGE.jamb m past
// the jamb away from the hinge — the men as staged, side on to the wall and facing the door; Sam across the door, further off the
// wall and turned onto it; a fourth teammate behind him. A slot that is not free floor (the nav grid) is stepped over. The camera looks into the wall, turned
// KIT_VIEW_STAGE.yaw toward the stack, at the game's own pitch, from a distance that grows with the stack. Authored `slots` / `pin` / `light` lie over all of that.
//
// THE PARENT TALKS BY postMessage (same origin, and only the window that holds this frame): `{ kv: 'kit', members, squad }` = the cards into the kit table
// through the store's own reader (main.ts hands kitLoad over a store that is the message: nothing saved) and the squad's size on the knob — then, STILL: the
// encounter restarted (the scenario's own staging and kitStage run again) and all of the above again; THE LOOP: this page works out what moved and writes
// it LIVE where the game can take it (the kit handler below), and what it cannot is a restage under the DISSOLVE · `{ kv: 'sel', who, field }` = whose card
// is open (0 = Sam) and the tile under its highlight: the director's man, and the thing he uses — NOW · `{ kv: 'pause', on }` = the step is not showing ·
// `{ kv: 'frame', cx, cy, h, w? }` = where the men should sit in the
// view (NDC centre, y up; h = their share of its height, w = the most of its width they may take, man = a standing man's height at most): the camera has no lens shift, so the look point slides along the camera's right and the ground's
// forward and the distance is scaled. With `door, left, right, keep` on it (NDC x) the picture is hung on the DOOR instead of the men's middle: the door's
// line (its middle, a metre up) at `door`, the five places' reach no further left than `left` nor right than `right` — the men made smaller for it, but no
// smaller than `keep` of the size the fit on their middle gives them: past that the places are held at `left` and the door sits right of `door` (the room behind
// the door is then part of the clear picture: a can thrown through it is seen). This page says `{ kv: 'ready' }` once the first picture has KIT_VIEW_STAGE.ready frames in it, `{ kv: 'held' }` whenever a
// still picture has settled, `{ kv: 'boot' }` once at start (its listener is up: the parent answers with the frame, the kit, the open card), `{ kv: 'none' }` when there is nothing to
// stage (the room clear did not start, no block or door for this way, a team the game did not make the size a kit message asked, a throw while staging or in the restart before it) —
// and when this page put up its fatal card (main.ts fatalOnce): the parent drops the frame whenever it hears it,
// shown or not. It never says `dip` (the fade to black is gone, the owner 10-14: the dissolve is this page's own, under the parent's eye). `window.__kitview` = the state, for checks.
//
// THE LOOP'S BEATS (the owner's pick, 10-13: "the door, and it acts"; 10-14: looping, and what is carried; 10-14 again, after playing it: "after selecting
// something, it should start the demo animation immediately … too many beats before something happens", "kind of jerky", "i don't like the fade to black
// animations. switching between squad members should have them swap places in the stack"). ONE man acts: the man whose card is open (`who`). He LIVES on
// the head slot by the jamb (a teammate's card opened: the same men walk — `rotate`), so a throw is a half step. A PICK — the highlight on another tile, a
// value changed on the open card, another card — CUTS whatever is running (`cut`) and that tile's thing begins the same frame, from the pose and place he
// is in: no rest in front of it, never by way of his slot. The loop then HOLDS on the highlighted tile (BEATS: its row's own rest between repeats); no
// tile with a row under the highlight: the gun, then the light. A tile's thing plays at a count of 0 too. QUIET rows — the gun (up onto the door, a scan,
// down: no round fired), the weapon light (on at his feet, the leaf pushed, the beam slices the opening, off), suit and trim (an eased quarter turn and
// back), a gun changed (the holster move, then the gun's row); a can THROUGH the door — smoke, Sam's stun (a half step and his hand on the leaf together,
// the can to a spot just inside, the leaf pulled to behind it); LOUD ones by the squad's own door orders, cut before anybody goes in — a stun canister, a
// frag, a door charge (set, stood off, blown). THE REST OF THE KIT (10-15, the owner's first note: "we should have animations for all the pieces of gear") — Sam's
// OPTICAL WAND (on his knee at the shut door, the lens fed under it and turned: the game's own row, the fog of war the game's for its length and lifted for
// every draw), a STICKY CAMERA (the leaf held, one shot of the launcher onto the nearest wall inside), the 40 MM (shouldered down the wall away from the
// stack and NOT fired: through this door it is a dud), the WALL CHARGE (the squad's own order to the whole team: set on the stack's wall, walked off, blown,
// the hole held, then a restage that stands the wall and the men again); and IDLE LIFE: the men a row is not about let their guns wander a few degrees
// (the hammer and the breaching shotgun of the big slot open the picture's shut door from beside the frame — the tool in his hands for the blow). SAM'S OWN door charge (the game's own row at the door, by his own key — the stack steps a slot back while his
// hands are on it, he steps off the door's line and blows it) and his own FRAG (through the door, the leaf pulled to a hand ajar behind it, everybody
// down on a knee through the fuse; the teammates cannot be hurt in this page: Guard.god). What a row leaves that has no undo (a blown door, a frag's marks) is HELD as a resting picture and mended
// under the dissolve when the next row starts or KIT_VIEW_LOOP.hold ends. Every action is the GAME's: the squad's orders to a teammate, `Game.puppet` and
// Sam's own keys for Sam (set for the length of his beat alone: while it is set the orders clear themselves). NO POSE SNAPS: every man's body and aim yaw
// comes round under a rate (THE YAWS below). The men a beat is not about stand as staged; the defenders are parked and calmed again every frame (the AI is on: the
// room fight is live, so the goggles are drawn, the teammates' pace is capped and a stun spares its own side); a transient light is no brighter than
// KIT_VIEW_LOOP.flashMax and the picture is never whited (Player.hitFlash put out before the draw). Still no sound and no HUD, no verdict books and no par
// filed (main.ts step), no autosave, no replay buffer. A throw in the game's own step is `none` (the frame loop's fatal card).
// Host side: the game is a TYPE here (src/game is one import cycle); orders go through the Game.
import type { Game, Guard, LightTarget } from '../game/game';
import type { Door } from '../game/doors';
import type { OrderTarget } from '../game/orders';
import type { Input } from '../game/input';
import type { FollowCamera } from '../game/camera';
import type { Engine } from '../engine';
import type { LoopCtx } from './loop';
import type { RtLight } from '../render/lights';
import type { KitViewLamp, KitViewLight, KitViewWay } from '../scene/scenarios';
import type { Box } from '../scene/boxes';
import { BoxFlag } from '../scene/boxes';
import type { Vec3 } from '../math/vec';
import type { KitPlanLevel, KitViewPlanned } from './kitViewPlan';
import { kitViewQuietKind } from './kitViewSet';   // (pure: the mission's kind, read off its link)
import { kitViewPlanChild, kitPlanGeometry, kitPlanWayBuilt, kitPlanAct4, kitPlanPorchLit, kitPlanOwnLamps, kitPlanDayOut, KIT_PLAN } from './kitViewPlan';   // (pure: plain level data in, a plan out — no game module, no DOM)
import { OWNCHARGE } from '../game/owncharge';   // (a leaf: read inside a row's start only)
import { samBigSpot } from '../game/bigkit';   // (asked inside a row's start only: where the game stands Sam for the big slot's tool)
import { BIG_ORDER } from '../game/doortools';   // (a name, read inside a row only)
import { FIXLOOK } from '../game/fixtureBreak';   // (a leaf table: written inside the quiet gun's row only — the dead lamp's arcing lead is held off for that row)
import { WAND_ORDER, WANDORDER_STATS } from '../game/wandorder';   // (a name and a tally, read inside a row only)
import { kitOf, kitTreeOn } from '../game/kit';   // (asked inside a row's start only: the card a staged teammate carries · is the card laid out as a tree — your light a row of yours)
import { exposedTo } from '../game/frag';   // (asked inside a row's tick only: has a burst THERE a line to Sam — the game's own reckoning, glass that it would break counted open)

/** THE LIGHT, one table (a way's `light` in the level file lies over it, key by key). Every place is door-relative — [along the wall toward the stack, out
 *  from the wall's line on the team's side, up] from the door's middle — so it stands on any door. The maintainer asked for it "a bit more diffuse (rather
 *  than a spotlight on the door)": a PORCH lamp over the door is the key (a small area disk facing down and tipped out, with a glowing box on the wall for a
 *  source), a wide cool FILL out in the yard lifts the men's backs off the ground, the building's own lights are out, the moon and the sky are raised a
 *  little, and Sam's weapon light stays on — dim, tight, at the foot of the door — as the mark of the picked man. The numbers are a lighting study's
 *  (2026-10-13, records_west on the software adapter: never judged on a GPU). */
export const KIT_VIEW_LIGHT: KitViewLight = {
  porch: { kind: 3, offset: [0, 0.67, 2.4], aim: [0, 2.35, 0],   // 0.55 m off the face of a 12 cm half-wall, the disk's normal down and about 35° out
    color: [1, 0.76, 0.5], intensity: 15, range: 14, innerDeg: 0, outerDeg: 90, radius: 0.28, volumetric: 0, broad: true,
    fixture: { at: [0, 0.17, 2.27], half: [0.17, 0.045, 0.05], glow: 5 } },
  fill: { kind: 3, offset: [0, 6.62, 2.0], aim: [0.6, 0.8, 0.9],   // 6.5 m out from the face, turned on the stack and a little down; intensity 0 = no fill
    color: [0.85, 0.9, 1], intensity: 2.5, range: 24, innerDeg: 0, outerDeg: 90, radius: 1.5, volumetric: 0, broad: true },
  roomLights: 0,
  moonScale: 1.65, skyScale: 1.6,
  sam: { on: true, intensity: 9, innerDeg: 8, outerDeg: 24, volumetric: 0.25, aim: [0, 0, 0] },
};
/** the view's own numbers */
export const KIT_VIEW_STAGE = {
  /** frames drawn after each staging / resize before the picture is held · frames into the first picture at which the parent is told it may show it */
  warm: 90, ready: 12,
  /** a wall man's distance from the wall LINE (0.7 m off a 12 cm half-wall's face) · between men (the owner's recording, 10-14: at 0.9 the two upper men overlap in the image), and what a level's
   *  AUTHORED slots were laid out at: the stack's are spread from its head by gap / authored, in this picture only (the file is not touched) · the first man past the jamb · Sam's distance from the line · his turn onto the door */
  off: 0.82, gap: 1.1, authored: 0.9, jamb: 0.45, samOff: 1.2, samTurnDeg: 35,
  /** …and Sam no nearer the door's middle than this (he is put further off the wall for it): a door charge dazzles whoever is within 1.6 m of the frame on its
   *  own side (doortools.ts backblastM), and the charge's moment goes off beside him */
  samClear: 1.8,
  /** the camera: turned this far (rad) from square-on to the wall toward the stack · the game's pitch · metres back, and per metre of the five places' length along the wall */
  yaw: 1.206, pitch: 0.96, dist: 8.8, distPerM: 0.85,   // (yaw: the wall and the file of men run UP the column — about 65° from level on the screen at this pitch; the wall's face is still seen, a door about 35 px wide)
  /** a man's reach about his own middle (m): what the frame's fit keeps inside the window with him — shoulders, the gun */
  body: 0.45,
  /** …and across the picture (a frame hung on the door): the file runs up the column and a wall man's gun lies along it, so sideways he is his shoulders
   *  and pack (about 35 px either side of his middle on a 124 px man, measured on the page 10-14) */
  reach: 0.33,
};
/** the loop's own numbers (the beats themselves — who, the action, what ends it — are BEATS in kitViewStart: they are calls on the Game). The feel
 *  numbers are the design calls of 10-14 after the owner played it; none has been seen in motion */
export const KIT_VIEW_LOOP = {
  /** seconds between repeats of the highlighted tile's row: a quiet one · a can (smoke, a stun) · the gun and the light with no tile under the highlight ·
   *  after a staging · what a damaging row left (a blown door, a frag's room) is looked at this long from its mark before the dissolve mends it */
  restQuiet: 1.5, restCan: 4, restNone: 3, restStage: 0.8, hold: 6,
  /** THE AIM, deg and deg/s: the gun never turns faster than · the body · a sweep's rate · seconds an ease takes at least, up to 45° and above (longer
   *  where the rate needs it: 45° at 150°/s is 0.56 s of minimum-jerk) · seconds a free channel takes to reach its rate · under this much off his rest
   *  direction the chest alone turns, his feet still · no quiet row asks more than this off it */
  gunRate: 150, bodyRate: 100, sweepRate: 30, ease: [0.45, 0.65], ramp: 0.15, torso: 35, maxOff: 60,
  /** the gun: its scan to each side of the door's middle (deg), seconds held at the end of it, the row's cap less 6 */
  gunScan: 8, gunHold: 0.3, gunSecs: 3,
  /** THE GUN FIRES (the owner, 10-15: "guns when selected should do something! like shooting through window"): a pane on the door's own wall within … m of
   *  the door's middle · the posts tried in front of it: … m out from the wall, at these steps along it from the pane's middle (his own place first) · the line
   *  no flatter to the glass than this (the cosine off its normal) · a post no nearer another man's place than … m · no man within … deg of the line · rounds
   *  [a long gun, a pistol, a shotgun] and seconds between two · seconds the gun stays up after the last */
  paneReach: 6, paneOut: 1.6, paneOff: [1, -1, 1.8, -1.8], fireSlant: 0.5, fireOff: 0.8, fireClear: 25, fireN: [3, 2, 1], fireGap: [0.11, 0.24, 0.3], fireHold: 0.7,
  /** the light: his half step (m) · seconds held at the near end of the slice · the leaf pushed to (rad) · the beam starts this far down (deg: on the
   *  ground at his feet) and rises over … s once his aim is `wallMin` deg off the wall's line — the beam is never up nearer the wall's line than that · the
   *  slice ends no straighter in than … deg · the opening is taken a hand in from each jamb, and this much more on the hinge's (the pushed leaf) · its
   *  intensity for the beat (a teammate's is the game's 70 otherwise, Sam's the staging's dim mark) */
  lightStep: 0.4, lightHold: 0.4, wideLight: 1.3, feetDeg: 65, riseSecs: 0.85, wallMin: 25, sliceMax: 60, jambIn: 0.12, leafIn: 0.25, beam: 30,
  /** suit and trim: the turn (deg), seconds held, seconds each way at least (the body's rate makes a quarter turn 1.7 s) */
  turnDeg: 90, turnSecs: 0.6, turnEase: 0.65,
  /** a throw through the door — he steps `half` m at most from where he lives toward the old post in front of it: [along the wall toward the LATCH, out
   *  from its line: clear of a leaf that opens his way] · the spots inside: this far in from the door's line, each stepped along it toward the latch (the
   *  first that is free floor; a teammate's the first the order's own test passes) · the leaf is HELD open by his hand for the beat (Doors.crack: one push
   *  is taken back by the closer, and a leaf that opens toward him is a pull): rad/s, to this angle · seconds it is given at least, at most · Sam clicks
   *  his can away once it has had this long to reach the fist */
  post: [0.15, 1.3], half: 0.5, inM: [2.0, 1.6, 2.4], inAlong: [0, 0.3, -0.3], swing: 3, wide: 0.9, wideSam: 1.3, openSecs: [0.3, 2.5], fistSecs: 0.5,
  /** CANS are thrown SHORT, so that they come to rest just inside the door, in the part of the room the page shows clear (a can runs on along the
   *  floor: Sam's aimed 2.0 m in lay 4.46 m in). A teammate's smoke spots (asked of the order before `inM`'s) · Sam's aim for his smoke and for his stun, in from the door's middle */
  smokeM: [0.6, 0.5, 0.8], samSmokeM: 0.2, samStunM: 0.24,
  /** seconds from the bang / the can venting to the row's end · a can's vent is shut off this long after it began · a smoke CUT short vents nothing for this long (its fuse may still be running) */
  afterStun: 0.8, afterSmoke: 2.5, ventSecs: 5, ventKill: 6,
  /** SAM'S OWN CHARGE: where he sets it from (as `post`: inside his reach
   *  of the leaf, 1.35 m) · his row at the door is asked for this long at most (the game's own, by his own key). THE BIG SLOT'S TOOL in his hands: he is walked no further than … m from the middle of the frame (the door's row is offered inside 1.35 m, and a walk ends within `wayM` of its mark). SAM'S OWN FRAG: aimed this far in from the door's middle (it lies 2.4 to 2.9 m in: further than a burst's reach of the leaf. 10-15: on the front way Sam crouches behind a WINDOW — with its pane gone a burst in a band of the room has a line to him through it, about the door's own axis at that depth, further to his side nearer the wall; a grenade at rest 2.89 m in and 0.13 m from the axis staggered him. Aimed 3 m in it lay 4.4 to 4.6 m in, still in the band: so it is thrown ACROSS the door instead, `fragHalf`) · the leaf is pulled to this far ajar behind it (rad),
   *  from this long after it left his hand */
  ownPost: [0.15, 1.1], ownAsk: 1.5, bigReach: 1.0, samFragM: 1.5, ajar: 0.35, ajarAt: 0.25,
  /** a set charge is blown once its man is clear ('armed'), or this long after it was set · a blown door / a frag's room: the row runs on this long after its mark */
  clearSecs: 1.5, aftermath: 1.6,
  /** THE OPTICAL WAND: where Sam is walked to in front of the shut door [along the wall toward the stack, out from its line] (inside his reach of the leaf: the
   *  look's own spot, half a metre off its middle, is the game's) · seconds the lens is turned to each side once it is through · a leaf the row before left wide is pulled home first, for this long at most (s), him this far clear of its sweep (m). THE STICKY CAMERA: he steps to [m along the wall from the door's middle, on his own side · out from its line] (nearer square to the door than a throw's half step: a line that slants in meets the pushed leaf) · its line
   *  through the open door is the one of this many across the opening that meets a wall nearest the door, no nearer than … m inside its line, within … m ·
   *  the launcher's button is waited for this long (s) · seconds it is looked at once stuck · the leaf is pushed this far round for it (rad: past square to the wall — a camera that meets a LEAF drops to the floor under it, stickycam.ts) and a line passes no nearer the leaf so stood than … m. THE 40 MM: the launcher shouldered down the wall AWAY from the
   *  stack, this many deg out into the yard (the one quiet row that asks more than `maxOff`: never through this door — the round arms 8 m out) · seconds held
   *  there. THE WALL CHARGE: the spots asked of the order, m along the stack's wall from the door's middle (the first the order's own test passes for the
   *  whole team) · blown once every man is stood off ('armed'), or this long after it was set · a man further than this off his place as its row ends is put
   *  back under the dissolve (m) · A WALL LEFT OPEN: after this many bursts fired through the kept hole the room is staged again under the dissolve (mend()) ·
   *  Sam's half step home onto what the charge threw down is given up within this of his slot (m: tidy() — tools/qa/kitview-levels.cjs holds him to it) ·
   *  a wall charge waits this long past `wallClear` for the last man to be out of its reach, then comes down unblown (s) */
  wandPost: [0, 0.8], wandPan: 0.8, wandShut: 3, wandClear: 0.45, camPost: [0.15, 1.5], camRays: 9, camIn: 0.3, camReach: 12, camAsk: 1.5, camHold: 1.2, camWide: 1.75, camClear: 0.25, shellYard: 20, shellHold: 1.2, wallAt: [2.6, 3.1, 2.1, 3.6, 1.6, 4.1], wallClear: 5, wallOff: 0.35, holeBursts: 3, samGive: 0.5, wallLate: 5,
  /** IDLE LIFE: a man in no row lets his gun wander to these angles off his rest aim in turn (deg; each man starts further down the list) · seconds between
   *  two of them, in turn · seconds each ease takes · the height his eyes are put at (m) */
  scanDeg: [5, -4, 3, -6, 4, -3, 6, -5], scanGap: [3.4, 4.6, 3.9, 4.3, 3.1, 4.8, 3.6], scanEase: 1.4, scanY: 1.2,
  /** a teammate's pace to a post and back (m/s: the orders' own slow walk — teammates never sprint) · THE CARD SWITCH: the mover's pace up the yard lane
   *  (under the orders' brisk 2.0) · Sam's own walk, as a share of his 1.55 · the lane, m out from the file · the diagonals' reach along the wall · the men
   *  ahead step back: the first after … s, then every … s · the mover's thing begins on arrival, or after this long · the fourth man goes round Sam this
   *  far out on the yard side, to a place [past Sam's jamb, off the wall's line] — kept this far, centre to centre, from every other man's place on any
   *  anchor's width (kitViewPlan.ts kitPlanAct4) · a way point is reached within · a man is on his place within (m) */
  pace: 1.3, swapPace: 1.6, samWalk: 0.84, lane: 0.7, cutIn: 0.4, shuffle: [0.25, 0.15], swapSecs: 4, round: 0.75, act4: [0.2, 0.9], actClear: 0.7, wayM: 0.25, onSlot: 0.2,
  /** a row that would be refused for a moment (Sam still walking home under Game.puppet, the leaf not yet to) is waited for this long at most (s) */
  wait: 2.5,
  /** HOME (10-15, the owner's drive of the real page): a teammate is ON his place within … m (the game's walker eases onto a mark to 4 cm; `onSlot` + 0.1 called
   *  men 0.16 and 0.26 m short of theirs settled, and Game.puppet then held them there) · a row of SAM's waits this long at most for the men to walk home (a CUT
   *  sends the men its row had off their slots at once, together, at `swapPace`) — then, or AT ONCE where a man is
   *  further than … m from his place (no short walk), they are put there under the dissolve. Sam's own walk home is his next row's: it is not waited for */
  homeM: 0.08, homeSecs: 1.5, farM: 2.5,
  /** SAM'S OWN FRAG, the throw made sure of (his hand stood in front of the latch jamb when his chest was square to the wall — the grenade came back off it and
   *  burst in the yard): his step toward the front of the door for it (m; 0.8 put his hand inside the frame's width and the grenade down the door's axis — into the band of the room a burst has a line to him from through the window he crouches behind, with its pane gone; from half a step it goes in ACROSS the door, away from his side: fragAim() takes it through the gap whatever his chest does) · the leaf held this wide (rad) · nothing is
   *  thrown unless its solved arc first lands this far inside (m) · a grenade found, after its first bounce, nearer the door's line than … m is taken away */
  fragHalf: 0.5, fragWide: 1.5, fragLand: 1.0, fragMin: 1.0,
  /** a teammate's gun changed: the model is written this long into his hands' errand (the animator's kit swap: the fist is over the shoulder) · the gun's row begins */
  swapAt: 0.55, swapUp: 0.85,
  /** a thing on the floor is taken away once it is this old (s), at a row's start: never under the eye */
  litter: 8,
  /** a light with a lifetime (a flash, a blast, a muzzle) is no brighter than this in the picture: about the porch lamp's own 15, so nothing whites the column out */
  flashMax: 18,
  /** a LIGHTNING stroke (game/weather.ts strike: a directional light with no lifetime, flagged transient, 5 to 31 against a moon of 1.5 here — the whole
   *  yard whited for two or three frames) is no brighter than this share of the night's own directional light as the picture has it — a flicker, the
   *  yard about half again as bright — or than `strokeMin` where there is none; the sky's own flash is turned down by as much */
  strokeK: 0.4, strokeMin: 0.5,
  /** THE DISSOLVE: ms the copy of the last frame takes to fade out · frames drawn under it first */
  dissolveMs: 250, settle: 8,
};
/** the tiles that are COUNTS: written to the live pools */
/** THE QUIET PICTURE (the maintainer: "quiet missions should have different gear screen stuff"; and the standing rule, show, not tell). ONE image on a
 *  quiet kind — a quiet mission's link, alone or as two, and the solo night (host/kitViewSet.ts kitViewQuietKind: read off the LINK, never off the
 *  scenario that is up) — a crouched dark figure, his feet in the dark, his head and shoulders cut out against a small warm pool under the door's lamp;
 *  the yard cool and dim, the door a hand ajar on a dim warm room. His suppressed gun's tile puts the lamp out with one round and he crosses where the
 *  pool was. THE SWITCH is `on` (the page: on; `?kitloud` puts it off — forwarded to the picture by ui/kitView.ts): off = the picture exactly as it was on
 *  every kind, and with it on a LOUD mission's picture does not move (nothing below is read unless the link's kind is quiet). A host table like its
 *  neighbours: nothing in the game reads it, so it is no knob of the game's registry. Every number is a first guess off stills on the software adapter —
 *  never seen on a GPU, never in motion at speed. */
export const KIT_VIEW_QUIET = {
  on: true,
  /** THE POOL: the porch lamp's place, but a tight SPOT straight down, tipped `tip` m out from the wall. `outerDeg` is a HALF angle (render/lights.ts
   *  packs its cosine): under a 2.4 m lamp the lit floor is 2.4 × tan 24° = 1.07 m in radius, about 2.1 m across, and its edge (20° to 24°) 0.2 m wide —
   *  a hard rim, the line that cuts him at the hips.
   *  A way's own `light.porch` keys still lie over these. It hangs as a real lamp of the game's (a `game.targets` entry over its glowing box) so that a
   *  round really puts it out */
  lamp: { kind: 1 as const, intensity: 16, range: 5, innerDeg: 20, outerDeg: 24, radius: 0.03, broad: false, tip: 0.25 },
  /** the yard: the moon DOWN (it lit everything to one middle value: the pool was a quarter over its own floor) and turned BLUE (`moonTint` over
   *  its own colour: it is the floor's light — the fill, low and far out, lights the wall's face and the men and next to nothing of the floor — and a
   *  brown floor under a warm moon said afternoon) · the fill bluer and low: a pale wall under it was two thirds of the pool · the sky as it was
   *  (it does next to nothing on the lowest presets) */
  fill: { color: [0.4, 0.6, 1] as Vec3, intensity: 0.8 }, moonScale: 0.5, moonTint: [0.4, 0.62, 1] as Vec3, skyScale: 1.2,
  /** THE ROOF STAYS ON: where the team stands under the open sky, a roof or ceiling slab that lies wholly behind the wall (no further out over the
   *  team's side than `roofEave` m past its face) is DRAWN — the game's camera looks through such a slab; here the room behind the door is a dark
   *  shape, "they are inside", and the only warm things left are the pool and the door's slit. false = the room open to the camera, as it was */
  roofs: true, roofEave: 0.15,
  /** THE FRAMING, for one subject — door, pool, man: down the clear column the lamp's fixture at `lamp` of its height and his boots at `boots` (the
   *  distance follows from the two; the foot of the column is left to dark floor, and a partner), his spine `spine` of the way across it. With no
   *  column told (the picture's page alone) the whole window is the column */
  frame: { lamp: 0.3, boots: 0.67, spine: 0.55 },
  /** the door: this far ajar at rest (deg), eased back there at … rad/s after a row moved it · the room behind it: its own lamps that reach the doorway
   *  burn at this share of themselves (the loud cost's seam: quietInside()) · and THE BLADE: a small warm lamp of the picture's own hung … m behind
   *  the wall's far face, … m past the frame on the LATCH's side, this high. The leaf stands ajar INTO the room: its gap is seen only from the
   *  latch's side, so from there a long thin blade of light lies out across his floor, slanting toward the hinge's side through where the pool is
   *  (a lamp behind the door's middle, or a room's own 3 m back, sees no gap at all). At a door or a gap, whatever the room has.
   *  ITS NUMBERS ARE THE BLADE'S: the gap is a slot three fingers wide, so the lamp is nearly a point (`radius`: at 0.1 the whole blade was the
   *  lamp's own half shadow, a smear), high under the lintel so it carries across the yard, and `side` sets its line: 0.05 = a
   *  thin line straight out (7 to 16 deg off the door's own line), 0.25 = a wedge 32 to 45 deg toward the hinge's side.
   *  AND IT IS QUIET (`intensity`): at 2.5 the blade was a tenth over the moon's floor, nothing; at 22 it was a third of the pool, a half metre
   *  ribbon that made the pool a comet and took the eye off the man. At 8 it is a faint line beside one clean disc: the swing of the door starts
   *  from something, and the loud cost's slit (`cost.blade`) still flares over it */
  ajarDeg: 16, leafRate: 1.2, inside: 0.15, own: { back: 0.4, side: 0.1, up: 1.9, color: [1, 0.72, 0.42] as Vec3, intensity: 8, range: 8, radius: 0.02 },
  /** THE REST POSE: Sam crouched this far along the wall from the door's middle, on the side the plan stands him (out from the wall: the wall men's
   *  own distance) · a partner the same again behind him · and HE GIVES WAY FIRST: while a partner's card is the open one (the partner is up at the
   *  door, and the game stacks a man who works it a body's width from Sam's place) Sam rests this much further back along the wall — he steps back as
   *  that card opens, before any row of the partner's, and forward again as his own does */
  samAlong: 1.1, mateGap: 1.0, stepBack: 0.5,
  /** THE SUPPRESSED GUN'S ROW: seconds he takes to rise to a half crouch and aim · how far up (0 = stays down, 1 = stands) · seconds the dark is held
   *  from the round · the MOON lifted to this, and the fill to this, over … s (eyes adjusting: the floor comes up blue) · he walks to the jamb … s after the round: … m past the frame, … m off the
   *  wall's face — the FAR jamb (`jambFar`): across the doorway, through where the pool was, to end with the blade across a shoulder (false, or no
   *  free floor there: the jamb on his own side) · the loop rests this long before the lamp goes again */
  rise: 0.65, half: 0.7, hold: 4, lift: 1.7, liftFill: 1.3, liftSecs: 1.2, walkAt: 1, jambAlong: 0.2, jambOut: 0.6, jambFar: true, gunRest: 3.5,
  /** …and THE KILL IS A CUT: the frame after the lamp dies takes no history (no glow left fading on the floor), the gun's gas is taken out of the
   *  air (unlit, it drew as soot on the door) and the dead lamp's lead does not arc for this row (the fixture's own burst is the only sparks: gone in
   *  half a second) · a cold flick at the muzzle as the round goes: this bright, reaching … m, for … s (0 = none) */
  cut: true, flick: { intensity: 5, range: 3.5, secs: 0.07 },
  /** the suit / trim tile: a lean of … m toward the pool, held … s · a throw's step from the crouch (m toward the throwing post) · a gun left out after
   *  a row is put away after … s at rest */
  leanM: 0.4, leanSecs: 0.6, throwStep: 1.1, stow: 1,
  /** LOUD KIT'S COST (kitViewCostly: a row that is loud and WENT OFF, never a suppressed gun's): the room at full for `slit` s behind the leaf still
   *  ajar · the leaf thrown to `wideDeg` at `swing` rad/s and he is up · held `hold` s · the loop rests `rest` s after the room is staged again. ITS
   *  LAMP, the picture's own, hung for the cost alone: `back` m behind the wall's far face (`backMin` at least, where it has to come nearer for the
   *  slab to reach him), `up` high, slid along the wall away from him (to `side` m past the far jamb; `clear` m inside the doorway where the open leaf
   *  stands on that side) until the slab's edge passes `past` m beyond his place (he is IN it where it reaches the near `body` m of him).
   *  ONE LAMP THROWS IT, a point (`radius`: the jambs' shadows are its hard edges): the blade's own lamp burns at `blade` of itself for the slit
   *  and is OUT once the leaf is thrown, and so is the pool lamp (`pool`: the share of itself it burns at under the thrown leaf — it was one more
   *  light, a second shadow of him, and lost in the slab anyway; back with the restage) — so he has ONE long shadow. The room's own lamps burn
   *  at `room` of themselves from then (1: full, as through the slit — under the roof that stays on they add nothing to the yard's floor; the
   *  seam to take them down at a way where they come out through the doorway as a flood).
   *  IT READS AS "CAUGHT" BY ITS SHAPE: a WEDGE with the doorway's shape, not a slab. `past` was 0.75 and pulled the lamp to 0.15 m behind the
   *  wall: a fan 75 deg wide that filled the yard. At 0.25 the lamp hangs about 0.35 m back and the fan runs from just past straight out of the
   *  door to about 53 deg toward him — its edge crosses the floor a quarter metre beyond his place, so he stands lit just inside it, and the
   *  floor along the wall behind him and all the floor on the door's far side stay dark. (Further back is a narrower, door-shaped fan that
   *  MISSES him: he rests a body's width off the wall, 1.1 m along — at 1.0 m back the edge falls 0.84 m along at his distance.)
   *  AND HE IS FROZEN in it: where he stood as the row ended, no walk home under the hold, up out of the crouch from the cost's first frame (as
   *  the room flares behind the leaf: he is standing when it is thrown) and ALL of him turned to the door — his aim at `aimY` m up its middle
   *  and his body's own yaw asked round to it too, at `turn` deg/s (a start, not the calm rows' 100 and 150): a throw leaves his gun on the
   *  door and his feet 50 deg off it, and the game turns only the chest to an aim that near — he stood twisted, which read as a stride.
   *  ITS BRIGHTNESS (`lamp.intensity`): at 48 the wedge's core was twice the pool on a clear floor, but a frag's own smoke stands in the doorway
   *  under it and took a third of that; at 64 the core under a frag is where the old slab's was */
  cost: { slit: 0.4, wideDeg: 100, swing: 9, hold: 1.5, rest: 3, blade: 2, room: 1, pool: 0, aimY: 1.2, turn: 240,
    lamp: { back: 0.45, backMin: 0.2, up: 1.9, side: 1.2, clear: 0.08, past: 0.25, body: 0.2, color: [1, 0.74, 0.46] as Vec3, intensity: 64, range: 8, radius: 0.01 } },
  /** LIFE AT REST, no guard: after each of these seconds of rest in turn (a fixed list: no dice) the warm lamp behind the door slides `slide` m along
   *  the wall over `out` s, stays `stay` s and slides back, dark to `blinkTo` of itself for `blink` s from `blinkAt` (somebody passes it); every man's
   *  idle sway is stopped for its length. WHICH WAY: further past the LATCH (the only way the gap still sees it: slid the other way the lamp is
   *  behind the leaf and the blade only goes out) — the blade swings from its line straight out round toward the hinge's side, up along the wall
   *  (56 to 67 deg off the door's line at 0.5 m), and back; toward his boots only where he rests on the hinge's side. With no lamp of the
   *  picture's own hung, one is hung for the beat (its place and colour, at `gain` of it, in and out over `fade` s).
   *  SWITCHED OFF (`on`: the beat plays only when it is true; a check raises it for itself — `KitView.idleOn`). As it stands it reads as a
   *  glitch: here he rests on the latch's side, so the blade swings AWAY from him; its pivot is hidden in the pool, so the pool seems to wag a
   *  tail; and on the Team & kit page both ends of the swing fall outside the clear column. The code and its pure functions stay */
  idle: { on: false, every: [15, 14, 16, 14.5, 15.5], slide: 0.5, out: 1.2, stay: 0.6, blinkAt: 0.5, blink: 0.4, blinkTo: 0.1, gain: 1, fade: 0.3 },
  /** SAM'S WEAPON LIGHT on a quiet kind: from the crouch, on for one pass across the door — `sweep` s of it, held `hold` s — and off; aimed … m up */
  light: { sweep: 0.5, hold: 0.2, aimY: 0.9 },
};
/** the quiet picture's kind for this link — 'quiet' | 'solo' — or null: a loud link, the switch off, or `kitloud` in the link (pure: the page check's too) */
export function kitViewQuietOf(q: URLSearchParams, on: boolean = KIT_VIEW_QUIET.on): 'quiet' | 'solo' | null { return on && !q.has('kitloud') ? kitViewQuietKind(q) : null; }
/** THE POOL LAMP, on the plan's porch place (pure): its numbers — the quiet table over the loud lamp's, the way's own `light.porch` over both — and its
 *  aim: straight down, tipped out, unless the way wrote an aim of its own. */
export function kitViewQuietLamp(P: Pick<KitViewPlanned, 'lamps'>, over: Partial<KitViewLight['porch']> | undefined): KitViewLight['porch'] {
  const { tip, ...Q } = KIT_VIEW_QUIET.lamp, o = P.lamps.porch.offset;
  return { ...KIT_VIEW_LIGHT.porch, ...Q, ...(over ?? {}), offset: o, aim: over?.aim !== undefined ? P.lamps.porch.aim : [o[0], o[1] + tip, 0] };
}
/** THE REST PLACES (pure): Sam crouched `samAlong` m along the wall from the anchor's middle, on the side the plan stands him, at the wall men's
 *  distance, facing the door along the wall; a partner `mateGap` m behind him. A place the level WROTE wins (null here: the plan's stays), and so
 *  does the plan's where the worked-out one is not free floor. [x, z, yaw deg] */
export function kitViewQuietPlaces(P: Pick<KitViewPlanned, 'anchor' | 's' | 'wall' | 'slots' | 'slotSrc'>, mates: number, free: (x: number, z: number) => boolean): { sam: [number, number, number] | null; mate: [number, number, number] | null; /** Sam's place while a partner's card is open (`stepBack`): with a partner, at a door or a gap, on free floor — else null */ back: [number, number, number] | null } {
  const A = P.anchor, s = P.s, n = A.n, m = A.mid, Q = KIT_VIEW_QUIET, out = P.wall.face + KIT_PLAN.offFace;
  const al0 = (P.slots[0][0] - m[0]) * s[0] + (P.slots[0][1] - m[1]) * s[1], sg = al0 > 0 ? 1 : -1;
  const at = (al: number): [number, number, number] => [m[0] + s[0] * sg * al + n[0] * out, m[1] + s[1] * sg * al + n[1] * out, Math.atan2(-s[0] * sg, -s[1] * sg) / R];
  const ok = (p: [number, number, number]) => free(p[0], p[1]);
  const sam = P.slotSrc[0] !== 'authored' ? at(Q.samAlong) : null, mate = mates >= 1 && P.slotSrc[1] !== 'authored' ? at(Q.samAlong + Q.mateGap) : null;
  const S = sam && ok(sam) ? sam : null, back = S && mates >= 1 && A.kind !== 'wall' ? at(Q.samAlong + Q.stepBack) : null;
  return { sam: S, mate: S && mate && ok(mate) ? mate : null, back: back && ok(back) ? back : null };
}
/** THE ROOF STAYS ON (pure; KIT_VIEW_QUIET.roofs): the level's boxes, by index, that the quiet picture DRAWS though the game's camera looks through
 *  them — a cover (the plan's own test of one: its underside `coverY` up, `coverHalf` across both ways) flagged NoPrimary, no light's panel, that lies
 *  wholly behind the wall: no corner of it further out over the team's side than `roofEave` past the wall's face (a turned slab: by its circle).
 *  None where the team itself stands under a roof (the plan's `indoors`: the slab over the men is the one over the room), or with the key off. */
export function kitViewQuietRoofs(boxes: readonly Pick<Box, 'c' | 'h' | 'yaw' | 'flags'>[], P: Pick<KitViewPlanned, 'anchor' | 'wall' | 'indoors'>, on: boolean = KIT_VIEW_QUIET.roofs): number[] {
  if (!on || P.indoors) return [];
  const m = P.anchor.mid, n = P.anchor.n, lim = P.wall.face + KIT_VIEW_QUIET.roofEave, outOf = (x: number, z: number) => (x - m[0]) * n[0] + (z - m[1]) * n[1], got: number[] = [];
  boxes.forEach((b, i) => { if (!(b.flags & BoxFlag.NoPrimary) || (b.flags & (BoxFlag.NoShadow | BoxFlag.Emissive | BoxFlag.AreaLit)) || b.c[1] - b.h[1] < KIT_PLAN.coverY || Math.min(b.h[0], b.h[2]) < KIT_PLAN.coverHalf) return;
    const far = b.yaw !== 0 ? outOf(b.c[0], b.c[2]) + Math.hypot(b.h[0], b.h[2]) <= lim : [[1, 1], [1, -1], [-1, 1], [-1, -1]].every(([i0, k0]) => outOf(b.c[0] + i0 * b.h[0], b.c[2] + k0 * b.h[2]) <= lim);
    if (far) got.push(i); });
  return got;
}
/** THE POOL LAMP AS A LAMP OF THE GAME'S (game/lighting.ts LightTarget, built by hand on the host side: the game makes its own only from a level's
 *  lights): the picture's porch light and its glowing box (its index in the world's statics), so that the player's round meets it as it meets any
 *  fixture (combat.ts shootOut), `repairLights` mends it, and the game writes its light and its box's glow each step. */
export function kitViewPoolTarget(light: RtLight, box: number, glow: Vec3, intensity: number): LightTarget {
  return { name: 'kitview_porch', group: 'kitview', kind: 'analytic', pos: [light.pos[0], light.pos[1], light.pos[2]], light, boxes: box >= 0 ? [box] : [], baseEmissive: [glow[0], glow[1], glow[2]], baseIntensity: intensity,
    on: true, broken: false, disabledUntil: -1, fluorescentFlicker: false, factor: 1, mains: false, interactive: true, stagger: 0 } as LightTarget;
}
const COUNTS = ['bangs', 'frags', 'smoke', 'charges', 'walls', 'cams', 'shells', 'rings'];

/** this page was opened as the picture (`?kitview`) · … and LIVE (no `&stillkit`): the loop */
export const kitViewOn: boolean = (() => { try { return /[?&]kitview(=|&|$)/.test(location.search); } catch { return false; } })();
export const kitViewLoop: boolean = kitViewOn && (() => { try { return !/[?&]stillkit(=|&|$)/.test(location.search); } catch { return true; } })();
// THE GUARD, at this module's load — main.ts imports it FIRST, before any module that reads or writes a store: this window's Storage writes do nothing (an
// iframe has its own Storage.prototype: the page that holds it is untouched), it has no IndexedDB, and no key, button, wheel or touch reaches a listener registered after this one.
if (kitViewOn) {
  try { const P = Storage.prototype; P.setItem = () => { /* read-only */ }; P.removeItem = () => { /* read-only */ }; P.clear = () => { /* read-only */ }; } catch { /* no Storage */ }
  // …and the origin's other stores: no database is opened from this window (the replay keeper, ui/replaykey.ts, stands down where there is no IndexedDB: it
  // would open one, prune it and ask for persistent storage) and nothing asks for persistence
  try { Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined }); } catch { /* */ }
  try { const st = navigator.storage as unknown as { persist?: () => Promise<boolean> } | undefined; if (st) st.persist = () => Promise.resolve(false); } catch { /* */ }
  for (const ev of ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mousemove', 'click', 'dblclick', 'contextmenu', 'wheel', 'pointerdown', 'pointerup', 'pointermove', 'touchstart', 'touchmove', 'touchend']) window.addEventListener(ev, e => { e.stopImmediatePropagation(); }, { capture: true });
  try { document.body.classList.add('kitview'); } catch { /* */ }
  (window as unknown as { __kitview: unknown }).__kitview = { state: 'boot', drawn: 0, skipped: 0, men: [], door: null, way: 0, beat: null, queue: [], restarts: 0, last: null, skip: () => false };
}

/** (`slot`: which of the way's places the staging gave him — 0 Sam's, then the teammates' from the door outward) */
export interface KitViewMan { name: string; x: number; z: number; yaw: number; gun: string; light: boolean; slot: number }
export interface KitViewDeps {
  game: Game; engine: Engine; cam: FollowCamera; input: Input; view: HTMLCanvasElement; loop: LoopCtx;
  audio: { enabled: boolean; setVolumes(): void };
  /** the teammates the scenario staged, in staging order (game/scenarioRun.ts teamOf) */
  team(): Guard[];
  /** the face of a door a point is on (game/orders.ts sideOf) */
  doorSide(d: Door, p: Vec3): 1 | -1;
  /** a glowing box for a lamp's fixture (main.ts: scene/boxes.ts makeBox, emissive, its emission carried by the lamp) — not yet in the world */
  glowBox(c: Vec3, h: Vec3, yaw: number, glow: Vec3): Box;
  /** the hour has the level's outside lamps OUT (main.ts: game/hours.ts — an hour whose HourDef.lamps is false; never at night): the picture's porch lamp
   *  is on the same photocell (host/kitViewPlan.ts kitPlanPorchLit) */
  lampsOut(): boolean;
  /** the level's own FILE records as this stand loaded them (main.ts: scene/levelLoad.ts levelFileOf — the boxes index for index the level's, with the ids,
   *  groups and flags a runtime box does not carry; its doors and lamps): what the way's PLAN is measured from (host/kitViewPlan.ts). null: none kept */
  file(): KitPlanLevel | null;
  /** the cards of a `kit` message into the kit table, through the store's own reader and saving nothing (main.ts: game/kit.ts kitLoad over a store that is the message) */
  kitCards(members: unknown[]): void;
  /** the cards as the kit table has them (game/kit.ts KIT.members) · the fields of member i's tiles, top to bottom (kitRows) */
  kit(): readonly object[]; tiles(i: number): string[];
  /** the squad's smoke for this run: the count, and the order's row on the menu (game/squadsmoke.ts squadSmokeStage) */
  smoke(n: number): void;
  /** WRITTEN LIVE (kit.ts, through main.ts): the weapons row member i's card works out to (kitGun) · his suit and trim colours (null: as issued) · Sam's
   *  card put on him again as he stands (kitShow, then kitPlayer) */
  gun(i: number): string; tints(i: number): { suit: Vec3 | null; trim: Vec3 | null }; samCard(): void; turn(spec: string): void;
  /** ONE ROUND of the gun in his hands at a point (combat.ts fireWeapon, steady: `man` null = Sam) — the game's own flash, report, tracer and glass · the level's panes of glass (glass.ts glassPanes: statics) */
  fire(man: Guard | null, at: Vec3): void; panes(): Box[];
  /** the glass's own books as a fresh encounter has them (glass.ts resetGlass, glasspen.ts resetGlassPen: the stars' count and log, the holes rounds went through) */
  mendGlass(): void;
}
/** a beat as checks read it: which one since the page opened, the thing (a tile's field; 'turn' = suit / trim), the member (0 = Sam), seconds of game time
 *  in, where it is ('back' = walking home) and what has happened (the row's own words: 'bang', 'smoke', 'blow', 'set', 'lost', 'cap' …) */
export interface KitViewBeat { n: number; field: string; i: number; t: number; phase: string; marks: string[] }
export interface KitView {
  /** STILL: staging → warm → held. THE LOOP: staging → rest ⇄ beat, `swap` while a card's man walks to the head of the file, `paused` while the parent says the step is not showing */
  readonly state: 'staging' | 'warm' | 'held' | 'none' | 'rest' | 'beat' | 'swap' | 'paused';
  drawn: number; skipped: number; blocked: number;
  men: KitViewMan[]; door: string | null; way: number;
  /** THE PLAN the staging stands on (host/kitViewPlan.ts kitViewPlan, on the game's own floor), for checks — null: nothing staged. `reachIn` = the floor a
   *  can or a round has behind the anchor's line (m) · `hole` = a wall anchor stands blown open · `sunk` = boxes out of the picture */
  readonly plan: (KitViewPlanned & { set: string | null; reachIn: number; hole: boolean; sunk: number }) | null;
  /** the beat under way · the thing asked for and not yet begun · encounters restarted since the page opened (only what cannot be written live restarts
   *  one) · blown doors hung again · beats cut short by a pick */
  readonly beat: KitViewBeat | null; readonly queue: string[]; restarts: number; rehangs: number; cuts: number;
  /** THE DIRECTOR'S OWN WORD FOR A WAIT (a check reads it; it never guesses): the last time a PICK was not begun on the frame it could have been — `n`
   *  the number the beat got when it did begin (the next beat's, while it still waits), `field` what was asked and `i` the member whose card was open
   *  (0 = Sam), `why` each rule that held it, in the order met ('mend': what the last row broke is hung / staged again under the dissolve first — and a
   *  restage a card's change asked for · 'arrive': a card switch's walk · 'home': a row of Sam's waits for the men to walk home, homing() ·
   *  'sam' | 'leaf': waits() — Sam on his half step home under Game.puppet, the leaf not yet to), `by` on how many of the director's frames EACH rule
   *  held it, `frames` on how many a rule held it at all (a frame two rules held counts once here, once under each in `by`; a frame the director did not
   *  begin the row on and named no rule for is in neither — a check counts those against the row), `s` the game's clock from the pick's HEARING to the
   *  row's begin (while it still waits: to the last frame held). A NEW PICK DROPS THE WORD of one that never began: a word is its own pick's alone.
   *  null: no pick has waited yet */
  readonly held: { n: number; field: string; i: number; why: string[]; by: Record<string, number>; s: number; frames: number } | null;
  /** the switch a check turns off: a pick waits out the running beat and its rest, as the picture did before 10-14 */
  preempt: boolean;
  /** the switch a check turns off: HOME (KIT_VIEW_LOOP.homeM … farM) — off, a restage keeps each man where he stood, `settled` is within 0.3 m, and a row
   *  of Sam's waits only for the men its last row moved and never puts anybody home, as before 10-15 · men put home under the dissolve since the page opened */
  home: boolean; seats: number;
  /** the switch a check turns off: the wall charge's STAND-CLEAR gate can open — off, a man is counted inside the charge's reach whatever the game says, so
   *  the gate's own timeout plays (the charge down unblown under the dissolve, the way's refusal remembered) */
  standClear: boolean;
  /** THE HOLD through Sam's frag (after()): man-frames it had to put a teammate back on his place or back on his knee — 0 while the game's own men do
   *  nothing about the grenade; anything else says the game moved one and the hold overrode it */
  pins: number;
  /** WHAT THE PARK HAD TO PUT RIGHT since the page opened, never reset (kitViewPark, every park but a staging's own): the level's men found roused
   *  (man-parks: a man found so at two parks counts twice) · the alarm's marks dropped (the episode, the placed alarm). 0 and 0: nobody of the level's
   *  was ever stirred by the picture — a check holds every row to it, since the park leaves nothing else for it to read */
  roused: { men: number; alarms: number };
  /** the dissolve: how many copies were laid over the picture, where one is (`''`: none up), and how often no copy could be had (the work done as it stood) */
  readonly dissolve: { n: number; phase: string; cuts: number };
  /** idle life: each man (Sam first, then the file) — his gun is wandering, and how far off his rest aim the director asks it (deg) · where his gun IS off it (deg) */
  readonly scan: { name: string; on: boolean; deg: number; off: number }[];
  /** nothing is in motion: no beat, every man on his place, the leaf to, Game.puppet let go, no dissolve up */
  readonly settled: boolean;
  /** LOUD KIT'S COST (KIT_VIEW_QUIET.cost), for the checks: how many played and how many a pick cut short · one is up · the last: whose row it
   *  followed, the most the room burned at, there was a hung leaf to throw and the widest it stood off shut (rad), he was up, the lamp hung and whether its slab reaches
   *  his place, how long it ran and how it ended ('' while it runs · 'done' · 'cut') */
  readonly cost: { n: number; cuts: number; on: boolean; last: { field: string; i: number; share: number; door: boolean; leaf: number; up: boolean; lamp: boolean; catches: boolean; s: number; how: string; /** the furthest his feet moved under it (m) · the pool lamp was put out under the thrown leaf */ moved: number; pool: boolean } | null };
  /** LIFE AT REST (KIT_VIEW_QUIET.idle), for the checks: beats begun and how many a row cut short · one is up and the men are held still · the lamp
   *  that slides ('own': the picture's own behind the door · 'beat': one hung for the beat) · the furthest it slid (m) · seconds to the next (NaN: none due) */
  readonly life: { n: number; cuts: number; on: boolean; still: boolean; lamp: 'own' | 'beat' | null; far: number; next: number };
  /** a check's own: seconds of rest before the next idle beat, over the table's list (null: the table's) */
  idleEvery: number | null;
  /** a check's own: the idle beat switched on or off over the table's `idle.on` (null: the table's) */
  idleOn: boolean | null;
  /** the pace: the display's rate as read, every how many of its frames one is drawn, the count that rate starts from, down from it — and a fresh pacer, for a check to feed */
  readonly pace: { hz: number; every: number; base: number; slow: boolean }; pacer: typeof kitViewPacer;
  /** the last beat over — how it ended ('done' · 'cut': a pick · 'cap' · 'threw' · 'down'), where the thing it threw last lay, the brightest transient light
   *  drawn (after the ceiling), the most the game would have whited the picture, the furthest a man it was not about came off his slot (m) — and why the
   *  last one asked for did not begin */
  last: (KitViewBeat & { how: string; rest: Vec3 | null; peak: number; flash: number; drift: number }) | null; refused: string | null;
  /** what after() put out, counted as it did: Sam staggered (a frag's blast found him), a teammate dazzled or doubled over under Sam's own charge */
  hits: { sam: number; team: number };
  /** rounds the gun rows have fired since the page opened (deps.fire) */
  shots: number;
  /** lightning: strokes seen · the brightest as the game had it · the brightest drawn · the ceiling at the last one */
  stroke: { n: number; raw: number; drawn: number; cap: number };
  /** main.ts's frame loop neither steps nor draws this frame (counted in `skipped`): a still picture held, the loop paused, nothing to stage */
  rest(): boolean;
  /** main.ts's frame loop passes this display frame over whole — nothing stepped, nothing drawn, its clock not touched (the pace) */
  skip(ts?: number): boolean;
  /** STILL: draw the warm window again and hold */
  again(): void;
  /** stage the team again as the game now stands (after a restart) */
  stage(): void;
}

type V2 = [number, number];
const R = Math.PI / 180;
const yawOf = (d: V2) => Math.atan2(d[0], d[1]);   // (0 = +z, 90° = +x: the characters' bodyYaw)

/** A way's slots worked out from its door: [x, z, yaw] for Sam, then the teammates from the door outward. `ref` = a point on the team's side (where Sam was
 *  staged), `free(x, z)` = a man can stand there. Returns the slots and how many places had to be stepped over. Pure. */
export function kitViewSlots(door: { hinge: V2; closedDir: number; width: number }, ref: V2, mates: number, side: 1 | -1, free: (x: number, z: number) => boolean): { slots: [number, number, number][]; blocked: number; s: V2; n: V2; mid: V2 } {
  const K = KIT_VIEW_STAGE, t: V2 = [Math.cos(door.closedDir), Math.sin(door.closedDir)], H = door.hinge, J: V2 = [H[0] + t[0] * door.width, H[1] + t[1] * door.width];
  const mid: V2 = [(H[0] + J[0]) / 2, (H[1] + J[1]) / 2];
  const n0: V2 = [-t[1], t[0]], out = (ref[0] - mid[0]) * n0[0] + (ref[1] - mid[1]) * n0[1] >= 0 ? 1 : -1, n: V2 = [n0[0] * out, n0[1] * out];
  const s: V2 = [t[0] * side, t[1] * side], near = side > 0 ? J : H, far = side > 0 ? H : J;   // (s: from the door toward the stack)
  let blocked = 0;
  const lines = [0, 0];   // the next place along each line: [0] the stack's side, [1] Sam's
  const take = (line: 0 | 1, off: number): V2 => {
    for (let tries = 0; tries < 10; tries++) {
      const k = lines[line]++, a = K.jamb + K.gap * k, from = line ? far : near, dir = line ? -1 : 1;
      const p: V2 = [from[0] + s[0] * dir * a + n[0] * off, from[1] + s[1] * dir * a + n[1] * off];
      if (free(p[0], p[1])) return p; blocked++;
    }
    const a = K.jamb, from = line ? far : near, dir = line ? -1 : 1; return [from[0] + s[0] * dir * a + n[0] * off, from[1] + s[1] * dir * a + n[1] * off];   // (nowhere free in ten places: the first, and the count says so)
  };
  const slots: [number, number, number][] = [];
  const c = Math.cos(K.samTurnDeg * R), sn = Math.sin(K.samTurnDeg * R);
  const along = door.width / 2 + K.jamb, samOff = Math.max(K.samOff, Math.sqrt(Math.max(0, K.samClear * K.samClear - along * along)));
  { const p = take(1, samOff); slots.push([p[0], p[1], yawOf([s[0] * c - n[0] * sn, s[1] * c - n[1] * sn]) / R]); }   // Sam: across the door from the stack, turned onto it
  for (let i = 0; i < mates; i++) { const behind = i >= 3, p = take(behind ? 1 : 0, K.off); slots.push([p[0], p[1], yawOf(behind ? s : [-s[0], -s[1]]) / R]); }   // three on the stack's side facing the door; a fourth behind Sam, facing it from there
  return { slots, blocked, s, n, mid };
}

/** a page opened from disk (a `file:` address). Its windows have no origin to name: `location.origin` reads 'file://' (or the word 'null'), a message
 *  posted to that target is dropped, and one that does arrive carries the origin 'null' */
export const kitViewOnDisk = (): boolean => location.protocol === 'file:' || location.origin === 'null';
/** where a kit picture's messages are posted: this page's own origin — anywhere on a page opened from disk. `kitViewFrom` is the listener's half */
export const kitViewPostTo = (): string => (kitViewOnDisk() ? '*' : location.origin);
/** a message's origin is this page's own — on a page opened from disk, the 'null' every window there has. Each listener ALSO holds a message to the
 *  very window it must come from (`e.source`), which is what keeps anything else out on such a page */
export const kitViewFrom = (origin: string): boolean => origin === location.origin || (kitViewOnDisk() && origin === 'null');
/** this page has died (main.ts: fatalOnce — the frame loop threw and stopped, an uncaught error — the GPU device lost, a boot that failed): the parent is
 *  told there is no picture. Safe before kitViewStart and more than once (`none` again is nothing new to the parent) */
export function kitViewFatal() { try { if (dead) dead(); else if (window.parent !== window) window.parent.postMessage({ kv: 'none' }, kitViewPostTo()); } catch { /* */ } }
let dead: (() => void) | null = null;

/** Stand the view up (main.ts, once, after the scenario from the URL has staged and the loop's context exists). */
/** THE LEVEL'S DEVICES REPORT NOTHING IN A PICTURE. A level's own way stages the team where the mission starts — under its cameras, across its tripwires —
 *  and a lens that saw a lit Sam called control, sent a man and raised the floor (the counting house's front door, headless with the meter held at 0.8:
 *  suspicion at 4.2 s, the alarm at 5.8 s). The game's own switches for it, the Sandbox's two rows (game/devices.ts `sensing`: with `tune.devices` off the
 *  devices "are drawn, pan and glow but report nothing; keypads stay keypads" — a camera shot dead is not called in either; `tune.lasers`: the tripwires
 *  alone), written from the host with every park(): before the posing step and round every step of the loop. This window's game only, and nothing of it is
 *  stored (the Sandbox's own save is the panel's; ?kitview's storage is read-only). The picture is the same: the lens pans, its lamp glows. */
export function kitViewInert(game: { tune: { devices: boolean; lasers: boolean } }): void { game.tune.devices = false; game.tune.lasers = false; }
/** THE LEVEL'S OWN MEN RAISE NOTHING IN A PICTURE — park(), whole: everybody who is not the team far off, dark and held, CALM (his state, awareness and fix
 *  as a man who heard nothing), the devices inert (kitViewInert) — and DEAF. A row's blast is made INSIDE the game's step (the door tools' tick, a wall
 *  charge's, the director's own trigger said after park()), so "what is in the air is numbered and behind him" came a step too late: the staff parked 69 to
 *  77 m from the relay station's west gate (a charge carries 80) heard Sam's charge in the very step that made it, went to `alert` with a fix, the game's
 *  own bookkeeping (guards.ts updateEscalation) placed the alarm on that fix and opened an episode, park() calmed them — and the next step read the episode
 *  as over and raised the floor (0 → 1; the wall charge after it, 1 → 2; the partner called "compromised"). So his ears are closed — `heardUpTo`,
 *  the guards' and the civilians' own "heard as far as" mark (guards.ts hearingCheck skips every event numbered at or under it), set past any number an
 *  event can get: UNTIL THE GAME WRITES THE MARK AGAIN (a man it stands up mid-step is given the count as it then is — qrf.ts, guards.ts spawnUnit),
 *  and every park renews it — and, for whatever makes a man alert by another road, the episode that would raise the floor is dropped with the fix it
 *  placed, ONLY while the floor is at 0 (a floor already up keeps its marks). This window's game only: a restage's fresh men get it with the next park(). `ears` (the plan check's control alone): the park as it
 *  was, a man deaf only to what was in the air before the step.
 *  AND IT SAYS WHAT IT HAD TO PUT RIGHT (the review, 10-16: with the men calmed and the marks dropped before any reader ran, a check's "an alarm placed"
 *  and "a man alert" could no longer be true of anything — the park hid what it mended): `men` = the level's men it found ROUSED, by the game's own
 *  names for it (`suspicious`, `alert`, `search`: game.ts GuardState less `patrol` and `dead`) · `alarms` = the marks it dropped (the episode, the
 *  placed alarm: one each). The child adds them up on `__kitview.roused` for every park but a staging's own (fresh men, as the mission stood them up,
 *  are nobody roused): 0 for good is what a check holds the picture to. */
export const KIT_VIEW_DEAF = Number.MAX_SAFE_INTEGER;
type Parked = { team: string; state: string; char: { pos: Vec3 }; flashlight: { enabled: boolean }; hold: boolean; pinned: boolean; heardUpTo: number; awareness: number; lastKnown: Vec3 | null };
export function kitViewPark(game: { tune: { devices: boolean; lasers: boolean }; events: { id?: number }[]; eventSeq: number; guards: readonly Parked[]; civilians: readonly Parked[];
  escalation: number; alarm: { episode: boolean; placed: boolean } }, ears = false): { men: number; alarms: number } {
  kitViewInert(game);   // (…and the level's own cameras and tripwires report nothing: no call to control, no man sent, no alarm)
  for (const e of game.events) if (e.id === undefined) e.id = ++game.eventSeq;
  let k = 0, men = 0, alarms = 0; for (const g of [...game.guards, ...game.civilians]) { if (g.team === 'operative') continue;
    g.char.pos = [-40 - k++ * 3, 0, -40]; g.flashlight.enabled = false; g.hold = true; g.pinned = true;
    g.heardUpTo = ears ? game.eventSeq : KIT_VIEW_DEAF; g.awareness = 0; g.lastKnown = null; if (g.state !== 'dead') { if (g.state !== 'patrol') men++; g.state = 'patrol'; } }
  if (!ears && game.escalation === 0) { if (game.alarm.episode) alarms++; if (game.alarm.placed) alarms++; game.alarm.episode = false; game.alarm.placed = false; }
  return { men, alarms };
}

/** LOUD KIT ON A QUIET JOB SHOWS ITS COST (KIT_VIEW_QUIET.cost; show, not tell: no word says it). Does the row that just ended have one (pure: the plan
 *  check's too)? Only on the quiet picture as STAGED (`quiet`), only a row that is loud by nature (`Row.loud`) and ran to its own end ('done', its
 *  cap: a pick's cut has none, nor has the wall charge that only opens a wall FOR another row), and only if it WENT OFF: a gun's row by a round fired
 *  from a gun with no suppressor (read off the gun itself: weapons.ts `suppressed`), every other by its bang's own mark. */
export function kitViewCostly(r: { quiet: boolean; loud: boolean; prelude: boolean; how: string; gun: boolean; shots: number; suppressed: boolean; marked: boolean }): boolean {
  if (!r.quiet || !r.loud || r.prelude || (r.how !== 'done' && r.how !== 'cap')) return false;
  return r.gun ? r.shots > 0 && !r.suppressed : r.marked;
}
/** …and the cost `t` s from the old row's end (pure): the room behind the door at this share of itself (1: full, from its first frame, the leaf
 *  still a hand ajar; `room` once the leaf is thrown: one lamp throws the wedge) · the pool lamp at this share of itself (out under the wedge) · the
 *  leaf is being thrown wide and he is up out of the crouch · it is over (the room is staged again under the dissolve) */
export function kitViewCostAt(t: number, C: { slit: number; wideDeg: number; swing: number; hold: number; room: number; pool: number } = KIT_VIEW_QUIET.cost): { share: number; pool: number; open: boolean; done: boolean } {
  return { share: t >= C.slit ? C.room : 1, pool: t >= C.slit ? C.pool : 1, open: t >= C.slit, done: t >= C.slit + C.wideDeg * R / Math.max(0.1, C.swing) + C.hold };
}
/** THE COST'S LAMP (pure): where it hangs so that the slab through the opened doorway falls ALONG the wall over the man beside it, not straight out
 *  past him — he rests a body's width off the wall, so a lamp behind the door's middle lights the floor in front of the door and leaves him in the
 *  jamb's shadow. Behind the wall, slid along it away from him until the line past his own jamb reaches `past` m beyond his place; no further than
 *  `side` m past the far jamb — or, where the leaf's hinge is on that jamb (the thrown leaf stands there, across the lamp), `clear` m inside the
 *  doorway and nearer the wall for it; pulled toward the door's middle off floor that is not free. `reach` = how far along the wall, at his distance
 *  from it, the slab's edge falls; `catches` = that reaches the near side of him (`body` m short of his middle); `wedge` = the fan that gets out
 *  between the two jambs, its edges in degrees off the door's own line, positive toward him. [x, y, z] */
export function kitViewCostLamp(P: Pick<KitViewPlanned, 'anchor' | 's' | 'wall'>, width: number, sam: readonly number[], hinge: readonly number[] | null, free: (x: number, z: number) => boolean,
  C: { back: number; backMin: number; up: number; side: number; clear: number; past: number; body: number } = KIT_VIEW_QUIET.cost.lamp): { pos: Vec3; along: number; back: number; reach: number; catches: boolean; wedge: { from: number; to: number } } {
  const m = P.anchor.mid, s = P.s, n = P.anchor.n, al = (p: readonly number[]) => (p[0] - m[0]) * s[0] + (p[1] - m[1]) * s[1], w2 = width / 2;
  const sAl = al(sam), sg = sAl >= 0 ? 1 : -1, o = Math.max(0.2, (sam[0] - m[0]) * n[0] + (sam[1] - m[1]) * n[1] - P.wall.face), th = P.wall.face - P.wall.back;
  const leafFar = !!hinge && al(hinge) * sg < 0, lo = leafFar ? -(w2 - C.clear) : -(w2 + C.side), hi = w2 - C.clear, need = Math.abs(sAl) + C.past - w2;   // (`need`: how far past his own jamb the edge must fall)
  let back = C.back, a = Math.max(lo, Math.min(hi, w2 - need * (th + back) / o));
  const reach = () => w2 + (w2 - a) * o / (th + back);
  if (reach() < Math.abs(sAl) + C.past - 1e-6 && need > 0) { back = Math.max(C.backMin, Math.min(C.back, (w2 - a) * o / need - th)); }
  const at = (): Vec3 => [m[0] + s[0] * sg * a + n[0] * (P.wall.back - back), C.up, m[1] + s[1] * sg * a + n[1] * (P.wall.back - back)];
  for (let k = 0; k < 12; k++) { const p = at(); if ((Math.abs(a) < w2 && back < width) || free(p[0], p[2])) break; a *= 0.85; if (k === 11) a = 0; }   // (inside the doorway, in the leaf's own sweep, nothing stands: the walker's grid shuts a body's width off each jamb, and every 5 cm nearer the jamb is 15 cm more of slab at his place)
  // (the fan: its edge on his side grazes his jamb's corner on the team's face; the other grazes the far jamb's — on the team's face from a lamp inside the doorway, on the room's from one past it)
  const wedge = { from: Math.atan2(-w2 - a, a > -w2 ? th + back : back) / R, to: Math.atan2(w2 - a, th + back) / R };
  return { pos: at(), along: sg * a, back, reach: reach(), catches: reach() >= Math.abs(sAl) - C.body, wedge };
}
/** LIFE AT REST (KIT_VIEW_QUIET.idle), `t` s into the beat (pure): how far along the wall the lamp behind the door has slid (m; eased out, held, eased
 *  back) · the share of itself it burns at (the blink) · the share a lamp hung for the beat alone is faded in at · it is over */
export function kitViewIdleAt(t: number, I: { slide: number; out: number; stay: number; blinkAt: number; blink: number; blinkTo: number; fade: number } = KIT_VIEW_QUIET.idle): { x: number; lit: number; env: number; done: boolean } {
  const secs = I.out * 2 + I.stay, ss = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
  const x = t <= I.out ? ss(t / I.out) : t <= I.out + I.stay ? 1 : 1 - ss((t - I.out - I.stay) / I.out);
  return { x: I.slide * x, lit: t >= I.blinkAt && t < I.blinkAt + I.blink ? I.blinkTo : 1, env: Math.max(0, Math.min(1, t / I.fade, (secs - t) / I.fade)), done: t >= secs };
}
/** THE BLADE'S LINE (pure; the plan check's): through a leaf `width` wide hung at the middle of a wall `th` thick and standing `ajar` rad into the room,
 *  from a point lamp `back` m behind the wall's far face and `side` m past the latch's jamb (negative: behind the leaf) — the fan of light that gets
 *  out through the slot between the leaf's free edge and the jamb, clear of the leaf's face and of both jambs: its two edges in degrees off the
 *  door's own line, positive toward the hinge's side. null = no light gets out (the lamp is behind the leaf, or the leaf is to) */
export function kitViewBladeLine(width: number, th: number, ajar: number, back: number, side: number): { from: number; to: number } | null {
  const E: [number, number] = [-width * (1 - Math.cos(ajar)), width * Math.sin(ajar) - th / 2];   // (the free edge: x past the latch's jamb, d behind the wall's far face)
  if (E[1] <= 1e-6 || back <= 1e-6) return null;
  let lo = Infinity, hi = -Infinity; const N = 64;
  for (let i = 1; i < N; i++) { const u = i / N, px = E[0] * u, pd = E[1] * u; if (back - pd <= 1e-6) continue;
    const k = (side - px) / (back - pd), x = (d: number) => px - k * (pd - d);   // (x where the ray is at depth d; k: m toward the hinge per m out)
    if (x(0) > 0 || x(-th) > 0 || x(-th) < -width) continue;   // (the latch's jamb · the hinge's)
    let clear = true; for (let j = 1; j <= 16 && clear; j++) { const d = pd - (pd + th / 2) * j / 16, xl = -width + (d + th / 2) / (E[1] + th / 2) * (E[0] + width); if (x(d) < xl - 1e-9) clear = false; }   // (not through the leaf's own face)
    if (clear) { lo = Math.min(lo, k); hi = Math.max(hi, k); } }
  return hi < lo ? null : { from: Math.atan(lo) / R, to: Math.atan(hi) / R };
}
/** …and whether the beat plays at all (pure): the table's switch, or what a check raised for itself (`KitView.idleOn`; null = the table's) */
export function kitViewIdleOn(raised: boolean | null | undefined = null, I: { on: boolean } = KIT_VIEW_QUIET.idle): boolean { return raised ?? I.on; }
/** …and the seconds of rest before the n-th beat (a fixed list in turn: no dice, and the clock is the game's) */
export function kitViewIdleEvery(n: number, I: { every: readonly number[] } = KIT_VIEW_QUIET.idle): number { return I.every[((n % I.every.length) + I.every.length) % I.every.length]; }

export function kitViewStart(d: KitViewDeps): KitView {
  const { game, engine, cam, input, view, loop } = d, K = KIT_VIEW_LOOP;
  const post = (kv: string) => { try { if (window.parent !== window) window.parent.postMessage({ kv }, kitViewPostTo()); } catch { /* */ } };
  const warmN = (() => { const n = Number(new URLSearchParams(location.search).get('kitview')); return n >= 1 ? Math.floor(n) : KIT_VIEW_STAGE.warm; })();   // (?kitview=N: the warm window, for a check on a slow adapter)
  let state: Exclude<KitView['state'], 'paused'> = 'staging', left = 0, first = true, said = false;
  /** a staging as the loop needs it: the door, the face the team is on and the leaf's angle shut, its foot, a point by [along the wall toward the stack, out
   *  on the team's side, up], the wall's own two directions, the floor spots inside, Sam's slot and its yaw, the teammates BY SLOT (the card switch deals
   *  them again: `rotate`) with the slots and their yaws, the fourth man's place while his card is open and whether he is on it, the weapon lights' own write */
  interface Staged { door: Door | null; kind: 'door' | 'wall' | 'gap'; width: number; reachIn: number; fragM: number; fragLand: number; hole: boolean; plan: KitViewPlanned & { set: string | null }; side: 1 | -1; shut: number; /** the leaf's angle AT REST: `shut`, but on the quiet picture a hand ajar (KIT_VIEW_QUIET.ajarDeg) */ rest: number; /** the quiet picture: where the first teammate rests, crouched behind Sam, while his own card is not the open one */ mate: { p: V2; yaw: number } | null; /** the quiet picture: Sam's rest place · and his place a step back along the wall while a partner's card is the open one (null: he has none) */ samRest: V2; samBack: V2 | null; foot: Vec3; at(o: Vec3): Vec3; s: V2; n: V2; latch: 1 | -1; inside: Vec3[]; smoke: Vec3[]; samSmoke: Vec3; samStun: Vec3; samFrag: Vec3; sam: V2; samYaw: number; order: Guard[]; spots: V2[]; yaws: number[]; act4: V2; four: boolean; torches(): void }
  /** a governed yaw (THE YAWS, below): its value and speed, what the game last wrote, and — owned by the director — the ease it is on */
  interface Chan { v: number; w: number; want: number; own: boolean; from: number; d: number; v0: number; t0: number; T: number; to: number }
  interface Gov { body: Chan; aim: Chan }
  /** a leg of a quiet beat's aim: the yaw, the most speed to it (rad/s), seconds the ease takes at least (< 0: the calls' own for the angle), seconds held there */
  interface Leg { yaw: number; cap: number; minT: number; hold: number }
  /** a teammate's walk: the way points and the one he is on, his pace, when it starts, he is on the yard lane (a card switch: he walks facing the way he goes until he
   *  arrives; any other walk keeps his chest on `face`), the point last sent, his gun's watch, when it was dealt, the yaw he is sent with (absent: his place's own), a card switch dealt it (`rotate`), he holds it on a knee */
  interface Walk { pts: V2[]; k: number; pace: number; at: number; lane: boolean; sent: V2 | null; watch: Vec3 | null; t0: number; face?: number; dealt?: boolean; low?: boolean }
  /** where a man stood: x, z, body yaw, aim yaw — and a staging that keeps the men as they stand: the file's order (team indexes by slot), every teammate's pose, Sam's */
  type Pose = [number, number, number, number];
  interface Keep { perm: number[]; poses: Pose[]; sam: Pose }
  /** a beat under way: its row, the man (null: Sam) and his body, where he lives and its yaw, when it and its phase began, when its mark fired, a count from
   *  before it, where he steps to and throws to, his light is the beat's, the can has left Sam's hand / the squad's order was given, what Sam had in his
   *  hands, the thing thrown (the things that lay there before it) and where it last lay, the brightest transient light drawn, the picture's whiting as the
   *  game had it, a bystander's furthest drift — and its AIM: the channel, the legs and the one it is on, when that one's hold began, the aim is the
   *  director's (a quiet row), the body turns with it (suit / trim), the beam's pitch and whether it has risen, the height the aim point is put at — and the
   *  OTHER men it took off their slots (the stack stood off Sam's charge): each is sent home as it ends, however it ends — and (a
   *  row of the whole team's) the men have been let go of the squad's order: each stands where he is */
  interface Beat extends KitViewBeat { row: Row; /** this beat is the wall charge that opens a blank wall FOR the row asked (begin()) */ prelude: boolean; /** the wall charge's row: its charge is for the span itself (a wall anchor, the first spot asked) */ onSpan?: boolean; man: Guard | null; char: { pos: Vec3; bodyYaw: number; aimYaw: number; id: number }; home: V2; yaw: number; t0: number; pt: number; markT: number; base: number; post: V2 | null; spot: Vec3 | null;
    lit: boolean; thrown: boolean; given: boolean; hand: string; item: { pos: Vec3; fired: boolean } | null; old: WeakSet<object>; rest: Vec3 | null; peak: number; flash: number; drift: number;
    ch: Chan; legs: Leg[]; leg: number; legT: number; quiet: boolean; turn: boolean; pitch: Chan | null; rose: boolean; hTo: number; moved: Guard[]; loose: boolean; fire: Fire | null; shots: number; shotT: number; via: V2 | null }
  /** the gun row's shot: where he stands for it (his own place: `post` IS Beat.home) and the corner his walk turns at, the point the rounds go to, through the opened doorway (no pane) */
  interface Fire { post: V2; via: V2 | null; at: Vec3; door: boolean }
  /** what a row's tick says: still playing · over */
  type Step = 'on' | 'done';
  /** a row of BEATS (calls 0): what it does to the leaf (`shut`: the leaf is pulled to while it plays · `open`: his hand holds it · `none`: the door tools'
   *  own order has it) · what it leaves that only the dissolve mends (`leaf`: hung again · `world`: a restage) · loud · seconds of rest before it plays
   *  again · seconds of game time at most · begin it (null = begun, else why not: the gun's row plays instead) · each frame before the game's step ·
   *  `team`: the WHOLE team is the squad's own order's for its length (the wall charge: no walk of this page's is dealt over it) */
  interface Row { door: 'shut' | 'open' | 'none'; damage: 'none' | 'leaf' | 'world'; loud?: boolean; team?: boolean; /** it works a LEAF: at a way in with none (a `span`: a blank wall, an open gap) it is refused and the gun's row plays */ leaf?: boolean; /** it needs an OPENING to play through (the light's slice, a throw): at a blank wall still whole the wall charge is blown on the span first — begin() */ opening?: boolean; rest: number; cap: number; start(B: Beat, S: Staged): string | null; tick(B: Beat, S: Staged): Step }
  let staged: Staged | null = null, beat: Beat | null = null, plan: (KitViewPlanned & { set: string | null }) | null = null, handR = false, topY = 2.4;   // (… · the plan staged on · the stack falls RIGHT of the anchor on screen: the frame is mirrored · the height the anchor is framed to)
  // the director's own: the step is not showing · whose card is open (as asked, as it stands) · the thing under its highlight (and the tile's own field: TILES) · the thing asked for NOW
  // and whether the running beat is cut for it · the gun / the light, turn about · no row before this (game time) · beats begun · the cards as last told ·
  // the size as last asked · what the last row broke · the leaf last pulled · Sam's card is owed him
  let paused = false, who = 0, want = 0, hi: string | null = null, hiF: string | null = null, asked: string | null = null, cutNow = false, flip = 0, restUntil = 0, beatN = 0, cards: Record<string, unknown>[] = [], sizeN: number | undefined;
  let dirty: 'leaf' | 'world' | 'hole' | null = null, pulled = -1e9, samCardDue = false, waitT = NaN, samLit = false, homeMen: Guard[] = [], homeUntil = -1, handDue = '';   // (… · since when a row has been waited for · Sam's marker light as the staging set it · the men the last row had off their slots, until when a row of Sam's waited for them before HOME (`home` off) · the hand a row cut THIS frame owes Sam: its key is pressed and has not landed)
  // smoke: when the vent is shut off · a cut can vents nothing until · the game's clock at the last frame and since it (a hand on a leaf is per second) · when this frame's work began (the pace)
  let ventAt = -1, ventKill = -1, stepT = 0, stepDt = 0;
  let pin: object | null = null, pinT = 0, kneelT = 0; const knees = new Map<Guard, number>();   // THE HOLD (Sam's frag): the row it is on for · the game's time after() last ran it · since when the team is on a knee · each man's knee as it last stood
  let homeT = NaN, kneel: object | null = null, fleeM = NaN;   // HOME: since when a row of Sam's has waited for the men · the row that has the team on a knee · frag.ts FRAG.fleeM as the game had it (held at 0 through Sam's frag)
  let beamDir: Vec3 | null = null;   // the lit man's beam this frame (the director's own line: torches() writes it after the step)
  let wandKit: { k: { wand: boolean }; was: boolean } | null = null;   // a teammate's wand row: his staged card and what it carried as the row found it
  let fogUp = false, wandWas = false, apart = false, tubeWas = -2;   // the wand's row has the fog of war ON for the game (lifted for every draw) · Player.wand as its row found it · the men a row left far off their places go back ONTO them under the dissolve · the load a launcher's row found on Sam's tube (Rifle.attIdx; -2: none taken), put back as it ends
  const swaps: { man: Guard; id: string; at: number }[] = [];   // teammates' guns on their way in (swapGun)
  const issued = { suit: new Map<number, Vec3>(), trim: new Map<number, Vec3>() };   // a member's colours as the scenario staged him (his card as issued)
  // the dissolve: '' none · 'ask' the copy is owed at the end of this frame's draw · 'work' taken: the work runs before the next step · 'settle' frames
  // drawn under it · 'fade' — the work, frames left, copies made, works done with no copy, when the fade ends (the wall clock: it is CSS)
  const dz = { phase: '' as '' | 'ask' | 'work' | 'settle' | 'fade', work: [] as (() => void)[], left: 0, n: 0, cuts: 0, end: 0 };
  let veil: HTMLCanvasElement | null = null;
  const pacer = kitViewPacer(); let paceLoad = '';   // (… · the render scale and tier the pacer last saw: the quality ladder's hand on the load)
  let samCone: { inner: number; outer: number; vol: number } | null = null;   // Sam's weapon light as the game has it (the staging dims it; his light beat puts it back)
  const lamps: { porch: RtLight | null; fill: RtLight | null } = { porch: null, fill: null }; let dayOut: string[] = []; let fixture: Box | null = null, sky: { zenith: Vec3; horizon: Vec3 } | null = null;
  let frameAsk: { cx: number; cy: number; h: number; w: number; man: number; door?: number; left?: number; right?: number; keep?: number; top?: number; bottom?: number } | null = null;
  let look: Vec3 = [0, 1, 0], yaw = 0, pitch = KIT_VIEW_STAGE.pitch, dist = 11;
  let doorway: V2[] = [];   // the door's two jambs: kept inside the window with the five places (the door and its lamp are part of the picture)
  let stand: V2[] = [];   // the way's FIVE places, taken or not: what the camera is framed on — ONE framing per way, whatever the team's size (men come and go in their slots; nothing else moves)
  // THE QUIET PICTURE (KIT_VIEW_QUIET): the link's kind, switch and all · it is STAGED (place(): that kind, and its pool lamp lit) · the pool lamp as a
  // lamp of the game's · the level's lamps it put out, by name · the room's lamps it dimmed, each as authored · its own lamp behind the door · the share
  // the room burns at · the fill as staged and since when it is lifted · the loop's next rest · a leaf asked shut for a waiting row until · the gun last
  // put away at · why the quiet row of the last tile gave way to the loud one · the half crouch (0 = down)
  const quietKind = (() => { try { return kitViewQuietOf(new URLSearchParams(location.search)); } catch { return null; } })();
  let Q = false, pool: LightTarget | null = null, qOut: string[] = [], qIn: LightTarget[] = [], qOwn: RtLight | null = null, qShare = 1, qBlade = 1, fillBase = 0, liftAt = NaN, restNext = NaN, leafAsk = -1, stowT = -1e9, qKept: string | null = null, qRise = 0, lastEnd = -1e9, qMoon: RtLight | null = null, moonAt = 0, moonCol: Vec3 | null = null, qFit: { lamp: Vec3; sam: V2 } | null = null, qLead: boolean | null = null;
  const qRoofs = new Set<Box>();   // (the roof slabs drawn for the quiet picture: KIT_VIEW_QUIET.roofs)
  const lampAs = new WeakMap<LightTarget, { I: number; E: Vec3; on: boolean }>();
  const base = new WeakMap<RtLight, number>();   // a room light's / the moon's intensity as the game has it (what `roomLights` / `moonScale` multiply)

  d.audio.enabled = false; d.audio.setVolumes();
  window.__pauseLoop = false;   // (`?paused` rides a Deploy's query like any flag of the visit: the picture's own loop runs all the same)
  // nothing but the picture is made: no HUD, bubbles, hotkeys or mixer work under a frame nobody sees them on, no tour or attract programme, no verdict
  // books, par or debrief card (a beat's men could end a 'mission': main.ts step files nothing in this mode; `postUpdate` here REPLACES the page's, which
  // is where its card opens). STILL: the world is frozen for good. THE LOOP: it runs, and the two seams left are the director's — before the step (a throw
  // there ends the beat in a restage under the dissolve) and after it
  const threw = (err: unknown) => { console.error('kitview: a beat threw —', err); try { if (beat) finish(beat, 'threw'); game.puppet = null; if (!dz.work.length) dissolve(() => restage()); } catch (e2) { console.error('kitview: …and could not be taken down —', e2); dead?.(); } };
  loop.frozen = () => !kitViewLoop || state === 'none' || state === 'staging'; loop.afterFreeze = undefined; loop.hud = null; loop.bubbles = null; loop.audio = null; loop.demo = null; loop.attract = null;
  loop.hotkeys = () => { if (!kitViewLoop) return; try { before(); } catch (err) { threw(err); } };
  loop.postUpdate = () => { if (!kitViewLoop) return; try { after(); } catch (err) { threw(err); } };
  /** the copy of the frame just drawn, laid over the game's canvas (in the task that drew it) — false: none to be had */
  const copy = (): boolean => { try {
    const v = veil ??= (() => { const c = document.createElement('canvas'); c.id = 'kv-veil'; c.style.cssText = 'position:fixed;pointer-events:none;z-index:1'; (view.parentElement ?? document.body).appendChild(c); return c; })();
    const r = view.getBoundingClientRect(), g = v.getContext('2d'); if (!g || !(view.width > 0 && view.height > 0)) return false;
    if (v.width !== view.width || v.height !== view.height) { v.width = view.width; v.height = view.height; }
    g.globalCompositeOperation = 'copy'; g.drawImage(view, 0, 0);
    Object.assign(v.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transition: 'none', opacity: '1' }); v.style.setProperty('display', 'block', 'important');   // (index.html hides all but the canvas in this mode, !important: so is this)
    dz.n++; return true; } catch { return false; } };
  const veilOff = () => { dz.phase = ''; veil?.style.setProperty('display', 'none', 'important'); };
  const veilTick = () => {
    if (dz.phase === 'ask') { dz.phase = 'work'; if (!copy()) dz.cuts++; }
    else if (dz.phase === 'settle' && --dz.left <= 0) { dz.phase = 'fade'; dz.end = performance.now() + K.dissolveMs; if (veil) { void veil.offsetWidth; veil.style.transition = `opacity ${K.dissolveMs}ms linear`; veil.style.opacity = '0'; } }
    else if (dz.phase === 'fade' && performance.now() >= dz.end) veilOff();
  };
  const draw = loop.render;
  loop.render = (c, t, dt, present) => {
    if (kitViewLoop) {   // LIVE: every frame the pace lets through, for good
      if (state === 'none') { V.skipped++; return; }
      for (const l of engine.lights.lights) if (l.ttl >= 0) { if (l.intensity > K.flashMax) l.intensity = K.flashMax; if (beat && l.enabled) beat.peak = Math.max(beat.peak, l.intensity); }   // (after the lights' own update, which writes a flash's envelope: the ceiling is on what is drawn)
      stroke();
      const lift = fogUp && game.fogOfWar.active; if (lift) game.fogLift(true);   // (the wand's row: the fog is the game's for its length — its door row is offered only under it — and never the picture's: the engine replay's own lift, between two steps)
      try { draw(c, t, dt, present); } finally { if (lift) game.fogBack(); } V.drawn++;
      if (!said && staged && V.drawn >= Math.min(KIT_VIEW_STAGE.ready, warmN)) { said = true; post('ready'); }
      veilTick();
      { const load = `${engine.settings.renderScale}/${String((window as unknown as { __quality?: { current?: unknown } }).__quality?.current)}`; if (load !== paceLoad) { if (paceLoad) pacer.eased(); paceLoad = load; } }   // (the ladder runs in here — main.ts samples it on every worked frame, `adaptive` on — and reads a pace stepped down as a slow frame: what it cuts is load taken off, so the pacer's used-up tries are given back)
      return;
    }
    if (state !== 'warm') { V.skipped++; return; }
    draw(c, t, dt, present); V.drawn++;
    if (first && !said && V.drawn >= Math.min(KIT_VIEW_STAGE.ready, warmN)) { said = true; post('ready'); }
    if (--left <= 0) { state = 'held'; first = false; if (!said) { said = true; post('ready'); } post('held'); }
  };


  /** lightning tamed (KIT_VIEW_LOOP.strokeK): the weather's stroke is a directional light with NO lifetime, so the ceiling above never saw it. After the
   *  game's step has written its envelope, before the draw: the light cut to the ceiling and the sky's flash (weather.ts: the light's intensity × a
   *  constant, written in the same step) by the same share. A second pass over a frame not stepped finds the light at the ceiling and changes nothing */
  const strokes = new WeakSet<RtLight>();
  const stroke = () => {
    let cap = -1;
    for (const l of engine.lights.lights) {
      if (!(l.transient && l.ttl < 0 && l.enabled)) continue;
      if (cap < 0) { let night = 0; for (const m of engine.lights.lights) if (m.kind === 2 && m.enabled && !m.transient && m.ttl < 0) night = Math.max(night, m.intensity); cap = night > 0 ? night * K.strokeK : K.strokeMin; }
      if (!strokes.has(l)) { strokes.add(l); V.stroke.n++; }
      V.stroke.raw = Math.max(V.stroke.raw, l.intensity); V.stroke.cap = cap;
      if (l.intensity > cap) { const k = cap / l.intensity, W = (engine as unknown as { weather?: { flash?: number[] } }).weather; l.intensity = cap;
        if (W?.flash) W.flash = [W.flash[0] * k, W.flash[1] * k, W.flash[2] * k]; }
      V.stroke.drawn = Math.max(V.stroke.drawn, l.intensity);
    }
  };
  const ops = () => d.team().filter(g => g.state !== 'dead');
  /** the men as they stand, for `__kitview.men` */
  const men = (order: Guard[]): KitViewMan[] => {
    const p = game.player, row = (name: string, c: { pos: Vec3; bodyYaw: number }, gun: string, light: boolean, slot: number): KitViewMan => ({ name, x: +c.pos[0].toFixed(2), z: +c.pos[2].toFixed(2), yaw: Math.round(c.bodyYaw / R), gun, light, slot });
    return [row('Sam', p.char, p.rifleUp ? 'rifle' : p.pistolUp ? 'pistol' : 'hands', !!p.light?.enabled, 0),
      ...ops().map(g => row(g.callsign, g.char, g.weapon.def.id, !!g.flashlight?.enabled, order.indexOf(g) + 1))];
  };
  /** the boxes the way's `hide` / `hidePaint` name, out of the picture: sunk under the ground (this instance is thrown away; a box is not taken out of the
   *  world, whose authored count a restart cuts back to) */
  const sunk = new WeakSet<Box>(); let sunkN = 0;
  const sink = (idx: readonly number[]) => {
    const W = engine.world; let n = 0, x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const i of idx) { const b = game.level.boxes[i]; if (!b || sunk.has(b) || W.statics[i] !== b) continue;   // (index for index the level's boxes head the world's: one that is not is left alone)
      const r = Math.hypot(b.h[0], b.h[2]); x0 = Math.min(x0, b.c[0] - r); x1 = Math.max(x1, b.c[0] + r); z0 = Math.min(z0, b.c[2] - r); z1 = Math.max(z1, b.c[2] + r);
      sunk.add(b); b.c[1] -= 30; n++; }
    // (…and off the FLOOR: the nav grid asks its bake's own question again where they stood — collision tests a box where it is, so a sunk one shuts no cell.
    //  A restart that mends a blown wall rebakes the whole world the same way: the floor is then what it was from the first frame)
    if (n) { sunkN += n; W.staticsDirty = true; W.repackMarkings(); game.col.nav.rebake(x0, z0, x1, z1); game.col.sound.invalidate(); }
  };
  /** …and THE LOOSE PROPS the plan takes with them (kitViewPlan `hiddenProps`: indexes into the file's props, which are the game's — game/props.ts
   *  PropSystem.all): off the props' own list (its remove(): not drawn, not solid, not stepped — a blast's own way of taking one). ITS reset() stands every
   *  prop back (the encounter's restart, mend() below), so this is called again after each: place() and mend(). Never seen on a page */
  const dropProps = (P: KitViewPlanned | null) => { if (P) for (const i of P.hiddenProps) { const p = game.props.all[i]; if (p) game.props.remove(p); } };
  /** THE PLAN of a way (host/kitViewPlan.ts), made ONCE per page and on the floor as the GAME has it (`free` = its own nav grid): first what is out of the
   *  picture — the way's `hide` / `hidePaint` and whatever stands between the camera and the men, less its `show` — is sunk and taken off the grid, then
   *  the way is planned on the floor that leaves. A way on a bespoke SET is planned from the set's own records (kitPlanGeometry: box i of the set is box i
   *  of the level main.ts built). THE CHILD NEVER LAYS A WAY'S `add`: its records ARE the level that was built, so they hold every piece the page laid in
   *  (main.ts bootLevel over kitViewSet.ts kitViewAddLevel) — and where the world lacks one (the bundled office's Level carries no `laid` word; a piece of a
   *  `lived.*` group with the lived-in rooms off; an office file that fell back to the built-in one; a link whose mission staged another way than the page
   *  laid) the plan must lack it too: laid here by id, the plan had a box the world did not, and every index after it was another box's. Said once.
   *  null: no file records, or a set the block does not have */
  const plans = new WeakMap<object, KitViewPlanned & { set: string | null }>();
  const planFor = (Y: KitViewWay, block: { sets?: NonNullable<NonNullable<Game['level']['scenarios']>['kitView']>['sets'] } | undefined): (KitViewPlanned & { set: string | null }) | null => {
    const had = plans.get(Y); if (had) return had;
    const F = d.file(), sam = game.player.char.pos, G = F ? kitPlanGeometry(F, block, kitPlanWayBuilt(Y), [sam[0], sam[2]]) : null; if (!G) return null;
    if (Y.add && Y.set === undefined) { const has = new Set([...G.level.boxes.map(b => b.id), ...(G.level.lights ?? []).map(l => l.id)]), not = [...(Y.add.boxes ?? []), ...(Y.add.lamps ?? [])].filter(o => !has.has(o.id)).map(o => o.id);
      if (not.length) console.warn(`kitview: this way's \`add\` writes ${not.length} piece(s) the built level does not have (${not.slice(0, 4).join(', ')}): not in the picture — left out by the stand, or the page laid another way's`); }
    const free = (x: number, z: number) => !game.col.nav.isBlocked(x, z);
    const P = { ...kitViewPlanChild(G.level, Y, G.ref, free, sink), set: G.set };   // (both passes, and the first's problem of a non-thing occluder kept: kitViewPlan.ts — an authored `hide` wins outright there)
    if (P.problems.length) console.warn(`kitview: the plan of this way in has ${P.problems.length} problem(s) (__kitview.plan.problems; tools/qa/kitview-plan.ts) —\n  ${P.problems.join('\n  ')}`);   // (once per way: the plan is made once)
    plans.set(Y, P); return P;
  };
  /** THE WAY IN the scenario that is up staged its team on, whatever its KIND (a room clear: its own `way`; a rescue, the night breach: the level's one
   *  start, way 0) — and whether that 'mission' has ended. A QUIET mission, and a SOLO one (the plain night: the link asks for no scenario and none is up):
   *  way 0 with the men that mission has — Sam and its one partner, or Sam alone; its team is the mission's own and no `kit` message resizes it (`fixed`).
   *  A scenario the link asked for that did not start: no picture */
  const asksNone = (() => { try { const q = new URLSearchParams(location.search); return !['roomclear', 'rescue', 'nightbreach', 'quiet', 'squad4'].some(k => q.has(k)); } catch { return false; } })();
  const stagedWay = (): { active: boolean; way: number; ended: boolean; fixed?: boolean } => {
    // (ENDED is each kind's own RECORD of an end, read by its name and type: a room clear's `end`, a rescue's `result`. Never a guess at a field — read as
    //  'whatever `.end` holds', a rescue's was its own METHOD end(): 'ended' on every frame, the room staged again on every frame and no row ever begun.
    //  The night breach and the quiet mission keep no end of their own: a man down is theirs, and before() sees that)
    const rc = game.roomClear;
    return rc.active ? { active: true, way: rc.way, ended: rc.end !== null } : game.rescue.active ? { active: true, way: 0, ended: game.rescue.result !== null } : game.nightBreach.active ? { active: true, way: 0, ended: false }
      : game.quiet?.active ? { active: true, way: 0, ended: false, fixed: true } : { active: asksNone, way: 0, ended: false, fixed: true };
  };
  /** the yaw of a character held through the one posing step (the AI and the player's own aim both write it), then left as a plain value */
  const holdYaw = (c: object, y: number, on: boolean) => { for (const k of ['bodyYaw', 'aimYaw']) Object.defineProperty(c, k, on ? { configurable: true, enumerable: true, get: () => y, set: () => { /* held */ } } : { configurable: true, enumerable: true, writable: true, value: y }); };

  /** the camera on the men: the worked-out (or authored) pin, moved and scaled to where a `frame` message wants them */
  const aim = () => {
    if (view.clientWidth > 0 && view.clientHeight > 0) cam.aspect = view.clientWidth / view.clientHeight;
    let L: Vec3 = [look[0], look[1], look[2]], D = dist; const F = frameAsk, M = stand;
    if (Q && qFit) {   // THE QUIET PICTURE is framed for one subject (KIT_VIEW_QUIET.frame): the lamp's fixture and his boots at their heights down the clear column, his spine across it
      const QF = KIT_VIEW_QUIET.frame, top = F?.top ?? 1, bot = F?.bottom ?? -1, lf = F?.left ?? -1, rt = F?.right ?? 1, yAt = (t: number) => top + (bot - top) * t, xAt = lf + (rt - lf) * (handR ? 1 - QF.spine : QF.spine);
      const th = Math.tan(cam.fov / 2), sam = qFit.sam;
      L = [sam[0], 1, sam[1]];
      for (let i = 0; i < 12; i++) {
        cam.target = L; cam.yaw = yaw; cam.pitch = pitch; cam.distance = cam.desiredDistance = D; cam.rebuild();
        const pl = cam.project(qFit.lamp, 2, 2), pb = cam.project([sam[0], 0, sam[1]], 2, 2), ps = cam.project([sam[0], 0.5, sam[1]], 2, 2), B = cam.planarBasis();
        const k = (pb[1] - pl[1]) / Math.max(0.05, yAt(QF.lamp) - yAt(QF.boots)), ey = 1 - pb[1] - yAt(QF.boots), ex = ps[0] - 1 - xAt;
        const mx = ex * D * th * cam.aspect, mz = ey * D * th / Math.max(0.2, Math.sin(pitch));
        L = [L[0] + B.right[0] * mx + B.fwd[0] * mz, L[1], L[2] + B.right[2] * mx + B.fwd[2] * mz];
        D = Math.min(60, Math.max(4, D * Math.min(2, Math.max(0.5, k))));
      }
    } else if (F && M.length) {
      const th = Math.tan(cam.fov / 2), R = KIT_VIEW_STAGE.body, Rx = KIT_VIEW_STAGE.reach;
      const hung = F.door !== undefined && F.left !== undefined && F.right !== undefined && doorway.length === 2, dm: Vec3 = hung ? [(doorway[0][0] + doorway[1][0]) / 2, 1, (doorway[0][1] + doorway[1][1]) / 2] : [0, 0, 0];
      for (let i = 0; i < (hung ? 12 : 6); i++) {
        cam.target = L; cam.yaw = yaw; cam.pitch = pitch; cam.distance = cam.desiredDistance = D; cam.rebuild();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const m of M) for (const y of [0, 1.9]) for (const [ox, oz] of [[-R, 0], [R, 0], [0, -R], [0, R]]) { const p = cam.project([m[0] + ox, y, m[1] + oz], 2, 2); x0 = Math.min(x0, p[0] - 1); x1 = Math.max(x1, p[0] - 1); y0 = Math.min(y0, 1 - p[1]); y1 = Math.max(y1, 1 - p[1]); }
        for (const j of doorway) for (const y of [0, topY]) { const p = cam.project([j[0], y, j[1]], 2, 2); x0 = Math.min(x0, p[0] - 1); x1 = Math.max(x1, p[0] - 1); y0 = Math.min(y0, 1 - p[1]); y1 = Math.max(y1, 1 - p[1]); }
        const a0 = cam.project([L[0], 0, L[2]], 2, 2), a1 = cam.project([L[0], 1.9, L[2]], 2, 2), tall = Math.abs(a1[1] - a0[1]) / 2;   // a standing man at the look point, as a share of the height
        const h = (y1 - y0) / 2, w = (x1 - x0) / 2, ey = (y0 + y1) / 2 - F.cy, B = cam.planarBasis();
        let ex = (x0 + x1) / 2 - F.cx, k = Math.max(h / Math.max(0.05, F.h), w / Math.max(0.05, F.w), tall / F.man);
        if (hung) {   // hung on the door: its line at `door`, the places' reach inside `left` … `right`; the men no bigger than the fit above (the men's middle: the picture as it was) and no smaller than `keep` of it — then the places are held at `left`
          let r0 = Infinity, r1 = -Infinity; for (const m of M) for (const y of [0, 1.9]) for (const [ox, oz] of [[-Rx, 0], [Rx, 0], [0, -Rx], [0, Rx]]) { const p = cam.project([m[0] + ox, y, m[1] + oz], 2, 2); r0 = Math.min(r0, p[0] - 1); r1 = Math.max(r1, p[0] - 1); }
          const dx = cam.project(dm, 2, 2)[0] - 1, room = Math.max(0.02, F.right! - F.left!);
          const Fd = handR ? F.left! + F.right! - F.door! : F.door!;   // (THE HAND: the stack right of the anchor on screen — the plan's `hand` — and the frame is mirrored in its own column: the anchor's line at left + right − door, the room on its left)
          const forDoor = Math.max((dx - r0) / Math.max(0.02, Fd - F.left!), (r1 - dx) / Math.max(0.02, F.right! - Fd));
          k = Math.max(k, (r1 - r0) / room, Math.min(forDoor, k / Math.min(1, Math.max(0.5, F.keep ?? 1))));
          const kk = Math.min(2, Math.max(0.5, k)); ex = dx - (handR ? Math.min(Fd, F.right! - (r1 - dx) / kk) : Math.max(Fd, F.left! + (dx - r0) / kk));   // (where the door comes to once the distance is scaled: at `door`, or as far right of it as the places' left reach needs)
        }
        const mx = ex * D * th * cam.aspect, mz = ey * D * th / Math.max(0.2, Math.sin(pitch));   // (the look point slid right moves the men left; slid forward, down)
        L = [L[0] + B.right[0] * mx + B.fwd[0] * mz, L[1], L[2] + B.right[2] * mx + B.fwd[2] * mz];
        D = Math.min(60, Math.max(4, D * Math.min(2, Math.max(0.5, k))));
      }
    }
    cam.setPin({ look: L, yaw, pitch, dist: D });
  };

  /** everybody who is not the team, far off, dark and held (as `__stage` parks) — and CALM: what is in the air is numbered and behind him (guards.ts
   *  hearingCheck's own rule), his state, awareness and fix as a man who heard nothing (a beat's bang carries 80 m), DEAF to what the step itself makes —
   *  and THE DEVICES INERT (kitViewInert): kitViewPark, above */
  const park = (staging = false) => { const r = kitViewPark(game); if (!staging) { V.roused.men += r.men; V.roused.alarms += r.alarms; } };   // (`staging`: place()'s own — the men as the mission or a restart stood them up are nobody roused)
  const none = () => { V.men = []; staged = null; state = 'none'; dz.work.length = 0; veilOff(); post('none'); };
  /** `expect` = the team's size a `kit` message asked for: a team the game did not make that size is not the picture of those tiles · `head` = the
   *  teammate whose card is open (the loop's actor): stood FIRST at the door, since the man on the jamb is the man who works the
   *  door · `keep` = the men as they stood before a restart (a restage under the dissolve): the file's order and each man's two yaws — WHO is where in the
   *  stack, never an off-slot place: every man is put ON his slot (10-15: put back where he stood, a man a row of Sam's had frozen short of his slot, or
   *  one who had run from a grenade, was staged there again and never came home; `home` off: where he stood, as it was) */
  /** the pool lamp's box, by its index in the world's statics AS THEY NOW STAND (the game writes a target's boxes by index each step: a restart, a
   *  mended world or a blown wall re-lays the list) */
  const poolSync = () => { if (!pool) return; const i = fixture ? engine.world.statics.indexOf(fixture) : -1; pool.boxes = i >= 0 ? [i] : []; if (lamps.porch) pool.light = lamps.porch; };
  /** THE ROOM BEHIND THE DOOR burns at this share of itself (the quiet picture: KIT_VIEW_QUIET.inside at rest; 1 = as the mission lights it — the seam
   *  a loud tool's cost floods it by): each lamp's own base, which the game multiplies each step, and its fixture's glow */
  const quietInside = (k: number, blade = 1) => { qShare = k; qBlade = blade; for (const t of qIn) { const a = lampAs.get(t); if (!a) continue; t.on = true; t.baseIntensity = a.I * k; t.baseEmissive = [a.E[0] * k, a.E[1] * k, a.E[2] * k]; }
    if (qOwn) qOwn.intensity = qOwn.peakIntensity = KIT_VIEW_QUIET.own.intensity * blade; };   // (…and the picture's own lamp behind the leaf at `blade` of itself: the cost's — brighter through the gap, then out under the slab)
  /** …and as the mission had them (before a restart, at the picture's end: a base is the lamp's own, and no restart puts it back) */
  const quietUndo = () => { for (const t of qIn) { const a = lampAs.get(t); if (a) { t.baseIntensity = a.I; t.baseEmissive = [a.E[0], a.E[1], a.E[2]]; } } qIn = []; if (pool) pool.boxes = [];
    if (qRoofs.size) { for (const b of qRoofs) b.flags |= BoxFlag.NoPrimary; qRoofs.clear(); engine.world.staticsDirty = true; }
    if (qLead !== null) { FIXLOOK.on = qLead; qLead = null; } };
  const stage = (expect?: number, head?: Guard | null, keep?: Keep | null) => { try { place(expect, head, keep); if (kitViewLoop && staged) live(staged); } catch (err) { console.error('kitview: the team could not be staged —', err); none(); } };
  const place = (expect?: number, head?: Guard | null, keep?: Keep | null) => {
    state = 'staging'; staged = null; dayOut = [];
    const SW = stagedWay(); if (!SW.active) { V.door = null; plan = null; none(); return; }   // (no scenario started: nothing here is the mission's way in)
    const way = SW.way, KV = game.level.scenarios?.kitView, Y: KitViewWay | undefined = KV?.ways?.[way], team = ops();
    const P = Y ? planFor(Y, KV) : null, A = P?.anchor, door = A && A.door !== null ? game.doors.byName(A.door) ?? null : null;
    V.way = way; V.door = A?.door ?? null; V.blocked = 0; plan = P; dropProps(P);
    // (no block for this way, no file records, a door the level does not have, a span too short to stand at, a team the game did not make the size asked: no picture)
    if (!Y || !P || !A || (A.kind === 'door' ? !door : !(A.width >= 0.4)) || (expect !== undefined && team.length !== expect)) { none(); return; }
    // THE LIGHT: the table, the way's own keys over it, and the lamps WHERE THE PLAN HANGS THEM (the porch lamp off the wall's measured face and under its
    // top — no box where there is no wall to carry one; the fill over the free floor in front, and where the plan had to pull it in — a narrow hall, a yard
    // 3 m deep — dimmed by the square of that, as a lamp brought nearer is brighter). A way on a SET keeps the set's own lamps lit (`roomLights` 1 unless written)
    const T = KIT_VIEW_LIGHT, O = Y.light ?? {};
    // (THE QUIET PICTURE is staged where the link's kind is quiet AND its pool lamp burns — by day, on a way that does not write `light.porch.day`, there
    //  is no pool to cut him out against or to shoot: the picture as it was)
    const QK = KIT_VIEW_QUIET, qLamp = quietKind !== null ? kitViewQuietLamp(P, O.porch) : null;
    Q = !!qLamp && kitPlanPorchLit(qLamp.intensity, qLamp.day, P.indoors, d.lampsOut()) > 0; qOut = []; qIn = []; qShare = 1; liftAt = NaN; qRise = 0;
    const porch: KitViewLight['porch'] = Q ? { ...qLamp! } : { ...T.porch, ...(O.porch ?? {}), offset: P.lamps.porch.offset, aim: P.lamps.porch.aim };
    porch.intensity = kitPlanPorchLit(porch.intensity, porch.day, P.indoors, d.lampsOut());   // (BY DAY the lamp is out with the level's own outside lamps, unless the way writes `light.porch.day`; the glowing box hangs only on a lit lamp, below)
    if (P.lamps.porch.fixture && T.porch.fixture) porch.fixture = { ...T.porch.fixture, ...(O.porch?.fixture ?? {}), at: P.lamps.porch.fixture.at }; else delete porch.fixture;
    const fill: KitViewLamp = { ...T.fill, ...(Q ? QK.fill : {}), ...(O.fill ?? {}), offset: P.lamps.fill.offset, aim: P.lamps.fill.aim };
    if (O.fill?.intensity === undefined && P.src['fill.offset'] === 'derived') { const k = (P.lamps.fill.offset[1] - P.wall.face) / KIT_PLAN.fillOut; if (k < 0.999) fill.intensity *= Math.max(0, k) * Math.max(0, k); }
    const lightK: KitViewLight = { ...T, ...(Q ? { moonScale: QK.moonScale, skyScale: QK.skyScale } : {}), ...O, porch, fill, sam: { ...T.sam, ...(Q ? { on: false } : {}), ...(O.sam ?? {}) }, roomLights: Y.roomLights ?? O.roomLights ?? (P.set !== null ? 1 : T.roomLights) };
    const kept = ['exterior', 'player', 'flashlights', 'transient', 'weather', 'kitview', ...P.keepLights];   // (…and the yard's own lamps under the open sky, whatever their group is called: the plan's `keepLights`)
    const own = (l: RtLight) => l.ttl < 0 && l.kind !== 2 && !kept.includes(l.group);   // a light of the building's own rooms
    game.fogOfWar.on = false; game.fogOfWar.viewer = false; game.fogOfWar.reset(); fogUp = false; wandKit = null;   // (new men, new cards: nothing of the old row's to put back)
    park(true);
    const lit0 = Q ? new Set(game.targets.filter(t => t.on)) : null;   // (the quiet picture: the lamps burning as the mission has them, before the rooms go dark below)
    if (lightK.roomLights <= 0) for (const grp of new Set(engine.lights.lights.filter(own).map(l => l.group))) game.setGroup(grp, false);   // (the game's own switch, before the posing step: the lamps and their glowing fixtures go out together)
    // (BY DAY THE WAY'S OWN LAMPS ARE OUT TOO — its set's lights, its `add.lamps`, less its `dayLights`: kitPlanDayOut. Their groups are in `kept`, and the
    //  game's photocell opens only the level's `exterior` fixtures: a set's gate lamp burned at noon with its box glowing. Each lamp's OWN switch — by id,
    //  never its group's: an added lamp may share one with the level's lamps —, the switch the photocell itself opens: the lamp and its fixture's glow go
    //  out together. Every restage: the encounter's restart puts the level's switches back as authored. Never seen on a GPU)
    dayOut = kitPlanDayOut(kitPlanOwnLamps(KV, Y), (P.set !== null ? KV?.sets?.[P.set]?.boxes : d.file()?.boxes) ?? [], Y.dayLights, P.indoors, d.lampsOut());   // (the boxes a lamp may stand under: the set's own, or the level's as built — a lamp under a ceiling is a room's and burns)
    if (dayOut.length) for (const t of game.targets) if (t.kind === 'analytic' && dayOut.includes(t.name)) t.on = false;
    // (THE QUIET PICTURE'S OWN LAMPS: one pool and no other light on the team's side — every lamp of the level's that stands on their side of the wall
    //  and reaches the door's foot goes out, by its own switch, the lamp and its fixture's glow together; and the ROOM behind the door burns low: the
    //  lamps behind the wall that reach the doorway, lit as the mission has them, at KIT_VIEW_QUIET.inside of themselves — quietInside(). The
    //  encounter's restart puts the switches back; the dimmed lamps are put back by hand: unhang())
    if (Q) { const m = A.mid, n = A.n, outOf = (p: Vec3) => (p[0] - m[0]) * n[0] + (p[2] - m[1]) * n[1], dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const foot: Vec3 = [m[0] + n[0] * (P.wall.face + KIT_PLAN.offFace), 1, m[1] + n[1] * (P.wall.face + KIT_PLAN.offFace)], wedge: Vec3 = [m[0] + n[0] * (P.wall.back - KIT_PLAN.litIn), KIT_PLAN.litY, m[1] + n[1] * (P.wall.back - KIT_PLAN.litIn)];
      for (const t of game.targets) { const L = t.light; if (t === pool || t.kind !== 'analytic' || !L || L.kind === 2) continue;
        const o = outOf(t.pos);
        if (o >= P.wall.back) { if (t.on && dist(t.pos, foot) <= L.range) { t.on = false; qOut.push(t.name); } }
        else if (lit0!.has(t) && dist(t.pos, wedge) <= Math.min(L.range, KIT_PLAN.litReach)) { if (!lampAs.has(t)) lampAs.set(t, { I: t.baseIntensity, E: [t.baseEmissive[0], t.baseEmissive[1], t.baseEmissive[2]], on: t.on }); qIn.push(t); } }
      quietInside(QK.inside);
      // (THE ROOF STAYS ON — KIT_VIEW_QUIET.roofs: the slabs the camera looks through, drawn where they lie wholly behind the wall and the team stands
      //  under the sky. The flag is the box's own and no restart writes it: put back by quietUndo(), with the dimmed lamps)
      { const Wd = engine.world; for (const i of kitViewQuietRoofs(game.level.boxes, P)) { const b = game.level.boxes[i]; if (Wd.statics[i] !== b) continue; b.flags &= ~BoxFlag.NoPrimary; qRoofs.add(b); }   // (index for index the level's boxes head the world's: one that is not is left alone)
        if (qRoofs.size) Wd.staticsDirty = true; } }
    // the slots: the men as staged
    const file = [...team], all0 = d.team();
    const keptMen = keep ? keep.perm.map(i => all0[i]).filter(g => g && team.includes(g)) : [];   // (the file as it stood, by team index: a restart makes new men)
    const order = keep ? [...keptMen, ...file.filter(g => !keptMen.includes(g))] : head && file.includes(head) ? [head, ...file.filter(g => g !== head)] : file;
    const nav = game.col.nav, W = { s: P.s, n: A.n, mid: A.mid };
    // THE PLACES are the plan's five (an authored one as written, the stack's spread to the picture's spacing; the rest measured on the game's own floor):
    // the camera is framed on all five, the men take the first of them
    doorway = [[A.a[0], A.a[1]], [A.b[0], A.b[1]]]; stand = P.slots.map((p): V2 => [p[0], p[1]]); handR = P.hand === 'right'; topY = P.wall.top > 0 ? Math.min(KIT_PLAN.porchUp, P.wall.top) : 1.9;
    const slots = P.slots.slice(0, order.length + 1);
    // (THE QUIET PICTURE'S REST: Sam crouched by the pool, a partner behind him — kitViewQuietPlaces; a place the level wrote, or a worked-out one that is
    //  not free floor, leaves the plan's. The camera stays framed on the plan's five)
    const qAt = Q ? kitViewQuietPlaces(P, order.length, (x, z) => !nav.isBlocked(x, z)) : null, mate0 = qAt?.mate && order[0] && order[0] !== head ? qAt.mate : null;
    const samRest: V2 | null = qAt?.sam ? [qAt.sam[0], qAt.sam[1]] : null;
    if (qAt?.sam) { slots[0] = head && qAt.back ? qAt.back : qAt.sam; stand.push([qAt.sam[0], qAt.sam[1]]); if (mate0 || (qAt.mate && order[0])) stand.push([qAt.mate![0], qAt.mate![1]]); }   // (…and the camera is framed on the rest places too: the partner's fell off the window's edge)
    for (const p of slots) if (nav.isBlocked(p[0], p[1])) V.blocked++;
    if (P.slotSrc.slice(0, order.length + 1).some(x => x === 'derived')) V.blocked += P.stepped;   // (the worked-out line's steps count only where a man took one of its places)
    const chars: [object, number][] = [];
    { const k = keep?.sam; game.teleportPlayer(k && !V.home ? [k[0], 0, k[1]] : [slots[0][0], 0, slots[0][1]]); game.player.char.aimPitch = 0; chars.push([game.player.char, k ? k[2] : slots[0][2] * R]); }
    order.forEach((g, i) => { const p = i === 0 && mate0 ? mate0 : slots[i + 1], k = keep?.poses[all0.indexOf(g)]; g.char.pos = k && !V.home ? [k[0], 0, k[1]] : [p[0], 0, p[1]]; g.char.aimPitch = 0; g.hold = true; g.pinned = true; chars.push([g.char, k ? k[2] : p[2] * R]); });
    game.player.rifle.lightOn = game.player.pistol.lightOn = samLit = lightK.sam.on;
    // (the quiet picture: he is DOWN, his gun put away — the pose's own fields, written as a card writes his hand; and the leaf a hand ajar, by the
    //  game's own hand on it, before the posing step so that a still picture has it too. A way-in door found locked is simply unlocked, as every row
    //  that works it does: this instance of the level is thrown away)
    const shut0 = door ? door.angle : 0;
    if (Q) { const pl = game.player, an = pl.char.anim as unknown as { crouch: number; crouchTarget: number }; pl.crouch = true; pl.holstered = true; an.crouch = an.crouchTarget = 1;
      if (door && !door.off) { (door as { locked: boolean }).locked = false; game.doors.crack(door, [slots[0][0], 0, slots[0][1]], pl.char.id, 1, undefined, QK.ajarDeg * R, QK.ajarDeg * R); } }
    // ONE zero-length step, hands off the controls: nothing advances, the men are posed where and how they now stand (main.ts refreshFrozenStill)
    for (const [c, y] of chars) holdYaw(c, y, true);
    input.keys.clear(); input.buttons = 0;
    try { game.update(0, input, cam, view); } finally { for (const [c, y] of chars) holdYaw(c, y, false); }
    if (keep) { const P = game.player.char, set = (c: { aimYaw: number }, k?: Pose) => { if (k) c.aimYaw = k[3]; }; set(P, keep.sam); order.forEach(g => set(g.char, keep.poses[all0.indexOf(g)]));   // (each man's gun where it pointed)
      for (const g of order) (g.char as unknown as { update(dt: number): void }).update(1e-4); }   // (…and his turn weight begun FROM there: a new man's first weighed frame takes his AI's first step whole — 5 rad/s of it, a snap of some degrees in a man caught turning)
    // the lights, after the step (the game writes each weapon light in it; a still picture is frozen from here and one write holds): the teammates' off, Sam's dim and tight at the
    // foot of the door, the building's own turned down, the night raised, the two lamps hung
    const at = (o: Vec3): Vec3 => [W.mid[0] + W.s[0] * o[0] + W.n[0] * o[1], o[2], W.mid[1] + W.s[1] * o[0] + W.n[1] * o[1]];
    const unit = (a: Vec3, b: Vec3): Vec3 => { const v: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / len, v[1] / len, v[2] / len]; };
    const torches = () => {   // (…and again after every step of the loop: the game writes them in each. A light beat's man burns his own for its length)
      const lit = !!beat?.lit, L = game.player.light, Ks = lightK.sam;
      for (const g of order) { const on = lit && beat!.man === g; g.flashlight.enabled = on; if (on) { g.flashlight.intensity = g.flashlight.peakIntensity = KIT_VIEW_LOOP.beam; if (beamDir) g.flashlight.dir = beamDir; } }   // (its place is the gun's own; its line the director's: aims())
      if (!L) return;
      samCone ??= { inner: L.innerDeg, outer: L.outerDeg, vol: L.volumetric };
      if (lit && !beat!.man) { L.enabled = true; L.intensity = L.peakIntensity = KIT_VIEW_LOOP.beam; L.innerDeg = samCone.inner; L.outerDeg = samCone.outer; L.volumetric = samCone.vol; if (beamDir) L.dir = beamDir; }   // (its place is the gun's own; its line the director's)
      else if (!Ks.on) L.enabled = false;
      else { L.dir = unit(L.pos, at(Ks.aim)); L.intensity = L.peakIntensity = Ks.intensity; L.innerDeg = Ks.innerDeg; L.outerDeg = Ks.outerDeg; L.volumetric = Ks.volumetric; }
    };
    torches();
    for (const l of engine.lights.lights) { if (!own(l)) continue; if (!base.has(l)) base.set(l, l.intensity); l.intensity = base.get(l)! * lightK.roomLights; }
    if (Q) for (const t of qIn) if (t.light) { t.light.enabled = t.on && !t.broken; t.light.intensity = t.baseIntensity; }   // (a still picture is frozen from here: the dim room written once, as the game writes it each step)
    { const moon = engine.lights.lights.find(l => l.name === 'moon' && l.kind === 2), S = engine.settings;
      if (moon && !base.has(moon)) base.set(moon, moon.intensity); sky ??= { zenith: [S.skyZenith[0], S.skyZenith[1], S.skyZenith[2]], horizon: [S.skyHorizon[0], S.skyHorizon[1], S.skyHorizon[2]] };
      if (moon) { moonCol ??= [moon.color[0], moon.color[1], moon.color[2]]; const t = Q ? QK.moonTint : [1, 1, 1]; moon.color = [moonCol[0] * t[0], moonCol[1] * t[1], moonCol[2] * t[2]]; }   // (the quiet picture's moon is blue: over its own colour, put back on every other staging)
      qMoon = null;
      if (moon && moon.enabled && base.get(moon)! > 0) { moon.intensity = base.get(moon)! * lightK.moonScale; if (Q) { qMoon = moon; moonAt = moon.intensity; } const k = lightK.skyScale; S.skyZenith = [sky.zenith[0] * k, sky.zenith[1] * k, sky.zenith[2] * k]; S.skyHorizon = [sky.horizon[0] * k, sky.horizon[1] * k, sky.horizon[2] * k]; } }
    for (const who of ['porch', 'fill'] as const) { const K: KitViewLamp = lightK[who], P = at(K.offset);
      const rec = { kind: K.kind, pos: P, dir: unit(P, at(K.aim)), color: [K.color[0], K.color[1], K.color[2]] as Vec3, intensity: K.intensity, peakIntensity: K.intensity, range: K.range, innerDeg: K.innerDeg, outerDeg: K.outerDeg, radius: K.radius, volumetric: K.volumetric, broad: K.broad, enabled: K.intensity > 0 };
      const had = lamps[who]; if (had && engine.lights.lights.includes(had)) Object.assign(had, rec);
      else lamps[who] = engine.lights.add({ name: `kitview_${who}`, group: 'kitview', owner: 0, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, ...rec }); }
    { const F = lightK.porch.fixture, world = engine.world;   // the porch lamp's glowing box on the wall (a restart cuts the world back to its authored boxes: put again)
      if (fixture && world.statics.includes(fixture)) { world.statics.splice(world.statics.indexOf(fixture), 1); world.staticsDirty = true; } fixture = null;
      if (F && lightK.porch.intensity > 0) { const c = lightK.porch.color; fixture = d.glowBox(at(F.at), [F.half[0], F.half[1], F.half[2]], Math.atan2(W.s[1], W.s[0]), [c[0] * F.glow, c[1] * F.glow, c[2] * F.glow]); world.addStatic(fixture); } }
    // (THE QUIET PICTURE: the pool lamp is a LAMP OF THE GAME'S — over the light and the glowing box just hung, so that Sam's round puts it out as it
    //  puts out any fixture, and a restart's repairLights mends it; and behind the door a small warm lamp of the picture's own:
    //  the blade on his floor. The fill as staged is what the dark's lift multiplies)
    fillBase = lamps.fill ? lamps.fill.intensity : 0;
    { const had = pool, i = had ? game.targets.indexOf(had) : -1;   // (ONE target for the page's life: it stays on the game's list through a restart, so the game's own repairLights is what mends it)
      if (Q && lamps.porch) { const c = lightK.porch.color, g = lightK.porch.fixture?.glow ?? 0, T2 = kitViewPoolTarget(lamps.porch, -1, [c[0] * g, c[1] * g, c[2] * g], lightK.porch.intensity);
        if (had && i >= 0) { had.pos = T2.pos; had.light = T2.light; had.baseEmissive = T2.baseEmissive; had.baseIntensity = T2.baseIntensity; had.on = true; } else { pool = T2; game.targets.push(T2); }
        poolSync(); }
      else { if (i >= 0) game.targets.splice(i, 1); pool = null; }
      const O2 = QK.own, wantOwn = Q && A.kind !== 'wall', hung = qOwn && engine.lights.lights.includes(qOwn) ? qOwn : null;
      if (!wantOwn) { if (hung) engine.lights.remove(hung); qOwn = null; }
      else { const lt = door ? ((A.mid[0] - door.def.hinge[0]) * W.s[0] + (A.mid[1] - door.def.hinge[1]) * W.s[1] >= 0 ? 1 : -1) : 0;   // (which way along the wall the leaf's free edge is; a gap: its middle)
        const p = at([lt * (A.width / 2 + O2.side), P.wall.back - O2.back, O2.up]), rec = { kind: 0 as const, pos: p, dir: [0, -1, 0] as Vec3, color: [O2.color[0], O2.color[1], O2.color[2]] as Vec3, intensity: O2.intensity, peakIntensity: O2.intensity, range: O2.range, innerDeg: 0, outerDeg: 180, radius: O2.radius, volumetric: 0, broad: false, enabled: true };
        if (hung) Object.assign(hung, rec); else qOwn = engine.lights.add({ name: 'kitview_inside', group: 'kitview', owner: 0, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, ...rec }); } }
    // the camera: into the wall, turned toward the stack; at the middle of the men
    V.men = men(order);
    look = [P.cam.look[0], P.cam.look[1], P.cam.look[2]]; yaw = P.cam.yaw; pitch = P.cam.pitch; dist = P.cam.dist;   // (the plan's pin: the way's own `pin`, else into the wall, turned toward the stack, at the middle of the five places)
    qFit = Q && lamps.porch ? { lamp: fixture ? [fixture.c[0], fixture.c[1], fixture.c[2]] : [lamps.porch.pos[0], lamps.porch.pos[1], lamps.porch.pos[2]], sam: samRest ?? [slots[0][0], slots[0][1]] } : null;
    aim();
    engine.resetTaa('kitview');
    { const side = door ? d.doorSide(door, [slots[0][0], 0, slots[0][1]]) : 1;   // (of Sam's slot)
      const inside: Vec3[] = [];   // (the far side of the anchor's line from the team: the second number of `at` is OUT on the team's side)
      const foot = at([0, 0, 0]), latch = door ? ((foot[0] - door.def.hinge[0]) * W.s[0] + (foot[2] - door.def.hinge[1]) * W.s[1] >= 0 ? 1 : -1) : 1;   // (which way along the wall the leaf's free edge is)
      // (HOW FAR IN a can or a round may go: the plan's free floor behind the anchor's line — a door, a gap: `inside`; a blank wall: what a hole opens onto,
      //  `beyond` past its far face. A spot is kept only this side of it, a hand short; a room shallower than every spot gets one at its middle)
      const reachIn = A.kind === 'wall' ? P.beyond - P.wall.back : P.inside, fits = (m: number) => m <= reachIn - 0.3;
      const spots = (list: readonly number[]) => { const o: Vec3[] = []; for (const m of [...list.filter(fits), ...(list.some(fits) || reachIn < 0.8 ? [] : [reachIn / 2])]) for (const k of K.inAlong) { const p = at([k * latch, -m, 0]); if (!nav.isBlocked(p[0], p[2])) o.push(p); } return o; };
      inside.push(...spots(K.inM));
      const smoke: Vec3[] = spots(K.smokeM);   // (smoke, thrown short: KIT_VIEW_LOOP.smokeM)
      const a4 = kitPlanAct4(A.mid, W.s, W.n, A.width, P.slots, (x, z) => !nav.isBlocked(x, z));   // (the fourth man's place while his card is open: at Sam's jamb, on Sam's side of the door — and a body clear of every other man's place: at a wide opening, slid toward its middle)
      const fragM = Math.max(0.6, Math.min(K.samFragM, reachIn - 0.5)), fragLand = Math.min(K.fragLand, Math.max(0.3, fragM - 0.5));
      holeShots = 0; staged = { door, kind: A.kind, width: A.width, reachIn, fragM, fragLand, hole: false, plan: P, side, shut: shut0, rest: door ? door.angle : 0, mate: qAt?.mate && order[0] ? { p: [qAt.mate[0], qAt.mate[1]], yaw: qAt.mate[2] * R } : null, foot, at, s: W.s, n: W.n, latch, inside, smoke, samSmoke: at([0, -K.samSmokeM, 0]), samStun: at([0, -K.samStunM, 0]), samFrag: at([0, -fragM, 0]), sam: [slots[0][0], slots[0][1]], samRest: samRest ?? [slots[0][0], slots[0][1]], samBack: qAt?.back ? [qAt.back[0], qAt.back[1]] : null, samYaw: slots[0][2] * R, order, spots: order.map((_, i): V2 => [slots[i + 1][0], slots[i + 1][1]]), yaws: order.map((_, i) => slots[i + 1][2] * R), act4: a4, four: false, torches }; }
    V.again();
  };

  // ------------------------------------------------------------ the loop
  const tools = () => game.doorTools, onDoor = (S: Staged): OrderTarget => ({ kind: 'door', at: [S.foot[0], 0, S.foot[2]], door: S.door!, side: S.side });   // (a `leaf` row's: begin() refuses those where there is no door)
  // THE LEAF, WHERE THERE IS ONE (a way anchored on a `span` has none — a blank wall to breach, an open gap): a hand on it, how wide it stands, whether it is
  // ajar, a lock found on it — each nothing, open, never and none without a leaf, so a row that only goes THROUGH the opening plays at a gap as it is.
  // A row that WORKS the leaf says so (`Row.leaf`) and is refused there. A blank WALL is no opening until it is blown (`Staged.hole`: the wall charge's row)
  const crack = (S: Staged, B: Beat, wide: number) => { if (S.door) game.doors.crack(S.door!, B.char.pos, B.char.id, stepDt, undefined, K.swing, wide); };
  const wideOpen = (S: Staged, wide: number) => !S.door || Math.abs(S.door!.angle - S.shut) >= wide - 0.1;
  const isAjar = (S: Staged) => !!S.door && !S.door!.off && Math.abs(S.door!.angle - S.shut) >= 0.03;
  /** not yet SHUT for a row that works a shut leaf: ajar — or, on the quiet picture, where the leaf rests ajar and is pulled to for such a row, still
   *  on its way (a frag's thrower reads how the leaf turns under the shove: a leaf still being pulled to was no shut door to him, and he kept the grenade) */
  const leafWait = (S: Staged) => isAjar(S) || (S.rest !== S.shut && !!S.door && !S.door!.off && (!S.door!.latched || S.door!.closing));
  const offRest = (S: Staged) => !!S.door && !S.door!.off && Math.abs(S.door!.angle - S.rest) >= 0.03;   // (the leaf is not where it rests: `rest` is `shut` but on the quiet picture)
  const unlock = (S: Staged) => { if (S.door) (S.door as { locked: boolean }).locked = false; };
  const walled = (S: Staged) => S.kind === 'wall' && !S.hole;
  /** per way (its plan): why its blank wall would not open on its span — a wall charge that slid off it, a blast that left no hole, one that came down
   *  unblown (wallRow): read by every row that needs the opening · `shutOwn`: why the wall charge's OWN tile is not played on this way again — every exit of
   *  its row with the charge unblown, every refusal of its order judged from the men's own places (the gun's row from then on, the reason in `refused`: no
   *  second walk out, no second charge taken down). A charge that never went off ON THE SPAN shuts both: the two rows set it on the same spot */
  const shutWall = new WeakMap<object, string>(), shutOwn = new WeakMap<object, string>();
  /** the wall charge's row is over with nothing blown (or was refused): remembered for this way */
  const wallKept = (S: Staged, B: Beat, no: string) => { const P = S.plan as object; if (!shutOwn.has(P)) shutOwn.set(P, no); if ((B.prelude || (S.kind === 'wall' && B.onSpan)) && !shutWall.has(P)) shutWall.set(P, no); };
  const roster = (g: Guard) => game.orders.squad().indexOf(g);   // (orders.ts Who: a number names ONE man)
  const floor = (p: Vec3): OrderTarget => ({ kind: 'floor', at: [p[0], 0, p[2]] });
  /** the smoke CANS venting (combat.ts startCanister: a 'vent' or a 'canister' emitter — the list also holds muzzle jets, wisps, a stun's burst, dust puffs) */
  const cans = () => ((game.smoke as unknown as { emitters?: { kind?: string; age: number; ttl: number }[] }).emitters ?? []).filter(e => e.kind === 'vent' || e.kind === 'canister');
  const shutCans = () => { for (const e of cans()) e.ttl = Math.min(e.ttl, e.age); };
  /** the men's own legs off a live grenade (frag.ts fragFlee, run by guards.ts before any order, script or hold: nothing of the squad's can keep a man on his
   *  slot against it) are held for the length of SAM'S frag row by the game's own knob — FRAG.fleeM, the distance inside which a man in its line moves, read
   *  off the page's knob registry and put back as the row ends. In this page only: the grenade is watched instead (the row's own tick takes it away if it did not go in) */
  const fragKnob = () => { try { return (window as unknown as { __knobs?: { registry(): Record<string, { fleeM?: number; destrM?: number; lift?: number } | undefined> } }).__knobs?.registry().FRAG; } catch { return undefined; } };
  const stay = (on: boolean) => { if (!on) { pin = null; knees.clear(); } const F = fragKnob(); if (!F || typeof F.fleeM !== 'number') return; if (on) { if (isNaN(fleeM)) fleeM = F.fleeM; F.fleeM = 0; } else if (!isNaN(fleeM)) { F.fleeM = fleeM; fleeM = NaN; } };
  /** A TEAMMATE'S STUN FINDS NOBODY OF THE TEAM, SAM TOO (a page run, 10-16: one turn in a dozen of a teammate's bang at the records office's front door had
   *  a line from the can to Sam's head — the game's own rule then blinds and folds him, whoever threw it: samstun.ts SAMSTUN.ownSeen, "a bad entry flashes
   *  you". after() put the stamps out the same frame, but he had already been knocked by it — Character.hitFrom — on his place beside the door). For as long
   *  as a teammate's stun row runs or a teammate's can lies unfired, the game's own knob is held off — read off the page's knob registry and put back, as
   *  FRAG.fleeM is — so the door tools' own rule for a man stood on the stack's side of the door who heard 'bang out' (doortools.ts bang: `spare`) is Sam's
   *  as it is every teammate's. SAM'S OWN can is the game's rule untouched: thrown badly it finds him, and `hits.sam` says so. In this page only */
  let seenWas: boolean | undefined;
  const stunKnob = () => { try { return (window as unknown as { __knobs?: { registry(): Record<string, { ownSeen?: boolean } | undefined> } }).__knobs?.registry().SAMSTUN; } catch { return undefined; } };
  const spareSam = (on: boolean) => { const T = stunKnob(); if (!T || typeof T.ownSeen !== 'boolean') return; if (on) { if (seenWas === undefined) seenWas = T.ownSeen; T.ownSeen = false; } else if (seenWas !== undefined) { T.ownSeen = seenWas; seenWas = undefined; } };
  const matesCan = () => (game.items.items as unknown as { kind: string; fired: boolean; who: number }[]).some(it => it.kind === 'flash' && !it.fired && it.who !== game.player.char.id);
  /** SAM'S FRAG, AIMED THROUGH THE GATE: the leaf held open stands in the room on the hinge's side, so the way in is between the latch jamb and the leaf's
   *  free edge — the grenade is aimed from his hand (the game's own solved arc starts there) through the MIDDLE of that gap, to `samFragM` inside, each frame
   *  until it leaves. True once the arc the game has solved first lands `fragLand` m inside (it meets no jamb and no leaf on the way) */
  const fragAim = (B: Beat, S: Staged): boolean => { const pv = game.player.throwPreview as { points: Vec3[]; land: Vec3 } | null, o = pv?.points[0]; if (!pv || !o || !game.puppet) return false;
    const D = S.door, gate = (): V2 | null => { if (!D || D.off) return null; const a = D.def.closedDir + D.angle, W = D.def.width, H = D.def.hinge, J: V2 = [H[0] + Math.cos(D.def.closedDir) * W, H[1] + Math.sin(D.def.closedDir) * W], T: V2 = [H[0] + Math.cos(a) * W, H[1] + Math.sin(a) * W]; return outOf(S, T) < 0 ? [(J[0] + T[0]) / 2, (J[1] + T[1]) / 2] : null; };
    const M: V2 = gate() ?? [S.foot[0], S.foot[2]], oo = outOf(S, [o[0], o[2]]), mo = outOf(S, M); if (oo - mo < 0.2) return false;   // (a leaf that opens toward the team stands out of the opening, and a gap has none: its middle)
    const k = (oo + S.fragM) / (oo - mo), spot: Vec3 = [o[0] + (M[0] - o[0]) * k, 0, o[2] + (M[1] - o[2]) * k];
    B.spot = spot; game.puppet.throwAt = spot;
    return outOf(S, [pv.land[0], pv.land[2]]) <= -S.fragLand; };
  /** a burst at `p` has a line to SAM as he is (frag.ts exposedTo, as blast() judges him: from `lift` over the grenade, glass that is going counted open) */
  const reachesSam = (p: Vec3): boolean => { try { const c = game.player.char, head = (c.bones as unknown as { head?: Vec3 }).head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]]; return exposedTo(game, [p[0], p[1] + (fragKnob()?.lift ?? 0.2), p[2]], c.pos, head, 'blown') > 0; } catch { return false; } };
  /** a blast at `p` would take the leaf off its hinges (destruction.ts doorsFor: read only) */
  const takesLeaf = (S: Staged, p: Vec3): boolean => { try { const L = (game.destr as unknown as { doorsFor?(at: Vec3, o: { radius: number; power: number }): unknown[] }).doorsFor?.(p, { radius: fragKnob()?.destrM ?? 2.5, power: 1 }); return !!S.door && !!L && L.includes(S.door); } catch { return false; } };
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const yawTo = (a: Vec3, b: Vec3) => Math.atan2(b[0] - a[0], b[2] - a[2]), off = (a: number, b: number) => Math.abs(wrap(a - b));
  const flat = (a: Vec3, p: V2) => Math.hypot(a[0] - p[0], a[2] - p[1]);
  const num = (v: unknown) => Math.max(0, Math.floor(Number(v)) || 0);
  const to = (B: Beat, phase: string) => { B.phase = phase; B.pt = game.time; };
  const mark = (B: Beat, word: string) => { B.marks.push(word); if (isNaN(B.markT)) B.markT = game.time; };
  /** a point's place by the door: along the wall toward the stack, out from its line on the team's side */
  const along = (S: Staged, p: V2) => (p[0] - S.foot[0]) * S.s[0] + (p[1] - S.foot[2]) * S.s[1], outOf = (S: Staged, p: V2) => (p[0] - S.foot[0]) * S.n[0] + (p[1] - S.foot[2]) * S.n[1];
  /** the angle (rad, 0 … 90°) a yaw makes with the wall's line */
  const wallAngle = (S: Staged, y: number) => Math.acos(Math.min(1, Math.abs(Math.sin(y) * S.s[0] + Math.cos(y) * S.s[1])));

  // THE YAWS (the owner, 10-14: "kind of jerky" — his recording: the gun and torso stepped 30° in four frames as a beat began, 45° in six with a jump of
  // the body as it ended). A TEAMMATE already comes round as a mass — the game's own turn weight (character.ts TURN: his AI's yaws are wishes, the drawn
  // ones are stepped to them under a rate and an acceleration) — but at 630°/s for the gun and 400°/s for the body: live() sets that weight, in this page,
  // to KIT_VIEW_LOOP.gunRate / bodyRate with a `ramp` to reach them (the page's own `?turn=` switch, through main.ts). SAM has no turn weight (the player's
  // aim is an exponential, his body 9 rad/s): his character's `bodyYaw` / `aimYaw` are accessors over a channel here — what the game writes is what it
  // WANTS, what it (and the drawer) reads is the channel's value, which chases the writes under the same two rates. And the director never steps an aim
  // POINT: a quiet beat's is on a channel of its own, eased by a minimum-jerk curve from where the gun points to the target and back (`own`)
  const chan = (y: number): Chan => ({ v: y, w: 0, want: y, own: false, from: y, d: 0, v0: 0, t0: 0, T: 0, to: y });
  const govs = new WeakMap<object, Gov>();
  const govern = (c: object): Gov => {
    const o = c as { bodyYaw: number; aimYaw: number }, G: Gov = { body: chan(o.bodyYaw), aim: chan(o.aimYaw) }; govs.set(c, G);
    for (const [k, ch] of [['bodyYaw', G.body], ['aimYaw', G.aim]] as const) Object.defineProperty(c, k, { configurable: true, enumerable: true, get: () => ch.v, set: (y: number) => { if (Number.isFinite(y)) ch.want = y; } });
    return G;
  };
  const easeT = (a: number) => a <= 45 * R + 1e-6 ? K.ease[0] : K.ease[1];
  /** the channel to `to`, eased from where and how fast it is, never faster than `cap` (rad/s): at least `minT` seconds (< 0: the calls' own for the angle) */
  const own = (ch: Chan, to: number, cap: number, minT = -1) => {
    if (ch.own && off(to, ch.to) < 0.2 * R) return;
    const d = wrap(to - ch.v), a = Math.abs(d);
    ch.own = true; ch.to = to; ch.from = ch.v; ch.d = d; ch.v0 = ch.w; ch.t0 = game.time; ch.T = Math.max(0.05, minT < 0 ? easeT(a) : minT, 1.875 * a / cap, 2 * K.ramp * Math.abs(ch.w) / cap);
  };
  const letGo = (ch: Chan) => { if (ch.own) { ch.own = false; ch.want = ch.v; } };
  const arrived = (ch: Chan) => ch.own && game.time >= ch.t0 + ch.T;
  const chanTick = (ch: Chan, cap: number, dt: number) => {
    if (ch.own) { const u = (game.time - ch.t0) / ch.T;
      if (u >= 1) { ch.v = ch.from = wrap(ch.from + ch.d); ch.d = 0; ch.w = 0; ch.v0 = 0; return; }
      const u2 = u * u, u3 = u2 * u, u4 = u3 * u, u5 = u4 * u;
      ch.v = ch.from + ch.d * (10 * u3 - 15 * u4 + 6 * u5) + ch.v0 * ch.T * (u - 6 * u3 + 8 * u4 - 3 * u5);
      ch.w = ch.d / ch.T * (30 * u2 - 60 * u3 + 30 * u4) + ch.v0 * (1 - 18 * u2 + 32 * u3 - 15 * u4); return; }
    if (!(dt > 0)) return;
    const dd = wrap(ch.want - ch.v), acc = cap / K.ramp, vt = Math.sign(dd) * Math.min(cap, Math.sqrt(2 * acc * Math.abs(dd)));   // (a trapezoid: up to the rate, and down in time to stop on it)
    ch.w += Math.max(-acc * dt, Math.min(acc * dt, vt - ch.w));
    const st = ch.w * dt; if (Math.abs(dd) < 1e-4) { ch.v = wrap(ch.v + dd); ch.w = 0; } else if (st * dd > 0 && Math.abs(st) >= Math.abs(dd)) { ch.v = wrap(ch.v + dd); ch.w = dd / dt; } else ch.v = wrap(ch.v + st);
  };
  let samCh: Chan = chan(0), samH = 0, yawT = 0, samAt = NaN;   // Sam's aim as the director has it: the yaw his aim POINT is put on, and its height · his rest aim, written to his governed channel after the step (NaN: a row of his own hands has it)

  /** a teammate to a mark, at a walk, turned to `face` — his gun on `watch`, or (none) at the low ready: the squad's own hand-over (SquadOrders.assign, under
   *  'cover': a row with no tick of its own and no unasked cover dealt over it), which takes him off whatever had him. `strafe`: his chest kept on `face`
   *  all the way — a step back, a side step (the game's walker otherwise turns him down his path first, and creeps the way he faces while he turns) */
  const send = (man: Guard, p: V2, face: number, watch: Vec3 | null = null, pace = K.pace, strafe = true, crouch = false) => game.orders.assign(man, { order: 'cover', post: [p[0], 0, p[1]], face, strafe, watch, stance: watch ? 'none' : 'lowReady', upper: watch ? 'aim' : 'none', going: '', there: '', pace, crouch });
  /** where a man lives between beats and how he is turned there: his slot — the fourth man (across the door), while his card is open, a place at Sam's jamb */
  const homeOf = (S: Staged, g: Guard): { p: V2; yaw: number } => { const k = S.order.indexOf(g); if (k === 0 && S.mate && actor() !== g) return S.mate;   // (the quiet picture: the partner rests behind Sam; his own card open, he is at the plan's place by the door)
    return { p: k === 3 && S.four ? S.act4 : S.spots[k] ?? [g.char.pos[0], g.char.pos[2]], yaw: S.yaws[k] ?? g.char.bodyYaw }; };
  // THE WALKS: where every teammate is going, kept by the squad's hand-over — sent when it changes, and again whenever he is found with no order of this
  // kind (Game.puppet — Sam's beats — takes every order away each step it is set; a door order cut short leaves its own on him). A man with no order of
  // his own drifts after Sam (a staged man's `hold` / `pinned` is only "nothing moves until the first order")
  const walk = new Map<Guard, Walk>();
  /** HOME, every frame (KIT_VIEW_LOOP.homeM): a man the running row has NOT placed — not its actor, none of the men it moved (the stack's step back, number
   *  two closing up) — has ONE walk: to his place, on his feet, whatever dealt him another or took his order (a knee is the row's that asked it: `kneel`) */
  const placed = (g: Guard) => beat ? beat.man === g || beat.moved.includes(g) : apart && homeMen.includes(g);   // (…and the men a whole-team row left stood off down the wall are ITS until the dissolve stands them again: the hole is looked at with them where they stood, undo())
  const homeward = (S: Staged, g: Guard) => { if (!V.home || placed(g)) return; const H = homeOf(S, g).p, W = walk.get(g), L = W?.pts[W.pts.length - 1];
    if (!W || !L || Math.hypot(L[0] - H[0], L[1] - H[1]) > 1e-3) go(g, [H]); else if (!!W.low !== lowAt(S, g) && !(beat && kneel === beat)) low(g, lowAt(S, g)); };
  /** the quiet picture: the partner rests on a knee behind Sam (his own card open, he stands at the door as every card's man does) */
  const lowAt = (S: Staged, g: Guard) => Q && !!S.mate && S.order[0] === g && actor() !== g;
  const go = (g: Guard, pts: V2[], pace = K.pace, delay = 0, lane = false) => { walk.set(g, { pts, k: 0, pace, at: game.time + delay, lane, sent: null, watch: null, t0: game.time }); };
  const walks = (S: Staged) => {
    if (game.puppet) { for (const g of S.order) g.hold = true; return; }   // (Sam's beat: every order is taken away each step — each man stands where he is, and is sent on as it ends: with no order and no hold he drifted after Sam)
    if (beat && beat.row.team && !beat.loose) return;   // (the squad's own order has every man: the wall charge)
    for (const g of S.order) { if (beat && beat.man === g && beat.row.door === 'none') continue;   // (the door tools' own order has him)
      homeward(S, g); const W = walk.get(g); if (!W) continue;
      if (game.time < W.at) { if (V.home && game.orders.of(g)?.order !== 'cover') send(g, [g.char.pos[0], g.char.pos[2]], g.char.bodyYaw); continue; }   // (a walk not yet due: he STANDS for it — a man fresh from a restart has the scenario's own order until his first, and drifted after Sam for the shuffle's quarter second)
      if (W.k < W.pts.length - 1 && flat(g.char.pos, W.pts[W.k]) <= K.wayM) { W.k++; W.sent = null; }
      const q = W.pts[W.k], A = game.orders.of(g);
      if (W.lane && W.k === W.pts.length - 1 && flat(g.char.pos, q) <= K.onSlot) W.lane = false;
      if (!A || A.order !== 'cover' || W.sent !== q) { send(g, q, W.face ?? homeOf(S, g).yaw, W.watch, W.pace, !W.lane, !!W.low); W.sent = q; } }
  };
  /** down on a knee, or up: the squad's own word on his order (orders.ts Assignment.crouch: he walks it, and holds it, on a knee) — kept on his walk, so an order sent again has it */
  const low = (g: Guard, on: boolean) => { const W = walk.get(g), A = game.orders.of(g); if (W) W.low = on; if (A && A.order === 'cover') A.crouch = on; };
  /** the open card's man is still on his way to the head of the file (a card just opened): his thing begins as he arrives. SAM's card: no row of his begins
   *  while a man's walk has yet to arrive (Game.puppet — every row of Sam's — holds each walking man where he stands: opened mid-switch, one was left out in
   *  the yard lane for the whole row) — a walk the SWITCH dealt, that is: a man on the half step home from his own row, cut as your card opened, is not waited
   *  for (it held Sam's row up to `swapSecs`). Either way for `swapSecs` at most from when the walk was dealt */
  const arriving = (S: Staged) => { const m = actor(); if (m) { const W = walk.get(m); return !!W && W.lane && game.time - W.t0 < K.swapSecs; }
    return S.order.some(g => { const W = walk.get(g); return !!W && !!W.dealt && game.time - W.t0 < K.swapSecs && (W.k < W.pts.length - 1 || flat(g.char.pos, W.pts[W.pts.length - 1]) > K.onSlot + 0.1); }); };
  /** THE CARD SWITCH (the owner, 10-14: "switching between squad members should have them swap places in the stack"): no restage — the SAME men walk. Two
   *  lanes, so nobody crosses anybody: the man whose card opened steps OUT a lane (KIT_VIEW_LOOP.lane m into the yard, on a diagonal), walks up at
   *  `swapPace` and cuts in at the head slot; the men ahead of his old slot each step BACK one, facing the door, rearmost first (`shuffle`: the first
   *  after …, then every … s). From wherever they stand: another card opened mid-swap is the same rule again. Sam never moves; the fourth man (behind
   *  Sam, across the door) does not cross it — he steps round Sam's yard side to `act4` and back when his card shuts */
  const rotate = (S: Staged, m: Guard | null) => {
    const P = (p: V2, a: number, o: number): V2 => [p[0] + S.s[0] * a + S.n[0] * o, p[1] + S.s[1] * a + S.n[1] * o], ok = (p: V2) => !game.col.nav.isBlocked(p[0], p[1]);
    { const g = S.order[3], act = !!g && g === m; if (g && S.four !== act) { S.four = act; const round = P(S.sam, 0, K.round); go(g, ok(round) ? [round, act ? S.act4 : S.spots[3]] : [act ? S.act4 : S.spots[3]], K.pace, 0, act); walk.get(g)!.dealt = true; } }
    const nS = Math.min(3, S.order.length), j = m ? S.order.indexOf(m) : -1; if (!m || j <= 0 || j >= nS) return;
    const was = S.order.slice(), stack = was.slice(0, nS); stack.splice(j, 1); stack.unshift(m); S.order = [...stack, ...was.slice(nS)];
    const laneOut = outOf(S, S.spots[0]) + K.lane; let rank = 0;
    for (let k = nS - 1; k >= 0; k--) { const g = S.order[k]; if (was[k] === g) continue; const T = S.spots[k], p: V2 = [g.char.pos[0], g.char.pos[2]];
      if (g === m) { const a = P(p, -K.cutIn, laneOut - outOf(S, p)), b = P(T, K.cutIn, K.lane); go(g, ok(a) && ok(b) && along(S, a) > along(S, b) ? [a, b, T] : ok(b) ? [b, T] : [T], K.swapPace, 0, true); }
      else { const b = P(T, 0, K.lane); go(g, outOf(S, p) > outOf(S, T) + 0.3 && ok(b) ? [b, T] : [T], K.pace, K.shuffle[0] + K.shuffle[1] * rank++); }
      walk.get(g)!.dealt = true; }
  };

  /** the pools a beat spends, from the cards (a count on a card is carried: its beat can always play again) — the squad's one bag (doortools.ts, squadsmoke.ts,
   *  the wall charges) and Sam's own belt where his card has the tile. `f`: the thing about to play has one at least (a tile's demo plays at a count of 0
   *  too — the owner: a dead cursor is what he complained of; the number is the tile's job) */
  const pools = (f?: string) => {
    const T = tools(), n = staged ? staged.order.length : 0, sum = (k: string, from = 1) => { let s = 0; for (let i = from; i <= n; i++) s += num(cards[i]?.[k]); return Math.max(s, k === f ? 1 : 0); };
    T.sync(); T.bangs = sum('bangs'); T.charges = sum('charges'); T.frags = sum('frags'); d.smoke(sum('smoke'));
    (game.wallCharge as unknown as { setCarried?(n: number): void }).setCarried?.(sum('walls', 0));
    const c = cards[0] ?? {}, pl = game.player, mine = d.tiles(0), one = (k: string) => Math.max(num(c[k]), k === f ? 1 : 0);
    const has = (k: string) => mine.includes(k) || k === f;   // (the tile being played: he is handed one for it whatever his card says — the picture's own game only)
    if (has('smoke')) pl.canisters = one('smoke'); if (has('bangs')) pl.flashbangs = one('bangs'); if (has('frags')) pl.frags = one('frags'); if (has('shells')) pl.rifle.shells = one('shells');
    if (has('rings') && pl.rifle.attachments.includes('ring')) pl.rifle.rings = one('rings');   // (the sponge rounds: a row of the tree's card — kittree.ts; with it off no card has the tile and nothing is written)
    if (has('cams') && one('cams') > 0 && pl.rifle.attachments.includes('ring')) { pl.rifle.cams = one('cams'); if (!pl.rifle.attachments.includes('cam')) pl.rifle.attachments.push('cam'); }   // (stickycam.ts stickyIssue's own two writes: a card at 0 has no such load on the tube, and its tile's demo plays all the same)
  };

  // THE AIM (calls 2): the director moves the aim POINT. A quiet beat is a list of LEGS — a yaw, the most speed to it, how long it is held — run on the
  // actor's aim channel (a teammate's is made as his beat begins, from where his gun is drawn; Sam's is `samCh` — the aim point is put on its yaw): from wherever the muzzle points now, eased,
  // and back to the rest direction the same way — the beat is over (Game.puppet let go, the watch dropped) only when the ease back has ended ON it
  const aimLegs = (B: Beat): boolean => { const L = B.legs[B.leg]; if (!L) return true;
    own(B.ch, L.yaw, L.cap, L.minT);
    if (!arrived(B.ch)) return false;
    if (isNaN(B.legT)) B.legT = game.time;
    if (game.time - B.legT < L.hold) return false;
    B.leg++; B.legT = NaN; return B.leg >= B.legs.length; };
  /** his rest direction where he stands: a teammate's slot yaw, Sam's cursor (kept on the foot of the door: before()) */
  const restYaw = (B: Beat, S: Staged) => B.man ? homeOf(S, B.man).yaw : yawTo(B.char.pos, S.foot);
  /** no quiet beat asks more than `maxOff` off his rest direction */
  const lim = (rest: number, y: number) => rest + Math.max(-K.maxOff * R, Math.min(K.maxOff * R, wrap(y - rest)));
  /** a quiet beat's tick: the legs, then the leg back — and its end */
  const quiet = (B: Beat, S: Staged): Step => {
    if (B.phase !== 'down') { if (!aimLegs(B)) return 'on'; if (B.turn) B.marks.push('turn'); else if (B.lit) B.marks.push('lit');   // (the row's work, said for a check: the turn made and held, the beam swept through the opening)
      to(B, 'down'); B.lit = false; B.hTo = B.man ? 1.1 : 0; B.legs = [{ yaw: restYaw(B, S), cap: (B.turn ? K.bodyRate : K.gunRate) * R, minT: -1, hold: 0 }]; B.leg = 0; B.legT = NaN; return 'on'; }
    return aimLegs(B) ? 'done' : 'on'; };
  /** the half step a man takes toward the front of the door for a throw or his light: from where he lives, `m` metres at most toward the old post */
  const stepOut = (B: Beat, S: Staged, m: number): V2 => { const G = S.at([K.post[0] * S.latch, K.post[1], 0]), dx = G[0] - B.home[0], dz = G[2] - B.home[1], len = Math.hypot(dx, dz) || 1, k = Math.min(m, len) / len; return [B.home[0] + dx * k, B.home[1] + dz * k]; };
  /** the opening as a man at P has it: the yaws of the lines through its far edge and (as near straight in as he gets) its near one — each a hand in from
   *  the jamb, more on the hinge's side where the pushed leaf stands — never within `wallMin` of the wall's line (null: no line into the room from there) */
  const slice = (S: Staged, P: V2): { far: number; near: number } | null => {
    const hw = S.width / 2, al = along(S, P), out = outOf(S, P); if (out < 0.2) return null;
    const hingeLow = S.latch > 0, leafIn = S.door ? K.leafIn : 0, u0 = -hw + K.jambIn + (hingeLow ? leafIn : 0), u1 = hw - K.jambIn - (hingeLow ? 0 : leafIn); if (u1 <= u0) return null;
    const uFar = Math.abs(u0 - al) > Math.abs(u1 - al) ? u0 : u1, uNear = uFar === u0 ? u1 : u0, sg = Math.sign(uFar - al) || 1;
    const aFar = Math.atan2(out, Math.abs(uFar - al)), aNear = al > u0 && al < u1 ? Math.PI / 2 : Math.atan2(out, Math.abs(uNear - al));
    const lo = Math.max(aFar, K.wallMin * R + 1 * R), hi = Math.min(aNear, K.sliceMax * R); if (aNear < lo) return null;
    const yaw = (a: number) => yawOf([S.s[0] * sg * Math.cos(a) - S.n[0] * Math.sin(a), S.s[1] * sg * Math.cos(a) - S.n[1] * Math.sin(a)]);
    return { far: yaw(lo), near: yaw(Math.max(lo, hi)) };
  };
  /** Sam's quiet rows are played from HIS slot: a row cut with him off it (at the door for his charge, on the half step of a throw) left him there for the whole of the next */
  const samStand = (S: Staged) => { game.puppet = flat(game.player.char.pos, S.sam) > K.onSlot ? { goal: [S.sam[0], 0, S.sam[1]], aim: null, throwAt: null, walk: K.samWalk } : { goal: null, aim: null, throwAt: null }; };
  /** THE GUN FIRES (the owner, 10-15): a short burst through the WINDOW by the door — the pane of the door's own wall nearest its middle that he has a line to:
   *  from his own place if that line is clear, else from a post in front of it he can walk to past nobody (a stack man: out from the wall first, `via`). The
   *  line: nothing between him and the glass, no flatter than `fireSlant`, no man within `fireClear` of it. No such pane: the half step and the pushed leaf of
   *  his light's row, and the burst through the DOORWAY along the middle of its slice. Neither: the gun up on the door, a slow scan, no round (as it was).
   *  The rounds are the game's (deps.fire: Firearm.fire, then combat.ts fireWeapon — the row's flash, report, the glass's own break, and a TRACER where the gun's
   *  row has them and its counters say so: the AKS-74U's third round; the pistols and the FN2000 carry none): a loud gun's flash is the full one, a suppressed
   *  one's is dimmed by the game's own gain (the picture's ceiling, `flashMax`, is over both). The pane — and
   *  everything else a round touched: mend(), below — is put back plain as the next row begins or `hold` after the last round: no restart */
  // WHAT A BURST LEAVES, ALL OF IT (the review, 10-15: the row is `damage: 'none'` and only the pane, the shards and the marks were put back — every round
  // also runs the destruction's path, whose damage never decays: a few bursts opened a hole in drywall, then the next wall): the game's own resets, in the
  // order Game.resetLevelState runs them — the marks, the glass's books and holes, the panes, the DESTRUCTION (wall cells and their damage, knocked clutter,
  // dead screens, debris, heat: destruction.ts reset → wallbreak.ts reset, which cuts the world back to its authored boxes — the porch lamp's box is hung
  // again), the shards — then every prop on its rest pose and every shot-out fixture mended. Never the doors, the switches or the men (resetLevelState's
  // own: the leaf stays where the row left it, the building stays dark). Only after a row that FIRED (`shot`): with no round gone nothing here is called
  // A WALL LEFT OPEN (`Staged.hole`) IS NEVER STOOD AGAIN HERE: destruction.ts reset stands every wall as authored, with no dissolve over it, and the hole's
  // flag would outlive its hole (the light on a blank wall, a can thrown back at the team). While the hole is kept this mends what is not the wall's — the
  // glass, the shards, the fixtures — and leaves the marks, the wall cells and the props to the restage that stands the wall (`holeShots` counts the bursts so
  // looked past: after `holeBursts` of them begin() has the whole room staged again under the dissolve, and the row asked blows its wall again)
  let shot = false, shotAt = -1e9, holeShots = 0;
  const mend = () => { if (!shot) return; shot = false; const W = engine.world;
    if (staged?.hole) { holeShots++; d.mendGlass(); game.glassBreak.reset(); (game.destr as unknown as { clearMoving?(): void }).clearMoving?.(); game.shards.reset(); game.repairLights(); poolSync(); return; }
    game.decals.clear(); d.mendGlass(); game.glassBreak.reset(); game.destr.reset(); game.shards.reset(); game.props.reset(); dropProps(plan); game.repairLights();
    if (fixture && !W.statics.includes(fixture)) W.addStatic(fixture); poolSync(); };
  const burst = (B: Beat): { n: number; gap: number } => { const pl = game.player, def = (B.man ? B.man.weapon.def : pl.slot === 'rifle' ? pl.rifle.def : pl.pistol.def) as { id: string; cls: string; pellets?: unknown }, k = def.pellets ? 2 : !B.man && pl.slot !== 'rifle' || def.cls === 'pistol' ? 1 : 0; return { n: K.fireN[k], gap: K.fireGap[k] }; };
  const fireLine = (B: Beat, S: Staged): Fire | null => {
    const men: V2[] = [...S.order.filter(g => g !== B.man).map(g => homeOf(S, g).p), ...(B.man ? [S.sam] : [])], nav = game.col.nav, eye = 1.35, aH = along(S, B.home), oH = outOf(S, B.home);
    const near = (P: V2, m: number) => men.some(q => Math.hypot(q[0] - P[0], q[1] - P[1]) < m);
    const walkOk = (a: V2, b: V2) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25); for (let i = 1; i <= n; i++) { const P: V2 = [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]; if (nav.isBlocked(P[0], P[1]) || near(P, 0.6)) return false; } return true; };
    const line = (P: V2, T: Vec3, nrm: V2): boolean => { const dx = T[0] - P[0], dz = T[2] - P[1], L = Math.hypot(dx, dz), L3 = Math.hypot(L, T[1] - eye); if (L < 0.8) return false;
      if (Math.abs(dx * nrm[0] + dz * nrm[1]) / L < K.fireSlant) return false;
      for (const q of men) { const qx = q[0] - P[0], qz = q[1] - P[1]; if ((qx * dx + qz * dz) / ((Math.hypot(qx, qz) || 1) * L) > Math.cos(K.fireClear * R)) return false; }
      const h = game.col.raycast([P[0], eye, P[1]], [dx / L3, (T[1] - eye) / L3, dz / L3], L3 + 0.3); return !h || h.t >= L3 - 0.35; };
    const Pp = S.plan.pane, asked = S.plan.src.pane === 'authored', only = asked && Pp ? game.level.boxes[Pp.index] : null;   // (the way's own word on the pane: `false` = no gun is shown through glass here; a box = that pane and no other — put through the same tests as any: the plan says a problem of one that fails them; unwritten = the nearest in the anchor's own wall he has a line to, as below)
    const panes = (asked && !Pp ? [] : d.panes()).filter(b => !only || b === only).map(b => ({ b, al: along(S, [b.c[0], b.c[2]]) })).filter(x => Math.abs(outOf(S, [x.b.c[0], x.b.c[2]])) <= KIT_PLAN.paneWall && Math.abs(x.al) <= K.paneReach && x.b.c[1] - x.b.h[1] <= KIT_PLAN.paneY[0] && x.b.c[1] + x.b.h[1] >= KIT_PLAN.paneY[1]).sort((a, b) => Math.abs(a.al) - Math.abs(b.al));
    for (const { b, al } of panes) { const T: Vec3 = [b.c[0], Math.max(b.c[1] - b.h[1] + 0.15, Math.min(b.c[1] + b.h[1] - 0.15, eye)), b.c[2]], nrm: V2 = b.h[0] <= b.h[2] ? [1, 0] : [0, 1];
      if (line(B.home, T, nrm)) return { post: B.home, via: null, at: T, door: false };
      if (!B.man) continue;   // (Sam fires from his own slot or through the doorway: every row of his starts from where a cut left him, and a pane's post is a stride and more off)
      // (THE WAY'S OWN PANE: where the plan stands a man for it — the way's `pane.stand`, else the first free place before the glass — is tried before the posts)
      const posts: V2[] = [...(only && Pp ? [[Pp.stand[0], Pp.stand[1]] as V2] : []), ...K.paneOff.map((o): V2 => { const G = S.at([al + o, K.paneOut, 0]); return [G[0], G[2]]; })];
      for (const P of posts) { if (nav.isBlocked(P[0], P[1]) || near(P, K.fireOff) || !line(P, T, nrm)) continue;
        const V = S.at([aH, K.paneOut, 0]), via: V2 | null = B.man && Math.abs(oH - K.paneOut) > 0.3 ? [V[0], V[2]] : null;
        if (via ? !walkOk(B.home, via) || !walkOk(via, P) : !walkOk(B.home, P)) continue;
        return { post: P, via, at: T, door: false }; } }
    if (!walled(S) && S.reachIn >= 1) { const P = stepOut(B, S, K.lightStep), sl = slice(S, P); if (sl && !nav.isBlocked(P[0], P[1])) { const y = sl.far + wrap(sl.near - sl.far) * 0.5; return { post: P, via: null, at: [P[0] + Math.sin(y) * 6, 1.2, P[1] + Math.cos(y) * 6], door: true }; } }
    return null; };
  const gunRow: Row = { door: 'shut', damage: 'none', loud: true, rest: K.restQuiet, cap: K.gunSecs + 9,
    start: (B, S) => { const F = fireLine(B, S); if (F) { const n = burst(B), P: Vec3 = [F.post[0], 0, F.post[1]], here = F.post === B.home && flat(B.char.pos, F.post) <= K.wayM; B.fire = F; B.post = F.post; B.via = F.via; B.hTo = F.at[1]; B.quiet = here; if (F.door) { B.row = gunDoor; unlock(S); }   // (`here`: the burst is from his slot AND he is on it — a pick that cut his row at the door walks him home first, the round never leaves a walking man)
        B.legs = [{ yaw: yawTo(P, F.at), cap: K.gunRate * R, minT: -1, hold: 0.3 + (n.n - 1) * n.gap + K.fireHold }];
        if (here) { if (!B.man) samStand(S); } else { to(B, 'go'); if (B.man) go(B.man, F.via ? [F.via, F.post] : [F.post]); else game.puppet = { goal: P, aim: null, throwAt: null, walk: K.samWalk }; }
        return null; }
      const rest = restYaw(B, S), mid = lim(rest, yawTo(B.char.pos, S.at([0, 0, 1.1]))), dy = K.gunScan * R, slow = K.sweepRate * R;
      B.quiet = true; B.hTo = 1.1;
      B.legs = [{ yaw: mid, cap: K.gunRate * R, minT: -1, hold: 0 }, { yaw: lim(rest, mid + dy), cap: slow, minT: 0, hold: 0 }, { yaw: lim(rest, mid - dy), cap: slow, minT: 0, hold: 0 }, { yaw: mid, cap: slow, minT: 0, hold: K.gunHold }];
      if (!B.man) samStand(S); return null; },
    tick: (B, S) => { const F = B.fire; if (!F) return quiet(B, S);
      if (B.phase === 'home') return flat(B.char.pos, B.home) <= K.onSlot || game.time - B.pt >= 4 ? 'done' : 'on';   // (the row ends with him on his slot: the rest is everybody's)
      if (F.door && B.phase !== 'down') crack(S, B, K.wideLight);
      if (B.phase === 'go') { if (flat(B.char.pos, F.post) > K.wayM && game.time - B.pt < 6) return 'on'; to(B, 'act'); B.quiet = true; }
      if (B.phase === 'act' && B.leg === 0 && arrived(B.ch) && off(B.char.aimYaw, B.legs[0].yaw) <= 4 * R && (!F.door || wideOpen(S, K.wideLight))) { const n = burst(B);
        if (B.shots < n.n && (isNaN(B.shotT) || game.time - B.shotT >= n.gap)) { d.fire(B.man, F.at); V.shots++; B.shots++; B.shotT = shotAt = game.time; shot = true; if (B.shots === 1) B.marks.push('shot'); if (B.shots === n.n) B.marks.push('burst'); } }
      const r = quiet(B, S); if (r !== 'done' || flat(B.char.pos, B.home) <= K.onSlot) return r;
      to(B, 'home'); if (B.man) go(B.man, B.via ? [B.via, B.home] : [B.home]); else game.puppet = { goal: [B.home[0], 0, B.home[1]], aim: null, throwAt: null, walk: K.samWalk }; return 'on'; } };
  const gunDoor: Row = { ...gunRow, door: 'open', rest: K.restQuiet * 2 };   // (no pane he has a line to: the leaf is his hand's for the row — and pulled to before the next burst)
  /** the weapon light: ON in the first frame, on the ground at his feet; a half step, the leaf pushed wide, and the beam rises and slices the opening —
   *  along a line inside the room, from the far diagonal to as near straight in as he gets — held, and off before the gun comes back. Never on the wall,
   *  never along it (where his friends stand): the beam's own line is the director's (`beam`, written after each step) */
  const lightRow: Row = { door: 'open', damage: 'none', opening: true, rest: K.restQuiet, cap: 12,
    start: (B, S) => { if (walled(S)) return 'a blank wall: no opening to light';
      const P = stepOut(B, S, K.lightStep), sl = slice(S, P); if (!sl || game.col.nav.isBlocked(P[0], P[1])) return 'no line through the door';
      B.quiet = true; B.lit = true; B.hTo = 1.1; B.post = P; unlock(S);
      B.pitch = chan(-K.feetDeg * R); B.rose = false;
      B.legs = [{ yaw: sl.far, cap: K.gunRate * R, minT: -1, hold: 0 }, { yaw: sl.near, cap: K.sweepRate * R, minT: 0, hold: K.lightHold }];
      if (B.man) go(B.man, [P]); else game.puppet = { goal: [P[0], 0, P[1]], aim: null, throwAt: null, walk: K.samWalk };
      return null; },
    tick: (B, S) => {
      if (B.phase !== 'down') crack(S, B, K.wideLight);   // (his hand on the leaf until the gun comes back)
      if (!B.rose && wallAngle(S, B.char.aimYaw) >= K.wallMin * R + 0.5 * R && wallAngle(S, B.ch.v) >= K.wallMin * R + 0.5 * R) { B.rose = true; own(B.pitch!, 0, K.gunRate * R, K.riseSecs); }
      chanTick(B.pitch!, K.gunRate * R, stepDt);
      return quiet(B, S); } };
  /** a teammate's door order with a can in it, cut before anybody goes in: the mark is the door tools' own count (the way-in door unlocked first, as every
   *  row that works it does: a leaf hung again after a charge is the level's own LOCKED door again — Door.reset — and frag and clear halts at a handle that
   *  does not turn: the row ended 'lost' in a second, about one pick in eight at the office) */
  const byOrder = (word: string, stat: 'bangs' | 'frags', after: number, damage: Row['damage'], give: (B: Beat, S: Staged) => string | null): Row => ({ door: 'none', damage, loud: true, leaf: true, rest: damage === 'none' ? K.restCan : K.hold, cap: 10,
    start: (B, S) => { B.base = tools().stats[stat]; unlock(S); const why = give(B, S); if (why === null && stat === 'bangs') spareSam(true); return why; },   // (his stun: Sam is spared it as the stack is — spareSam)
    tick: (B, S) => { const op = tools().ops.find(o => o.door === S.door), gone = !op || op.phase === 'enter';   // (the order is over, or has gone on to the entry: the room behind the door is not this picture's)
      if (isNaN(B.markT) && tools().stats[stat] > B.base) mark(B, word);
      if (isNaN(B.markT)) { if (gone) B.marks.push('lost'); return gone ? 'done' : 'on'; }
      return gone || game.time - B.markT >= after ? 'done' : 'on'; } });
  /** a can THROUGH the door, by hand: a half step from where he lives and his hand on the leaf TOGETHER (Doors.crack, held), the throw to a spot just
   *  inside, and the leaf is pulled to as he steps back. A teammate's smoke on the squad's own 'smoke there', given once and to him alone at the first spot
   *  the order's own test passes (asked, not tried: a refused order is said aloud by the man); Sam's from his own hand (the key, then the click, the spot
   *  through Game.puppet.throwAt — his cursor cannot name floor the camera sees a wall in front of). The mark: a can venting that was not at the start /
   *  the thing thrown gone off. SAM'S OWN FRAG ('frag': his key, the click, the game's own 3 s fuse from the hand) is the same throw with another end: the
   *  leaf is pulled to a hand ajar behind it (the burst is seen through the gap), he steps back onto his slot — off the door's line — and down, and with
   *  Game.puppet let go the squad's orders live again: every teammate on a knee through the fuse. Its marks have no undo: held, then a restage under the dissolve */
  const thrown = (kind: 'smoke' | 'flash' | 'frag'): Row => ({ door: 'open', damage: kind === 'frag' ? 'world' : 'none', opening: true, loud: kind !== 'smoke', rest: kind === 'frag' ? K.hold : K.restCan, cap: 14,
    start: (B, S) => {
      if (walled(S)) return 'a blank wall: no opening to throw through';
      const P = stepOut(B, S, Q && !B.man ? KIT_VIEW_QUIET.throwStep : kind === 'frag' ? K.fragHalf : K.half), spot = B.man ? S.smoke[0] ?? S.inside[0] : kind === 'smoke' ? S.samSmoke : kind === 'flash' ? S.samStun : S.samFrag;   // (thrown short, to lie just inside the door)
      if (!spot || game.col.nav.isBlocked(P[0], P[1])) return 'no room at the door';
      B.post = P; B.spot = spot; B.base = kind === 'frag' ? tools().stats.frags : cans().length; to(B, 'open'); unlock(S);   // (this instance is thrown away: a way-in door found locked is simply opened)
      if (B.man) { go(B.man, [P]); walk.get(B.man)!.face = yawTo([P[0], 0, P[1]], spot); } else game.puppet = { goal: [P[0], 0, P[1]], aim: null, throwAt: spot, walk: K.samWalk };
      if (kind === 'frag') { stay(true); pin = B; }   // (from before it leaves his hand: his own side knows of it a tenth of a second after)
      return null; },
    tick: (B, S) => { const pl = game.player, el = game.time - B.pt, D = S.door, wide = B.man ? K.wide : kind === 'frag' ? K.fragWide : K.wideSam;   // (Sam stands across the door from the hinge: his line to the middle crosses where a leaf at 0.9 rad stands — the can stopped on it, 0.58 m in)
      if (!D) { /* a gap: nothing to hold open, nothing to pull to */ }
      else if (kind !== 'frag' || B.phase === 'open' || B.phase === 'throw' || (B.phase === 'out' && el < K.ajarAt)) game.doors.crack(D, B.char.pos, B.char.id, stepDt, undefined, K.swing, wide);   // (his hand on the leaf from the first frame to the step back)
      else if (Math.abs(D.angle - S.shut) > K.ajar + 0.04) game.doors.pullTo(D, B.char.id); else game.doors.crack(D, B.char.pos, B.char.id, stepDt, undefined, K.swing, K.ajar);   // (the frag is in: the leaf pulled to a hand ajar, and held there)
      if (B.phase === 'open') { if (el < K.openSecs[0] || ((flat(B.char.pos, B.post!) > K.wayM || !wideOpen(S, wide)) && el < K.openSecs[1])) return 'on'; if (D && D.isClosed()) { B.marks.push('shut'); return 'done'; }
        if (B.man) { const def = game.orders.defs.find(o => o.id === 'smokeThere'), p = def ? [...S.smoke, ...S.inside].find(q => game.orders.whyNot(def, floor(q), [B.man!]) === null) : undefined;   // (the short spots first; the deep ones if the order refuses them all)
          const why = p ? game.orders.give('smokeThere', floor(p), roster(B.man)) : 'no throw from here'; if (why !== null) { V.refused = `smoke: ${why}`; B.marks.push('kept'); return 'done'; }
          B.spot = p!; B.thrown = true; B.given = true; }
        else { B.hand = pl.slot; input.pressed.add(kind === 'smoke' ? 'Digit3' : kind === 'flash' ? 'Digit4' : 'Digit5'); }
        to(B, 'throw'); return 'on'; }
      if (B.phase === 'throw') {   // (Sam's ONE throw: the click is given until the wind-up has it — the hand may not have fetched the can yet — and never again: the belt refills as it leaves)
        if (!B.man) { if (pl.pendingThrow) { B.thrown = true; return 'on'; } if (!B.thrown) { const clear = kind !== 'frag' || fragAim(B, S); if (el >= K.fistSecs && clear) input.clicked |= 1; if (el > 3) { B.marks.push('kept'); if (!clear) V.refused = 'frags: no clear throw through the door'; return 'done'; } return 'on'; } }
        to(B, 'out'); return 'on'; }
      if (kind === 'frag') {   // (Sam's alone: a teammate's is the door tools' own order)
        if (isNaN(B.markT) && B.item?.fired) mark(B, 'frag');
        if (!isNaN(B.markT)) return game.time - B.markT >= K.aftermath ? 'done' : 'on';
        { const it = B.item as { pos: Vec3; fired: boolean; bounces?: number; settled?: boolean; fuse?: number } | null, I = game.items.items as unknown as object[];   // (THE GRENADE WATCHED: one that did not go in — off a jamb, off the leaf — or lies where its burst would take the leaf is taken away before it goes off: nothing bursts in the yard, and the door and Sam are never its)
          if (it && !it.fired && (it.bounces ?? 0) > 0 && I.includes(it) && (outOf(S, [it.pos[0], it.pos[2]]) > -K.fragMin || ((it.settled || (it.fuse ?? 9) < 0.3) && takesLeaf(S, it.pos)) || ((it.fuse ?? 9) < 0.3 && reachesSam(it.pos)))) { I.splice(I.indexOf(it), 1); B.marks.push('kept'); V.refused = 'frags: it did not go in, or its burst had a line to the player'; return 'done'; } }
        if (B.phase === 'out') { if (B.spot) { B.spot = null; game.puppet = { goal: [B.home[0], 0, B.home[1]], aim: null, throwAt: null, walk: K.samWalk, crouch: true }; }   // (home off the door's line, and down)
          if (flat(pl.char.pos, B.home) > K.onSlot && el < 1.5) return 'on';
          game.puppet = null; kneel = B; kneelT = game.time; for (const g of S.order) low(g, true); to(B, 'fuse'); return 'on'; }   // (Game.puppet let go: he stays down, and the squad's orders live — everybody on a knee)
        if (el > 6) { B.marks.push('lost'); return 'done'; } return 'on'; }
      if (isNaN(B.markT) && (kind === 'smoke' ? cans().length > B.base || !!B.item?.fired : !!B.item?.fired)) mark(B, kind === 'smoke' ? 'smoke' : 'bang');
      if (isNaN(B.markT)) return el > 6 ? 'done' : 'on';
      return game.time - B.markT >= (kind === 'smoke' ? K.afterSmoke : K.afterStun) ? 'done' : 'on'; } });
  /** the stack a slot back from the door, rearmost first, facing it (Sam's own charge: clear of the blast on its own side — doortools.ts backblastM
   *  dazzles a teammate within 1.6 m of the frame). All of them or none: with no free floor behind the last man they stand, and after() puts the dazzle out */
  const standOff = (B: Beat, S: Staged) => { const nS = Math.min(3, S.order.length), G = KIT_VIEW_STAGE.gap, back = (k: number): V2 => [S.spots[k][0] + S.s[0] * G, S.spots[k][1] + S.s[1] * G];
    if (!nS || game.col.nav.isBlocked(back(nS - 1)[0], back(nS - 1)[1])) return;
    for (let k = nS - 1; k >= 0; k--) { const g = S.order[k]; go(g, [back(k)], K.pace, K.shuffle[1] * B.moved.length); B.moved.push(g); } };
  /** SAM'S OWN DOOR CHARGE (calls 5): the game's own row at the door, by his own key. Only Game.puppet refuses it (doortools.ts samFace) — so he is walked
   *  to the door, LET GO for the two seconds his hands are on the leaf (the row chosen, the one tap), and with the puppet gone the squad's orders live: the
   *  stack steps a slot back meanwhile. Set, he is walked home off the door's line and it is blown (the door tools' own trigger). The leaf lies on the floor
   *  through the hold and is hung again under the dissolve; the stack closes up as the row ends */
  const ownCharge: Row = { door: 'none', damage: 'leaf', loud: true, leaf: true, rest: K.hold, cap: 12,
    start: (B, S) => { const G = S.at([K.ownPost[0] * S.latch, K.ownPost[1], 0]); if (game.col.nav.isBlocked(G[0], G[2])) return 'no room at the door';
      if (S.door!.def.steel) return 'steel: a charge will not cut it'; if (!OWNCHARGE.on) return 'his own charges are switched off'; if (S.door!.off) return 'no leaf to set it on';   // (known before he walks: the gun's row instead — never a walk up to a door that offers nothing)
      B.base = tools().stats.blown; B.post = [G[0], G[2]]; to(B, 'go'); game.puppet = { goal: [G[0], 0, G[2]], aim: null, throwAt: null, walk: K.samWalk }; return null; },
    tick: (B, S) => { const pl = game.player, el = game.time - B.pt, T = tools(), c = T.set.find(x => x.door === S.door);
      if (isNaN(B.markT) && T.stats.blown > B.base) mark(B, 'blow');
      if (!isNaN(B.markT)) return game.time - B.markT >= K.aftermath ? 'done' : 'on';
      const ajar = !S.door!.off && Math.abs(S.door!.angle - S.shut) >= 0.03;
      if (ajar && (B.phase === 'go' || B.phase === 'ask')) game.doors.pullTo(S.door!, B.char.id);   // (picked from his light, his smoke, his stun: the leaf is pulled to under his walk — the row is not held for it, waits())
      if (B.phase === 'go') { if ((flat(pl.char.pos, B.post!) > 0.15 || ajar) && el < 2) return 'on'; game.puppet = null; standOff(B, S); to(B, 'ask'); return 'on'; }
      if (B.phase === 'ask') {   // (the row is on offer the frame after he is let go; the tap once, again only if it did not take — a second press would break the set off)
        if (pl.charging) { B.given = true; to(B, 'hands'); return 'on'; } if (el >= K.ownAsk) { B.marks.push('kept'); V.refused = 'charges: the door never offered it'; return 'done'; }
        if ((isNaN(B.legT) || game.time - B.legT > 0.5) && game.selectVerb('door', 'charge')) { input.pressed.add('Space'); B.legT = game.time; } return 'on'; }
      if (B.phase === 'hands') { if (!c) { if (!pl.charging) { B.marks.push('kept'); return 'done'; } return 'on'; }
        B.marks.push('set'); to(B, 'off'); game.puppet = { goal: [B.home[0], 0, B.home[1]], aim: null, throwAt: null, walk: K.samWalk }; return 'on'; }   // (set: off the door's line, home)
      if (!c) { B.marks.push('lost'); return 'done'; }
      if (flat(pl.char.pos, B.home) <= K.onSlot || el >= K.clearSecs) T.trigger(c);
      return 'on'; } };
  /** THE OPTICAL WAND (calls 5; this row is Sam's — wand.ts; a teammate's is `wandMate`, below): the game's own row at the SHUT door, by his own key. That row is offered only under the fog of war,
   *  so the fog is ON for the game for the length of this row and LIFTED for every draw (Game.fogLift / fogBack — the engine replay's own switch: the picture
   *  never shows it; by code — never seen on a GPU). He is walked to the door and LET GO (Game.puppet stops a look), goes onto his knee at the middle of the
   *  leaf with both hands at its foot, the lens is through after the game's own wait (WAND.quick, the page: as he gets down), his cursor turns it to one side and the other, and he is walked home
   *  (which pulls it). Nothing to undo: a cut is the fog off and the walk home — both end the look by the game's own rule */
  const cursor = (p: Vec3) => { const q = cam.project([p[0], 0, p[2]], view.clientWidth, view.clientHeight); if (q[2]) { input.mouseX = q[0]; input.mouseY = q[1]; } };
  const wandRow: Row = { door: 'shut', damage: 'none', leaf: true, rest: K.restQuiet, cap: 13,
    start: (B, S) => { const G = S.at([K.wandPost[0], K.wandPost[1], 0]), pl = game.player;
      if (!d.tiles(0).includes('wand')) return 'no wand on this card'; if (S.door!.def.steel) return 'steel: no gap under it'; if (S.door!.off) return 'no leaf to look under'; if (game.col.nav.isBlocked(G[0], G[2])) return 'no room at the door';
      wandWas = pl.wand; pl.wand = true; fogUp = true; game.fogOfWar.viewer = true; game.fogOfWar.on = true;   // (a tile's thing plays with the tile off too: carried for the row)
      B.post = [G[0], G[2]];
      // (A LEAF LEFT WIDE by the row before — the sticky camera's holds it at `camWide`: his post is in its arc, and walked there at once he stood in its
      //  way; it came round to him, went back and stayed, and the door never offered the wand. So it is pulled HOME first, with him out of its sweep —
      //  where he stands if that is clear of it, else his own place, as tidy() has it between rows — and only then is he walked to its foot)
      if (Math.abs(S.door!.angle - S.shut) >= 0.03) { const D = S.door!.def, clear = Math.hypot(pl.char.pos[0] - D.hinge[0], pl.char.pos[2] - D.hinge[1]) > D.width + K.wandClear, w = clear ? [pl.char.pos[0], pl.char.pos[2]] : S.sam;
        to(B, 'shut'); game.puppet = { goal: [w[0], 0, w[1]], aim: null, throwAt: null, walk: K.samWalk }; return null; }
      to(B, 'go'); game.puppet = { goal: [G[0], 0, G[2]], aim: null, throwAt: null, walk: K.samWalk }; return null; },
    tick: (B, S) => { const pl = game.player, el = game.time - B.pt, W = pl.wanding, ajar = Math.abs(S.door!.angle - S.shut) >= 0.03;
      if (ajar && (B.phase === 'shut' || B.phase === 'go' || B.phase === 'ask')) game.doors.pullTo(S.door!, B.char.id);   // (picked from a row that had the leaf open: pulled to before his walk, and again under it — the wand goes under a leaf shut home)
      if (B.phase === 'shut') { if (ajar && el < K.wandShut) return 'on'; to(B, 'go'); game.puppet = { goal: [B.post![0], 0, B.post![1]], aim: null, throwAt: null, walk: K.samWalk }; return 'on'; }
      if (B.phase === 'go') { if ((flat(pl.char.pos, B.post!) > 0.15 || ajar) && el < 2) return 'on'; game.puppet = null; to(B, 'ask'); return 'on'; }
      if (B.phase === 'ask') {   // (the row is on offer the frame after he is let go; the tap once, again only if it did not take)
        if (W) { B.marks.push('knee'); to(B, 'feed'); return 'on'; } if (el >= K.ownAsk) { B.marks.push('kept'); V.refused = 'wand: the door never offered it'; return 'done'; }
        if ((isNaN(B.legT) || game.time - B.legT > 0.5) && game.selectVerb('door', 'wand')) { input.pressed.add('Space'); B.legT = game.time; } return 'on'; }
      if (B.phase === 'off') return flat(pl.char.pos, B.home) <= K.onSlot || el >= 1.5 ? 'done' : 'on';
      if (!W) { B.marks.push('lost'); return 'done'; }   // (shoved off it, the leaf moved: the game pulled it)
      if (B.phase === 'feed') { if (W.live) { mark(B, 'through'); to(B, 'pan'); } return 'on'; }
      if (el < 2 * K.wandPan) { cursor(S.at([el < K.wandPan ? 6 : -6, 1.5, 0])); return 'on'; }   // (the lens turns after his cursor at its own rate, to its own stops: a point far along the wall to one side, then the other — on the yard's floor, which the camera sees)
      B.marks.push('out'); to(B, 'off'); game.puppet = { goal: [B.home[0], 0, B.home[1]], aim: null, throwAt: null, walk: K.samWalk, crouch: Q }; return 'on'; } };
  /** A TEAMMATE'S WAND (wandorder.ts — the squad's own row on a shut door, `wandLook`: the man who carries one kneels at the foot of the leaf and feeds it):
   *  his tile's thing, by the game's own order to him alone. As in Sam's row the fog is the game's for its length and lifted for every draw, and the wand is
   *  on his staged card for the row (a tile's thing plays with the tile off too). The order is on the squad's list only while there is a fog and a living
   *  man carries one (wandOrderKey, once a step): asked for from the step after, the leaf pulled to first. The mark is the lens THROUGH (the game's own
   *  tally, after its 1.5 s on his knee); it sweeps on the game's clock for `2 × wandPan`, and finish() ends the look: the fog off and his walk home, which
   *  is another assignment — the game's own rule takes the lens out. `door: 'none'` as every door order's row: walks() leaves him to it. Nothing to undo */
  const wandMate: Row = { door: 'none', damage: 'none', leaf: true, rest: K.restQuiet, cap: 12,
    start: (B, S) => { const k = kitOf(B.man!);
      if (!d.tiles(B.i).includes('wand')) return 'no wand on this card'; if (!k) return 'no card on him'; if (S.door!.def.steel) return 'steel: no gap under it'; if (S.door!.off) return 'no leaf to look under';
      wandKit = { k, was: k.wand }; k.wand = true; wandWas = game.player.wand; fogUp = true; game.fogOfWar.viewer = true; game.fogOfWar.on = true;   // (`wandWas`: finish() writes Sam's own back with the fog — as it stands, for this row is not his)
      B.base = WANDORDER_STATS.live; to(B, 'ask'); return null; },
    tick: (B, S) => { const el = game.time - B.pt;
      if (B.phase === 'ask') { let why = 'the squad never had the order';
        if (isAjar(S)) { game.doors.pullTo(S.door!, B.char.id); why = 'the leaf never shut'; }
        else { const def = game.orders.defs.find(o => o.id === WAND_ORDER), no = def ? game.orders.whyNot(def, onDoor(S), [B.man!]) ?? game.orders.give(WAND_ORDER, onDoor(S), roster(B.man!)) : why;   // (asked, not tried: a refused order is said aloud by the man — given only once its own test passes)
          if (no === null) { B.given = true; to(B, 'go'); return 'on'; } why = no; }
        if (el >= K.wait) { B.marks.push('kept'); V.refused = `wand: ${why}`; return 'done'; } return 'on'; }
      if (isNaN(B.markT)) { if (WANDORDER_STATS.live > B.base) { B.marks.push('knee'); mark(B, 'through'); return 'on'; }
        if (game.orders.of(B.man!)?.order !== WAND_ORDER) { B.marks.push('lost'); return 'done'; } return 'on'; }   // (the game took him off it: the leaf moved, no way onto the door)
      if (game.time - B.markT < 2 * K.wandPan) return 'on'; B.marks.push('out'); return 'done'; } };
  /** the launcher's load stepped to `load` by Sam's own key (player.ts: 2 draws the rifle; 2 again with it in his hands steps the right button's load — one
   *  press a frame, none while it is still coming off the sling): true once that load is up */
  /** what Sam had in his hands as a launcher's row begins — the hand a row cut this very frame still owes him (finish() pressed its key: it has not landed, and
   *  is not let land — this row wants the rifle up, and puts that hand back as IT ends) */
  const handWas = (): string => { const h = handDue || game.player.slot; if (handDue) { input.pressed.delete(handDue === 'rifle' ? 'Digit2' : 'Digit1'); handDue = ''; } return h; };
  const tube = (load: 'cam' | 'he40' | 'ring'): boolean => { const pl = game.player;
    if (!pl.rifleUp) { input.pressed.add('Digit2'); return false; } if (pl.equipT > 0) return false; if (pl.rifle.attachment === load) return true;
    input.pressed.add('Digit2'); return false; };
  /** A STICKY CAMERA (calls 5; Sam's alone — stickycam.ts): the same half step and hand on the leaf as a throw, the rifle up with the camera on its tube (his
   *  own key), and ONE press of the right button: the game's own shot, flat over his aim point onto the first wall behind it — the line, of `camRays` across
   *  the opening, that meets a wall nearest the door. It is looked at for `camHold`, the leaf is pulled to, and the camera stays on its wall until the next
   *  row begins (a block the size of a fist: about four pixels here; its lens is dark — the red one is the fog's, which this picture does not have) */
  /** the camera's wall, from where he stands: the nearest wall inside by a ray through the opening that clears both jambs and the leaf as it will stand */
  const camSpot = (S: Staged, P: V2): Vec3 | null => { const out = outOf(S, P), hw = S.width / 2 - K.camClear; if (!S.door || hw <= 0 || out < 0.3) return null;
      let best: Vec3 | null = null, bt = Infinity; const D = S.door!.def, tip = [1, -1].map(k => { const a = D.closedDir + k * K.camWide; return [Math.cos(a), Math.sin(a)]; }).find(t => t[0] * S.n[0] + t[1] * S.n[1] < 0)!;   // (the leaf as it will stand, pushed into the room)
      for (let i = 0; i < K.camRays; i++) { const q = S.at([-hw + 2 * hw * i / (K.camRays - 1), 0, 0]), L = Math.hypot(q[0] - P[0], q[2] - P[1]) || 1, dir: Vec3 = [(q[0] - P[0]) / L, 0, (q[2] - P[1]) / L], dn = -(dir[0] * S.n[0] + dir[2] * S.n[1]); if (dn < 0.2) continue;
        let near = Infinity; for (let j = 0; j <= 8; j++) { const lx = D.hinge[0] + tip[0] * D.width * j / 8 - P[0], lz = D.hinge[1] + tip[1] * D.width * j / 8 - P[1]; if (lx * dir[0] + lz * dir[2] > 0) near = Math.min(near, Math.abs(lx * dir[2] - lz * dir[0])); }
        if (near < K.camClear) continue;
        const t0 = (out + K.camIn) / dn, o: Vec3 = [P[0] + dir[0] * t0, 1.2, P[1] + dir[2] * t0], h = game.col.raycast(o, dir, K.camReach); if (!h || t0 + h.t >= bt) continue;   // (asked from just inside the door's line: the leaf is still shut)
        bt = t0 + h.t; best = [o[0] + dir[0] * h.t, 0, o[2] + dir[2] * h.t]; }
      return best; };
  const camRow: Row = { door: 'open', damage: 'none', leaf: true, rest: K.restCan, cap: 10,
    start: (B, S) => { const pl = game.player, G = S.at([(along(S, B.home) < 0 ? -1 : 1) * K.camPost[0], K.camPost[1], 0]), P: V2 = [G[0], G[2]];
      if (!pl.hasRifle || !pl.rifle.attachments.includes('cam')) return 'no launcher for it on this card'; if (S.door!.def.width / 2 <= K.camClear || game.col.nav.isBlocked(P[0], P[1])) return 'no line through the door';
      const best = camSpot(S, P); if (!best) return 'no wall inside to stick it to';
      B.post = P; B.spot = best; B.hand = handWas(); B.base = pl.camSeq; to(B, 'open'); (S.door as { locked: boolean }).locked = false;
      tubeWas = pl.rifle.attIdx; game.puppet = { goal: [P[0], 0, P[1]], aim: null, throwAt: null, walk: K.samWalk }; return null; },
    tick: (B, S) => { const pl = game.player, el = game.time - B.pt, D = S.door!, cam1 = pl.cams[pl.cams.length - 1];
      game.doors.crack(D, B.char.pos, B.char.id, stepDt, undefined, K.swing, K.camWide);   // (his hand on the leaf until the row ends)
      if (B.phase === 'open') { if (flat(pl.char.pos, B.post!) <= K.wayM) B.spot = camSpot(S, [pl.char.pos[0], pl.char.pos[2]]) ?? B.spot;   // (the line from where he STOPPED, not from the post: 0.2 m aside put one round in three on the jamb)
        const up = tube('cam'), there = flat(pl.char.pos, B.post!) <= K.wayM && Math.abs(D.angle - S.shut) >= K.camWide - 0.1 && off(pl.char.aimYaw, yawTo(pl.char.pos, B.spot!)) <= 3 * R;
        if (!(up && there) && el < 4) return 'on'; if (!up) { B.marks.push('kept'); V.refused = 'cams: the launcher never came up'; return 'done'; }
        to(B, 'fire'); B.legT = NaN; return 'on'; }
      if (B.phase === 'fire') {   // (the press BEGINS the launcher's gesture, the frame after — the button up — sends it: asked again only while the gesture never began)
        if (pl.camSeq > B.base) { B.thrown = true; mark(B, 'cam'); to(B, 'fly'); return 'on'; } if (el >= K.camAsk) { B.marks.push('kept'); V.refused = 'cams: the launcher never sent it'; return 'done'; }
        if (!pl.launchHeld && (isNaN(B.legT) || game.time - B.legT > 0.3)) { input.clicked |= 4; B.legT = game.time; } return 'on'; }
      if (B.phase === 'fly') { if (cam1 && !cam1.vel) { B.marks.push('stuck'); B.rest = [cam1.pos[0], cam1.pos[1], cam1.pos[2]]; to(B, 'stuck'); } else if (!cam1 || el > 2) { B.marks.push('lost'); return 'done'; } return 'on'; }
      return el >= K.camHold ? 'done' : 'on'; } };
  /** THE 40 MM (calls 5; Sam's alone): never through this door — the round arms 8 m out and the room behind it is shorter: a dud would read as a bug. The
   *  launcher is SHOULDERED and not fired: the rifle up with the 40 mm on its tube (his own key), his aim eased round — muzzle at the ground — down the wall
   *  AWAY from the stack and a little out into the yard, brought up to the shoulder there, held, lowered and eased back. No round leaves the tube: nothing to undo.
   *  THE SPONGE ROUNDS (kittree.ts: a row of the tree's card) are the same row with that load on the tube — shouldered and not sent either: a man of his own
   *  team stands along that wall, and a round that meets a head puts its man out cold */
  const tubeRow = (load: 'he40' | 'ring'): Row => ({ door: 'shut', damage: 'none', rest: K.restQuiet, cap: 12,
    start: (B, S) => { const pl = game.player, a = K.shellYard * R; if (!pl.hasRifle || !pl.rifle.attachments.includes(load)) return 'no launcher on this card';
      B.quiet = true; B.hTo = 0; B.hand = handWas(); B.legs = [{ yaw: yawOf([-S.s[0] * Math.cos(a) + S.n[0] * Math.sin(a), -S.s[1] * Math.cos(a) + S.n[1] * Math.sin(a)]), cap: K.gunRate * R, minT: -1, hold: K.shellHold }];
      tubeWas = pl.rifle.attIdx; samStand(S); return null; },
    tick: (B, S) => { if (B.phase !== 'down') { if (!B.rose && tube(load)) { B.rose = true; B.marks.push('up'); } B.hTo = B.rose && B.leg === 0 && arrived(B.ch) ? 1.3 : 0; }   // (round with the muzzle DOWN — the shorter way round is across the wall, and a fourth man stands on it behind him — and up to the shoulder only once it points down the wall)
      return quiet(B, S); } });
  const shellRow = tubeRow('he40'), ringRow = tubeRow('ring');
  /** THE WALL CHARGE (calls 5: "the walk-off IS the demo"): the squad's own order, given to the STACK's men together (a man alone is refused: a mate
   *  too close to that wall; the fourth man, across the door behind Sam, is left out of it and stands) — on the stack's own wall, at the first of `wallAt` the order's own test passes. One man sets it (the game's 2 s, his
   *  hands on it), the rest peel off along the wall, he follows; blown once all are stood off — by the wall charge's own trigger — and before anybody goes in
   *  every man is let go of the order where he stands. The hole is HELD as a resting picture (KIT_VIEW_LOOP.hold); then ONE restage under the dissolve stands
   *  the wall again (the encounter's own restart: destruction.ts reset) and puts every man back ON his place. A cut: the order and the charge taken down
   *  (WallCharge.reset) — and men already off their places (`wallOff`) go back the same way, under the dissolve. On Sam's card his hands are not in it: he stays
   *  on his slot (his own row at a wall is refused under Game.puppet, and Game.puppet takes the squad's orders away) */
  let wallAsk: { t: OrderTarget; men: Guard[] } | null = null;
  const wallRow: Row = { door: 'shut', damage: 'world', loud: true, team: true, rest: K.hold, cap: 26,
    start: (B, S) => { const WC = game.wallCharge, O = game.orders, def = O.defs.find(o => o.id === 'wallCharge'); if (!WC || !def) return 'no wall charge in this build';
      { const no = (B.prelude ? shutWall : shutOwn).get(S.plan); if (no !== undefined) return no; }   // (REMEMBERED for this way: its charge came down unblown once, or its order was refused from the men's own places — the gun's row, nobody walked out again)
      if (game.puppet) return 'the squad has no orders while the player is walked';
      // (a refusal judged with every man on his place is the WAY's, and kept; one met mid-walk — a pick over a row that had men off their places — is asked again)
      const placed = flat(game.player.char.pos, S.sam) <= K.onSlot + 0.1 && !away(S), keep = (no: string) => { if (placed) wallKept(S, B, no); return no; };
      let why: string | null = null, t: OrderTarget | null = null; const said: string[] = [];
      const side = S.order.length ? Math.sign(along(S, homeOf(S, S.order[0]).p)) || 1 : 1, stack = S.order.filter(g => along(S, homeOf(S, g).p) * side > 0); let men = stack;   // (the stack's own men: the fourth, across the door behind Sam, would walk through Sam's place to it — he and Sam stand, outside its reach)
      for (const a of S.kind === 'wall' ? (B.prelude ? [0] : [0, ...K.wallAt]) : K.wallAt) { const p = S.at([a * side, 0, 0]),   // (a way anchored ON a blank wall: the marked stretch itself first — and nowhere else when the charge is to open the span for another row: the rows aim at the span)
        m = S.kind === 'wall' ? S.order : stack,   // (AT A WALL ANCHOR the charge goes off where the whole team stands — the fourth man, behind Sam, is inside its reach too: the order is every teammate's at EVERY spot asked, and the game stands them all off; the stand-clear gate below counts every one of them, and a man left out of the order held it shut)
        q = O.targetAt([p[0], 0, p[2]]); why = O.whyNot(def, q, m); if (why === null) { t = q; B.spot = p; men = m; B.onSpan = S.kind === 'wall' && a === 0; break; } if (!said.includes(why)) said.push(why); }
      if (!t) { B.onSpan = S.kind === 'wall'; return keep(said.join(' / ') || 'no wall by the stack to set it on'); }
      B.base = WC.stats.blown; wallAsk = { t, men };
      // THE BLAST TOUCHES NOBODY (the owner's drive, 10-15: on a span the charge goes off 1.8 m from Sam — a teammate was counted hit). Where the charge will
      // sit (the order's own slide) is asked first: off the span, a charge that is to open it for another row is refused and remembered; and where SAM stands
      // inside its reach he is walked out of it BEFORE the order is given (Game.puppet takes the squad's orders away: his walk cannot be under it) — the
      // nearest free place down the wall away from the stack, or straight out, that the wall charge's own test (blastShare) says takes none of it
      const W = WC.spot(t), share = (x: number, z: number) => W ? WC.blastShare(W, [x, 0, z]) : 0, pl = game.player.char.pos;
      if (W && S.kind === 'wall' && B.prelude) { const al = along(S, W.alongX ? [W.u, W.box.c[2]] : [W.box.c[0], W.u]); if (Math.abs(al) > S.width / 2) { const no = `the wall charge would sit ${Math.abs(al).toFixed(2)} m from the span's middle: no hole on the span`; shutWall.set(S.plan, no); B.spot = null; return no; } }
      if (S.kind === 'wall' && share(pl[0], pl[2]) > 0) { const nav = game.col.nav, aS = along(S, S.sam), oS = outOf(S, S.sam); let P: V2 | null = null;
        const ok = (G: Vec3) => { const n = Math.ceil(flat(pl, [G[0], G[2]]) / 0.25); for (let i = 1; i <= n; i++) if (nav.isBlocked(pl[0] + (G[0] - pl[0]) * i / n, pl[2] + (G[2] - pl[2]) * i / n)) return false; const cx = W!.alongX ? W!.u : W!.box.c[0], cz = W!.alongX ? W!.box.c[2] : W!.u, l = Math.hypot(cx - G[0], cz - G[2]) || 1, m = 2 * K.wayM + 0.1;   // (he stops within `wayM` of the mark: the mark is clear of it with that to spare)
          return share(G[0], G[2]) === 0 && share(G[0] + (cx - G[0]) / l * m, G[2] + (cz - G[2]) / l * m) === 0; };
        for (let d = 0.5; d <= 6 && !P; d += 0.5) for (const G of [S.at([aS - side * d, oS, 0]), S.at([aS, oS + d, 0]), S.at([aS - side * d, oS + d, 0])]) if (ok(G)) { P = [G[0], G[2]]; break; }
        if (!P) { B.spot = null; return keep('no floor for Sam to stand clear of the wall charge'); }
        B.post = P; game.puppet = { goal: [P[0], 0, P[1]], aim: null, throwAt: null, walk: K.samWalk }; to(B, 'clear'); return null; }
      why = O.give('wallCharge', t, 'all', { men }); if (why !== null) { B.spot = null; return keep(why); }
      B.moved = men; B.given = true; to(B, 'place'); return null; },
    tick: (B, S) => { const WC = game.wallCharge, c = WC.set[0], op = WC.ops[0];
      if (B.phase === 'clear') {   // (Sam on his way out of the charge's reach: then the order, as start() would have given it)
        if (flat(game.player.char.pos, B.post!) > K.wayM && game.time - B.pt < 8) return 'on';
        game.puppet = null; const A = wallAsk, why = A ? game.orders.give('wallCharge', A.t, 'all', { men: A.men }) : 'no wall to set it on';
        if (why !== null) { V.refused = `walls: ${why}`; wallKept(S, B, why); B.marks.push('kept'); return 'done'; }   // (Sam was walked out for nothing: remembered — he is not walked out and back every loop)
        B.moved = A!.men; B.given = true; to(B, 'place'); return 'on'; }
      if (!isNaN(B.markT)) {   // (blown: nobody goes in — each man stands where he stood off, and the hole is looked at)
        if (!B.loose) { B.loose = true; for (const g of B.moved) { go(g, [[g.char.pos[0], g.char.pos[2]]]); walk.get(g)!.face = g.char.bodyYaw; } }
        return game.time - B.markT >= K.aftermath ? 'done' : 'on'; }
      // THE HOLE IS KEPT ONLY ON THE SPAN (the review, 10-15): the order's own test may slide the charge along the wall (WALLCHARGE.slide, ±1.5 m), and the rows
      // that play through the hole aim at the span. A charge set off the span is taken down unblown; one that opened nothing, or opened it off the span, is
      // mended by the restage — and either way the reason is REMEMBERED for this way (`shutWall`): the row asked is the gun's from then on, never the charge again.
      // A CHARGE THAT COMES DOWN UNBLOWN is never taken off the wall here: finish() has the room staged again under the dissolve, and it goes under that
      if (c) { const W = c.wall as unknown as { box: Box; alongX: boolean; u: number }, spanAl = (du: number) => along(S, W.alongX ? [W.u + du, W.box.c[2]] : [W.box.c[0], W.u + du]), onSpan = (al: number) => S.kind !== 'wall' || Math.abs(al) <= S.width / 2;
        if (B.phase !== 'set') { to(B, 'set'); B.marks.push('set');
          if (B.prelude && !onSpan(spanAl(0))) { const no = `the wall charge sits ${Math.abs(spanAl(0)).toFixed(2)} m from the span's middle: no hole on the span`; shutWall.set(S.plan, no); V.refused = `walls: ${no}`; B.marks.push('kept', 'down'); return 'done'; } }
        if (op?.phase === 'armed' || game.time - B.pt >= K.wallClear) {
          // (NOBODY INSIDE ITS REACH as it goes: the men still walking off are waited for — `wallLate` s past the clock at most, then the charge is taken down unblown)
          const pl = game.player.char.pos, inIt = S.kind !== 'wall' ? 0 : Math.max(V.standClear ? 0 : 1, S.order.filter(g => WC.blastShare(c.wall, g.char.pos) > 0).length + (WC.blastShare(c.wall, pl) > 0 ? 1 : 0));   // (a SPAN's charge: by a door the stack's own stand-off is the row as it was)
          if (inIt) { if (game.time - B.pt < K.wallClear + K.wallLate) return 'on'; const no = `${inIt} of the team could not stand clear of the wall charge`; wallKept(S, B, no); V.refused = `walls: ${no}`; B.marks.push('kept', 'down'); return 'done'; }
          const r = WC.blow(c, false); if (r) { mark(B, 'blow');   // (the plan's own clock, no press of the player's: wallcharge.ts WALLKILL is not asked)
            const H = r.hole ? (WC as unknown as { holeAt?(w: unknown): { du: number } | null }).holeAt?.(c.wall) ?? null : null, al = spanAl(H ? H.du : 0);
            if (r.hole && onSpan(al)) B.marks.push('hole');
            else if (B.prelude) shutWall.set(S.plan, r.hole ? `the wall charge's hole opened ${Math.abs(al).toFixed(2)} m from the span's middle: not on the span` : 'the wall charge opened no hole in this wall'); }
          else { B.marks.push('lost'); return 'done'; } }
        return 'on'; }
      if (!op) { B.marks.push('lost'); return 'done'; }
      return 'on'; } };
  /** THE BIG SLOT'S TOOLS (the owner, 10-15: "big slots don't seem to do anything" — bigkit.ts, kit.ts BIGSLOT.shut / .beside): the breaching shotgun and the
   *  hammer open ANY shut door that is not steel, worked from beside the latch jamb — the picture's door is used as it stands, nothing is locked for it.
   *  A TEAMMATE: the squad's own row on the door's tools (`bigClear`, key H — an open and clear WITH the tool) to him alone: its man comes beside the frame
   *  (toGun: the M870 off its sling for the shell, or the hammer's blow), the door gives, and the order is taken down before anybody goes in. SAM: walked to
   *  the game's own spot beside the latch jamb where it offers one (bigkit.ts samBigSpot; else the front of the door), let go, the door's own row ('shoot it
   *  open' / 'hammer it open': verbs `breach` / `hammer`, one committed beat of Player.kick), walked home. The mark is the door GIVING ('gave': the keep
   *  broken — doors.ts kickIn's own `lockBroken`, whichever tool — or the leaf open); the leaf is held as it was left, then hung again under the dissolve.
   *  The tool is in his hands for the blow (bigkit.ts, rigProps.ts): the swing and the door giving are the demo */
  const gave = (S: Staged) => !!S.door && (S.door!.lockBroken || S.door!.off || Math.abs(S.door!.angle - S.shut) > 0.2);
  const bigOf = (i: number) => { const b = cards[i]?.big; return b === 'shotgun' || b === 'hammer' ? b : null; };
  const ajar = isAjar;
  const bigGive = (B: Beat, S: Staged): string | null => { S.door!.lockBroken = false;   // (a keep an older row broke and nothing hung again: the mark is THIS row's)
    pools('bigtool'); const why = game.orders.give(BIG_ORDER, onDoor(S), roster(B.man!)); if (why !== null) return why; B.given = true; to(B, 'go'); return null; };
  const bigMate: Row = { door: 'none', damage: 'leaf', loud: true, leaf: true, rest: K.hold, cap: 14,
    start: (B, S) => { if (!bigOf(B.i)) return 'nothing for a door in his big slot'; if (S.door!.def.steel) return 'steel: it holds'; if (S.door!.off) return 'no leaf to break';
      if (ajar(S)) { to(B, 'shut'); return null; }   // (picked with the leaf open — his light, the gun's doorway burst: the row is not held for it, waits() — it begins now, the leaf pulled to first)
      return bigGive(B, S); },
    tick: (B, S) => { const op = tools().ops.find(o => o.door === S.door), gone = !op || op.phase === 'enter';
      if (B.phase === 'shut') { if (ajar(S) && game.time - B.pt < K.wait) { game.doors.pullTo(S.door!, B.char.id); return 'on'; }
        const why = bigGive(B, S); if (why !== null) { V.refused = `bigtool: ${why}`; B.marks.push('kept'); return 'done'; } return 'on'; }
      if (isNaN(B.markT)) { if (gave(S)) { mark(B, 'gave'); to(B, 'open'); tools().reset(); pools(); B.given = false; return 'on'; }   // (it gave: the order is taken down before anybody goes in — and his own hand pushes the leaf, below)
        if (gone) B.marks.push('lost'); return gone ? 'done' : 'on'; }
      game.doors.crack(S.door!, B.char.pos, B.char.id, stepDt, undefined, K.swing, K.wideLight);
      return game.time - B.markT >= K.aftermath ? 'done' : 'on'; } };
  const bigSam: Row = { door: 'none', damage: 'leaf', loud: true, leaf: true, rest: K.hold, cap: 14,
    start: (B, S) => { const tool = bigOf(0), F = S.at([K.ownPost[0] * S.latch, K.ownPost[1], 0]); if (!tool) return 'nothing for a door in his big slot'; if (S.door!.def.steel) return 'steel: it holds'; if (S.door!.off) return 'no leaf to break';
      let G: Vec3 = F; try { const b = samBigSpot(game, S.door!, F, tool), C = S.door!.frameCentre;   // (beside the latch jamb, out of the opening, where the game would stand him — never onto the stack's head man: then the front. The door's row is offered only within a hand's reach of the frame (doors.ts USE_REACH 1.35 m): where the game's spot is further — the shotgun's, back where its pattern has the latch — he is walked as near it as `bigReach` allows, and the game's own beat takes him the rest)
        if (b) { const dx = b.pos[0] - C[0], dz = b.pos[2] - C[2], L = Math.hypot(dx, dz), k = L > K.bigReach ? K.bigReach / L : 1, P: Vec3 = [C[0] + dx * k, 0, C[2] + dz * k]; if (!game.col.nav.isBlocked(P[0], P[2])) G = P; } } catch { /* the front of the door */ }
      if (game.col.nav.isBlocked(G[0], G[2])) return 'no room at the door';
      B.post = [G[0], G[2]]; to(B, 'go'); game.puppet = { goal: [G[0], 0, G[2]], aim: null, throwAt: null, walk: K.samWalk }; return null; },
    tick: (B, S) => { const pl = game.player as unknown as { kick: object | null; char: { pos: Vec3 } }, el = game.time - B.pt;
      if (B.phase === 'go') { if (ajar(S)) game.doors.pullTo(S.door!, B.char.id);   // (picked with the leaf open: pulled to under his walk, as his own charge's row does — the tools work a leaf shut home)
        if ((flat(pl.char.pos, B.post!) > K.wayM || ajar(S)) && el < 4) return 'on'; S.door!.lockBroken = false; game.puppet = null; to(B, 'ask'); B.legT = NaN; return 'on'; }   // (the row is refused under Game.puppet)
      if (B.phase === 'ask') { if (pl.kick) { B.given = true; to(B, 'work'); return 'on'; } if (el >= K.ownAsk) { B.marks.push('kept'); V.refused = 'big: the door never offered it'; return 'done'; }
        if ((isNaN(B.legT) || game.time - B.legT > 0.5) && game.selectVerb('door', bigOf(0) === 'hammer' ? 'hammer' : 'breach')) { input.pressed.add('Space'); B.legT = game.time; } return 'on'; }
      if (B.phase === 'work') { if (isNaN(B.markT) && gave(S)) mark(B, 'gave'); if (pl.kick) return 'on'; if (isNaN(B.markT)) { B.marks.push('held'); return 'done'; }
        to(B, 'off'); game.puppet = { goal: [B.home[0], 0, B.home[1]], aim: null, throwAt: null, walk: K.samWalk }; return 'on'; }
      return flat(pl.char.pos, B.home) <= K.onSlot || el >= 3 ? 'done' : 'on'; } };
  /** a gun changed on the open card (the owner, 10-14: "holster what they've got, instantly get the new stuff, and then unholster"). A teammate has no
   *  stow pose: his hands' own errand (`swapGun`: the animator's kit swap, the model written at its far point) and the gun comes up as it ends. Sam: his real
   *  holster (the key), his card put on him again while his hands are empty, the draw, and the gun up */
  const samDraw = () => { input.pressed.add(cards[0]?.weapon === 'pistol' ? 'Digit1' : 'Digit2'); };
  const swapRow: Row = { door: 'shut', damage: 'none', rest: K.restQuiet, cap: 5,
    start: (B) => { to(B, 'stow'); if (!B.man) { input.pressed.delete('Digit1'); input.pressed.delete('Digit2'); if (!game.player.holstered) input.pressed.add('KeyE'); } return null; },   // (a draw owed by a swap cut this frame is not made: his hands are empty already)
    tick: (B, S) => { const el = game.time - B.pt, up = (): Step => { const rows = Q && !B.man ? [quietGun, gunRow] : [gunRow]; B.field = 'weapon'; for (const row of rows) { B.row = row; to(B, 'act'); if (row.start(B, S) === null) return 'on'; } return 'done'; };
      if (B.man) return el >= K.swapUp ? up() : 'on';
      const pl = game.player, busy = !!(pl.char.anim as unknown as { kitBusy?: boolean }).kitBusy;
      if ((busy || el < 0.2) && el < 1.5) return 'on';
      if (B.phase === 'stow') { samCard(); to(B, 'draw'); samDraw(); return 'on'; }
      return up(); } };
  // ------------------------------------------------------------ THE QUIET PICTURE'S ROWS (KIT_VIEW_QUIET; staged: `Q`)
  /** HIS SUPPRESSED GUN PUTS THE LAMP OUT: from the crouch the gun comes out, he rises to a half crouch on the lamp (`rise` s), ONE round — the game's
   *  own: the lamp is a target of its list, the round meets its box, the sparks and the dark are combat.ts's — and the pool dies. The dark is held
   *  `hold` s from the round: the fill lifts (after()), and he WALKS, down, through where the pool was to the door's jamb. Then the room is staged
   *  again under the dissolve (the restart's repairLights mends the lamp) and the loop rests `gunRest` s. Refused — the loud gun's row plays, as on
   *  every kind — where there is no lamp burning to shoot, or the gun in his hand is not suppressed (the shotgun is loud kit: its old row) */
  /** the gun's own gas out of the air (the smoke solver's emitters and what they have laid: nothing else smokes in this row) */
  const gasOut = () => { const sm = game.smoke as unknown as { emitters?: unknown[]; clearAll?(): void }; if (sm.emitters?.length) sm.clearAll?.(); };
  /** free floor all the way from a to b (the game's own grid, a quarter metre a step) */
  const walkFree = (a: V2, b: V2) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25); for (let i = 1; i <= n; i++) if (game.col.nav.isBlocked(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)) return false; return true; };
  const lampUp = () => !!pool && pool.on && !pool.broken && pool.disabledUntil < game.time && !!pool.light;
  const quietGun: Row = { door: 'shut', damage: 'world', rest: KIT_VIEW_QUIET.gunRest, cap: 14,
    start: (B, S) => { const pl = game.player; if (B.man) return 'the lamp is Sam\'s to shoot';
      if (!Q || !lampUp()) return 'no lamp burning to put out';
      if (pl.slot !== 'pistol' && pl.slot !== 'rifle') return 'no gun in his hand';
      if (!(pl.slot === 'rifle' ? pl.rifle.def : pl.pistol.def).suppressed) return 'not a suppressed gun';
      to(B, 'draw'); B.hTo = 1.1; samStand(S); if (pl.holstered) input.pressed.add(pl.slot === 'rifle' ? 'Digit2' : 'Digit1');
      if (KIT_VIEW_QUIET.cut && qLead === null) { qLead = FIXLOOK.on; FIXLOOK.on = false; }   // (the dead lamp's lead does not arc in this row: put back by quietUndo(), at the restage the row ends in)
      return null; },
    tick: (B, S) => { const pl = game.player, QK = KIT_VIEW_QUIET, el = game.time - B.pt, L = pool, p = pl.char.pos, ss = (u: number) => { const x = Math.max(0, Math.min(1, u)); return x * x * (3 - 2 * x); };
      if (!L) return 'done';
      if (B.phase === 'draw') {   // the gun out of its holster / off his back, on his place
        const busy = !!(pl.char.anim as unknown as { kitBusy?: boolean }).kitBusy, home = flat(p, S.sam) <= K.onSlot;
        if (((pl.holstered || busy || pl.equipT > 0 || el < 0.15) && el < 2.5) || (!home && el < 4)) return 'on';
        if (pl.holstered) { B.marks.push('kept'); V.refused = 'weapon: the gun never came out'; return 'done'; }
        const D = Math.max(0.5, flat(L.pos, [p[0], p[2]])), h0 = 1.15; B.quiet = true; B.hTo = h0 + (L.pos[1] - h0) * 3 / D;   // (the aim point is put 3 m out on his yaw: this high there, his line passes the lamp)
        B.legs = [{ yaw: yawTo(p, L.pos), cap: K.gunRate * R, minT: QK.rise, hold: 0.1 }]; B.leg = 0; B.legT = NaN; to(B, 'rise'); return 'on'; }
      if (B.phase === 'rise') { qRise = ss(el / QK.rise); if (!aimLegs(B) || el < QK.rise) return 'on';
        d.fire(null, [L.pos[0], L.pos[1], L.pos[2]]); V.shots++; B.shots++; B.shotT = game.time; B.marks.push('shot'); to(B, 'shot');
        if (QK.flick.intensity > 0) { const y = pl.char.aimYaw; engine.lights.flash([p[0] + Math.sin(y) * 0.5, 1.25, p[2] + Math.cos(y) * 0.5], [0.7, 0.8, 1], QK.flick.intensity, QK.flick.range, QK.flick.secs, 0); }   // (the cold flick on the wall beside him: he did that)
        return 'on'; }   // (ONE round, AT the lamp: the gun's own line, as every burst of the picture's is fired)
      if (B.phase === 'shot') { qRise = 1;
        if (L.broken) { mark(B, 'dark'); liftAt = game.time; if (QK.cut) { gasOut(); engine.resetTaa('kitview'); } to(B, 'dark'); B.legs = [{ yaw: yawTo(p, S.at([0, -1.5, 0])), cap: K.gunRate * R, minT: -1, hold: 0 }]; B.leg = 0; B.legT = NaN; B.hTo = 1; return 'on'; }
        if (el < 0.4) return 'on';
        B.marks.push('missed'); V.refused = 'weapon: the round did not put the lamp out'; B.legs = []; return quiet(B, S); }
      if (B.phase === 'dark') { const t = game.time - B.markT; if (QK.cut && t < 1.5) gasOut(); qRise = 1 - ss((t - QK.walkAt) / 0.4); aimLegs(B);
        if (t >= QK.walkAt && !B.post) {   // …and across where the pool was, down, to the jamb on his own side
          const al = (S.sam[0] - S.plan.anchor.mid[0]) * S.s[0] + (S.sam[1] - S.plan.anchor.mid[1]) * S.s[1], sg = al > 0 ? 1 : -1, jamb = (k: number) => S.at([k * (S.width / 2 + QK.jambAlong), S.plan.wall.face + QK.jambOut, 0]), ok = (q: Vec3) => !game.col.nav.isBlocked(q[0], q[2]);
          const Jf = jamb(-sg), J = QK.jambFar && ok(Jf) && walkFree([p[0], p[2]], [Jf[0], Jf[2]]) ? Jf : jamb(sg);
          B.post = ok(J) ? [J[0], J[2]] : [p[0], p[2]];
          if (flat(p, B.post) > 0.1) { B.marks.push('walk'); game.puppet = { goal: [B.post[0], 0, B.post[1]], aim: game.puppet?.aim ?? null, throwAt: null, walk: K.samWalk }; } }
        return t >= QK.hold ? 'done' : 'on'; }
      return quiet(B, S); } };
  /** THE SUIT, THE TRIM: no walk, no turn — he leans half a step toward the pool so that a shoulder catches it, holds, and leans back (down throughout) */
  const quietLean: Row = { door: 'shut', damage: 'none', rest: K.restQuiet, cap: 8,
    start: (B, S) => { if (B.man) return 'Sam\'s'; const QK = KIT_VIEW_QUIET, T = S.at([0, S.plan.wall.face + KIT_PLAN.offFace, 0]), dx = T[0] - S.sam[0], dz = T[2] - S.sam[1], len = Math.hypot(dx, dz);
      if (!Q || len < QK.leanM + 0.2) return 'no pool to lean into';
      const P: V2 = [S.sam[0] + dx / len * QK.leanM, S.sam[1] + dz / len * QK.leanM]; if (game.col.nav.isBlocked(P[0], P[1])) return 'no floor to lean onto';
      B.post = P; to(B, 'home'); samStand(S); return null; },
    tick: (B, S) => { const QK = KIT_VIEW_QUIET, p = game.player.char.pos, el = game.time - B.pt, walkTo = (q: V2) => { game.puppet = { goal: [q[0], 0, q[1]], aim: null, throwAt: null, walk: K.samWalk }; };
      if (B.phase === 'home') { if (flat(p, S.sam) > K.onSlot && el < 3) return 'on'; to(B, 'out'); walkTo(B.post!); return 'on'; }
      if (B.phase === 'out') { if (flat(p, B.post!) > 0.12 && el < 2) return 'on'; mark(B, 'lean'); to(B, 'hold'); game.puppet = { goal: null, aim: null, throwAt: null }; return 'on'; }
      if (B.phase === 'hold') { if (el < QK.leanSecs) return 'on'; to(B, 'back'); walkTo(S.sam); return 'on'; }
      return flat(p, S.sam) <= K.onSlot || el >= 2.5 ? 'done' : 'on'; } };
  /** SAM'S WEAPON LIGHT on the quiet picture: the opposite of quiet, so it is one blink — from the crouch the gun comes out, the beam is ON as his aim
   *  reaches the door's far jamb, crosses the door to the near one in `sweep` s, is held `hold` s and is OFF; the gun goes away again at rest (tidy()).
   *  No step, no hand on the leaf, and no cost (the row is not loud). Refused — the old row plays, as on every kind — on a teammate's card, at a blank
   *  wall, with no gun in his hand. Never seen on a GPU */
  const quietLight: Row = { door: 'shut', damage: 'none', rest: K.restQuiet, cap: 8,
    start: (B, S) => { const pl = game.player; if (B.man) return 'Sam\'s';
      if (!Q || walled(S)) return 'no door to cross';
      if (pl.slot !== 'pistol' && pl.slot !== 'rifle') return 'no gun in his hand';
      to(B, 'draw'); B.hTo = KIT_VIEW_QUIET.light.aimY; samStand(S); if (pl.holstered) input.pressed.add(pl.slot === 'rifle' ? 'Digit2' : 'Digit1');
      return null; },
    tick: (B, S) => { const pl = game.player, QL = KIT_VIEW_QUIET.light, el = game.time - B.pt, p = pl.char.pos;
      if (B.phase === 'draw') { const busy = !!(pl.char.anim as unknown as { kitBusy?: boolean }).kitBusy;
        if ((pl.holstered || busy || pl.equipT > 0 || el < 0.15) && el < 2.5) return 'on';
        if (pl.holstered) { B.marks.push('kept'); V.refused = 'light: the gun never came out'; return 'done'; }
        const m = S.plan.anchor.mid, sg = (S.sam[0] - m[0]) * S.s[0] + (S.sam[1] - m[1]) * S.s[1] >= 0 ? 1 : -1, w2 = S.width / 2, o = S.plan.wall.face;
        B.quiet = true; B.legs = [{ yaw: yawTo(p, S.at([-sg * w2, o, 0])), cap: K.gunRate * R, minT: -1, hold: 0 }, { yaw: yawTo(p, S.at([sg * w2, o, 0])), cap: K.gunRate * R, minT: QL.sweep, hold: QL.hold }]; B.leg = 0; B.legT = NaN; to(B, 'act'); return 'on'; }
      if (B.phase === 'act' && B.leg >= 1 && !B.lit) { B.lit = true; B.marks.push('beam'); }   // (on as his aim leaves the far jamb; quiet() puts it out as the leg home begins)
      return quiet(B, S); } };
  /** THE QUIET KIND'S ROWS, one table over BEATS — a tile's thing → what it plays on the quiet picture, by the card it is on; a thing not here, and a
   *  quiet row whose start refuses, plays its row of BEATS as on every kind (the wand and the sticky camera keep theirs, from the crouch; loud kit keeps
   *  its old row until it has a cost of its own: `Row.loud` is what that pass will read) */
  const QUIET_BEATS: Record<string, { mate?: Row; sam?: Row }> = { weapon: { sam: quietGun }, turn: { sam: quietLean }, light: { sam: quietLight } };
  const rowFor = (f: string, man: Guard | null): Row | undefined => (Q ? QUIET_BEATS[f]?.[man ? 'mate' : 'sam'] : undefined) ?? BEATS[f]?.[man ? 'mate' : 'sam'];
  /** the quiet picture with NO tile under the highlight: the rest pose is the picture (the loud one plays the gun, then the light) — the seam the torch
   *  pass hangs its idle on */
  const quietIdle = (S: Staged) => { void S; restUntil = game.time + 0.5; };
  // ------------------------------------------------------------ LOUD KIT'S COST · LIFE AT REST (KIT_VIEW_QUIET.cost / .idle; staged: `Q`)
  /** LOUD KIT ON A QUIET JOB SHOWS ITS COST: the loud row plays as on every kind, and as it ends (finish(): kitViewCostly) somebody inside has heard
   *  it — the room behind the door goes from dim to full behind the leaf still a hand ajar, `slit` s later the leaf is thrown wide (the game's own
   *  silent hand on it, away from the team) and a slab of warm light falls out along the wall over him, up out of his crouch: the picture's own lamp,
   *  hung for the cost alone (kitViewCostLamp). Held, then the lamp is out and the room dim again, and the room is staged again under the dissolve
   *  (every man on his place, the leaf ajar, the lamp mended, he down); the loop rests `rest` s. A pick ends it at once, the same way. No man of the
   *  level's is asked for anything: nobody is roused. Never seen on a GPU */
  let costT = NaN, costLamp: RtLight | null = null, costPool: { I: number; E: Vec3 } | null = null, costFeet: V2 = [0, 0]; const costSeen: { n: number; cuts: number; last: KitView['cost']['last'] } = { n: 0, cuts: 0, last: null };
  const costOn = () => !isNaN(costT);
  const costOff = () => { costT = NaN; if (costLamp) { engine.lights.remove(costLamp); costLamp = null; }
    if (costPool && pool) { pool.baseIntensity = costPool.I; pool.baseEmissive = [costPool.E[0], costPool.E[1], costPool.E[2]]; } costPool = null; };   // (the pool lamp's own base back: the restage finds it as it was)
  const costBegin = (S: Staged, B: Beat) => { const L = KIT_VIEW_QUIET.cost.lamp, D = S.door; lifeOff(true);
    const G = kitViewCostLamp(S.plan, S.width, S.sam, D && !D.off ? D.def.hinge : null, (x, z) => !game.col.nav.isBlocked(x, z));
    costT = game.time; costSeen.n++; costSeen.last = { field: B.field, i: B.i, share: 1, door: !!D && !D.off, leaf: 0, up: false, lamp: true, catches: G.catches, s: 0, how: '', moved: 0, pool: false };
    costFeet = [game.player.char.pos[0], game.player.char.pos[2]];   // (HE IS FROZEN where the row left him: tidy() holds him there, turned to the door)
    quietInside(1, KIT_VIEW_QUIET.cost.blade);
    costLamp = engine.lights.add({ name: 'kitview_cost', group: 'kitview', owner: 0, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, kind: 0 as const, pos: G.pos, dir: [0, -1, 0] as Vec3, color: [L.color[0], L.color[1], L.color[2]] as Vec3,
      intensity: L.intensity, peakIntensity: L.intensity, range: L.range, innerDeg: 0, outerDeg: 180, radius: L.radius, volumetric: 0, broad: false, enabled: true }); };
  /** each live frame with no row up: true while the cost plays (nothing else begins under it) */
  const costTick = (S: Staged): boolean => { if (isNaN(costT)) return false;
    const C = KIT_VIEW_QUIET.cost, el = game.time - costT, at = kitViewCostAt(el), D = S.door, pl = game.player, last = costSeen.last!;
    stowT = game.time; last.s = el; last.moved = Math.max(last.moved, flat(pl.char.pos, costFeet));   // (his gun stays as the row left it: nothing is put away under the slab)
    if (asked === null && !at.done) {
      pl.crouch = false;   // (he starts up as the room flares behind the leaf: standing, turned to it, when it is thrown)
      if (at.open) { if (D && !D.off) { unlock(S); const F = S.at([0, 1, 0]); game.doors.crack(D, F, pl.char.id, stepDt, undefined, C.swing, C.wideDeg * R); }
        if (!last.up) { quietInside(at.share, 0);   // (…and the blade's own lamp is out under the wedge, the room's own back down: ONE lamp throws it, one hard edge, one shadow)
          if (pool && !pool.broken && at.pool < 1) { costPool = { I: pool.baseIntensity, E: [pool.baseEmissive[0], pool.baseEmissive[1], pool.baseEmissive[2]] }; pool.baseIntensity = costPool.I * at.pool; pool.baseEmissive = [costPool.E[0] * at.pool, costPool.E[1] * at.pool, costPool.E[2] * at.pool]; last.pool = true; } }   // (…and the pool lamp out: its base, which the game multiplies each step — no round, no event, nobody hears a lamp go)
        last.up = true; }
      if (D && !D.off) last.leaf = Math.max(last.leaf, Math.abs(D.angle - S.shut));
      return true; }
    if (!at.done) costSeen.cuts++; last.how = at.done ? 'done' : 'cut';
    costOff(); quietInside(KIT_VIEW_QUIET.inside); dirty = 'world'; apart = true; restUntil = game.time; restNext = asked !== null ? NaN : C.rest;   // (cut to dark; what it left has no undo under the eye: the room staged again, every man ON his place)
    return false; };
  /** LIFE AT REST, with no guard: after `every` s of rest — nothing playing, nothing asked, nothing to mend, every man on his place, the leaf at its
   *  rest — the warm lamp behind the door slides along the wall, further past the latch, and back (kitViewIdleAt), so the warm blade through the leaf
   *  ajar swings round toward the hinge's side and back, dark for a blink as somebody passes the lamp; for its length nobody's gun wanders (scan(): held as it stands).
   *  The lamp that slides is the picture's own where it hangs one, else one hung for the beat at the same place. It never begins under a row, a pick
   *  or a cost, nor with a tile's own next turn due inside its length; a row that begins under it ends it that frame, the lamp put back. It does not
   *  read the pool lamp: the same with the pool shot out. Not at a blank wall (no opening to see it through). Never seen on a GPU.
   *  OFF AS SHIPPED (`idle.on` false: kitViewIdleOn): nothing here begins unless a check raises `idleOn` for itself */
  let lifeT = NaN, lifeNext = NaN, lifeN = 0, lifeStill = false, lifeLamp: RtLight | null = null, lifeHung = false, lifeHome: Vec3 = [0, 0, 0]; const lifeSeen = { n: 0, cuts: 0, far: 0 };
  const lifeOff = (cutIt = false) => { if (isNaN(lifeT)) return; if (cutIt) lifeSeen.cuts++; lifeT = NaN; lifeStill = false; lifeNext = NaN; const L = lifeLamp; lifeLamp = null; if (!L) return;
    if (lifeHung) engine.lights.remove(L); else { L.pos = [lifeHome[0], lifeHome[1], lifeHome[2]]; L.intensity = L.peakIntensity = KIT_VIEW_QUIET.own.intensity * qBlade; } };
  const life = (S: Staged) => { const QK = KIT_VIEW_QUIET, QI = QK.idle, pl = game.player;
    const busy = !Q || !said || !!beat || asked !== null || costOn() || dz.phase !== '' || dirty !== null || !!game.puppet || walled(S);
    if (isNaN(lifeT)) {
      if (!kitViewIdleOn(V.idleOn, QI)) { lifeNext = NaN; return; }   // (SWITCHED OFF — `idle.on`: no beat ever begins, on any way; one already up runs to its end)
      if (busy || isNaN(lifeNext)) { lifeNext = game.time + (V.idleEvery ?? kitViewIdleEvery(lifeN, QI)); return; }   // (the clock runs from the last frame that was not rest)
      if (game.time < lifeNext || (hi !== null && restUntil - game.time < QI.out * 2 + QI.stay + 0.5)) return;
      if (offRest(S) || flat(pl.char.pos, S.sam) > K.onSlot || S.order.some(g => flat(g.char.pos, homeOf(S, g).p) > K.homeM)) return;
      const hung = qOwn && engine.lights.lights.includes(qOwn) ? qOwn : null, O = QK.own;
      lifeT = game.time; lifeN++; lifeSeen.n++; lifeHung = !hung; lifeHome = hung ? [hung.pos[0], hung.pos[1], hung.pos[2]] : S.at([S.door ? S.latch * (S.width / 2 + O.side) : 0, S.plan.wall.back - O.back, O.up]);
      lifeLamp = hung ?? engine.lights.add({ name: 'kitview_idle', group: 'kitview', owner: 0, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, kind: 0 as const, pos: [lifeHome[0], lifeHome[1], lifeHome[2]] as Vec3, dir: [0, -1, 0] as Vec3, color: [O.color[0], O.color[1], O.color[2]] as Vec3,
        intensity: 0, peakIntensity: 0, range: O.range, innerDeg: 0, outerDeg: 180, radius: O.radius, volumetric: 0, broad: false, enabled: true }); }
    else if (busy) { lifeOff(true); return; }
    const a = kitViewIdleAt(game.time - lifeT, QI), L = lifeLamp; if (a.done || !L) { lifeOff(); return; }
    // (WHICH WAY: at a leaf ajar the gap is seen only from the latch's side, so the lamp slides FURTHER past the latch — the blade swings from
    //  straight out toward the hinge's side and back; slid the other way it is behind the leaf and the blade only goes out. At a gap: away from him)
    const m = S.plan.anchor.mid, sg = (S.sam[0] - m[0]) * S.s[0] + (S.sam[1] - m[1]) * S.s[1] >= 0 ? 1 : -1, way = S.door && !S.door.off ? S.latch : -sg;
    L.pos = [lifeHome[0] + S.s[0] * way * a.x, lifeHome[1], lifeHome[2] + S.s[1] * way * a.x];
    L.intensity = L.peakIntensity = (lifeHung ? QK.own.intensity * QI.gain * a.env : QK.own.intensity * qBlade) * a.lit;
    lifeStill = true; lifeSeen.far = Math.max(lifeSeen.far, a.x); };
  /** THE TABLE (calls 0: every demo is one row — what it does to the door, what it leaves that only a dissolve mends, its rest before it plays again): a
   *  thing on a card (a tile's field; 'turn' = suit / trim, 'swap' = a gun changed) → how a teammate (`mate`) and Sam use it at the door. A tile with no row
   *  here plays the gun's. The goggles are WORN kit — no order and no setter lowers them, nvg.ts — so their tile is the turn that shows him, as his suit's is: TILES) */
  const BEATS: Record<string, { mate?: Row; sam?: Row }> = {
    weapon: { mate: gunRow, sam: gunRow },
    light: { mate: lightRow, sam: lightRow },
    swap: { mate: swapRow, sam: swapRow },
    // a stun canister: bang and clear by that man alone — the coded entry (no menu, no words, never halted at the handle); Sam's own from his hand
    bangs: { mate: byOrder('bang', 'bangs', K.afterStun, 'none', (B, S) => { const r = tools().order('bangClear', [B.man!], S.door!, S.side); return typeof r === 'string' ? r : null; }), sam: thrown('flash') },
    // a fragmentation grenade: frag and clear, the menu's own order (it may be refused, halted at a handle that does not turn, or the grenade kept on the
    // belt because the leaf did not swing clear of the throw — doortools.ts fragWay: then it is 'lost' as he turns to go in). Its marks have no undo: held, then a restage under the dissolve
    frags: { mate: byOrder('frag', 'frags', K.aftermath, 'world', (B, S) => game.orders.give('fragClear', onDoor(S), roster(B.man!))), sam: thrown('frag') },
    smoke: { mate: thrown('smoke'), sam: thrown('smoke') },
    // a door charge: he sets it and stands off; Sam's trigger once he is clear; the leaf lies on the floor through the hold, and is hung again under the dissolve
    charges: { mate: { door: 'none', damage: 'leaf', loud: true, leaf: true, rest: K.hold, cap: 12,
      start: (B, S) => { B.base = tools().stats.blown; return game.orders.give('charge', onDoor(S), roster(B.man!)); },
      tick: (B, S) => { const c = tools().set.find(x => x.door === S.door);
        if (isNaN(B.markT) && tools().stats.blown > B.base) mark(B, 'blow');
        if (!isNaN(B.markT)) return game.time - B.markT >= K.aftermath ? 'done' : 'on';
        if (c) { if (B.phase !== 'set') { to(B, 'set'); B.marks.push('set'); } if (game.time - B.pt >= K.clearSecs || tools().ops.some(o => o.kind === 'charge' && o.door === S.door && o.phase === 'armed')) tools().trigger(c); }
        return 'on'; } }, sam: ownCharge },
    wand: { mate: wandMate, sam: wandRow }, cams: { sam: camRow }, shells: { sam: shellRow }, rings: { sam: ringRow }, walls: { mate: wallRow, sam: wallRow }, bigtool: { mate: bigMate, sam: bigSam },
    // suit, trim: one eased quarter turn — the quarter that shows the camera his front (out from the wall) — and back
    turn: (() => { const row: Row = { door: 'shut', damage: 'none', rest: K.restQuiet, cap: 10,
      start: (B, S) => { const a = B.yaw + K.turnDeg * R, b = B.yaw - K.turnDeg * R, y = Math.sin(a) * S.n[0] + Math.cos(a) * S.n[1] >= Math.sin(b) * S.n[0] + Math.cos(b) * S.n[1] ? a : b;
        B.quiet = true; B.turn = true; B.hTo = 1.1; B.legs = [{ yaw: y, cap: K.bodyRate * R, minT: K.turnEase, hold: K.turnSecs }];
        if (!B.man) samStand(S); return null; },
      tick: quiet }; return { mate: row, sam: row }; })(),
  };
  /** THE TILES, ONE table: a tile's field → the thing it plays, by the card it is on — a field not here plays the row of its own name (null: none — the gun,
   *  then the light). A field whose VALUE names the demo is one line here (`big`: the big slot's tile, the wall charge's row while a wall charge is what is in it):
   *  the highlight is kept as the tile's FIELD (`hiF`) and read through this table again at every kit message */
  const TILES: Record<string, (card: Record<string, unknown>) => string | null> = { weapon: () => 'weapon', primary: () => 'weapon', secondary: () => 'weapon', suppressed: () => 'weapon', sideCan: () => 'weapon', suit: () => 'turn', trim: () => 'turn', nvg: () => 'turn',
    big: c => num(c.walls) > 0 ? 'walls' : c.big === 'shotgun' || c.big === 'hammer' ? 'bigtool' : null };   // (THE BIG SLOT, read as kit.ts bigOf reads the card: a wall charge in it plays the wall charge's row, the breaching shotgun and the hammer the tool's own on the door — nothing in it has none)
  const thing = (f: unknown, i = who): string | null => typeof f !== 'string' ? null : Object.hasOwn(TILES, f) ? TILES[f](cards[i] ?? {}) : Object.hasOwn(BEATS, f) && f !== 'turn' && f !== 'swap' ? f : null;
  // (THE BIG SLOT — kit.ts BIGSLOT, the card's last tile, field `big`: what is in the open card's slot is the card read as kit.ts bigOf reads it — `walls` over 0, else `big` 'shotgun' | 'hammer' | 'none'. A change of it under the highlight comes as a `kit` message, not a `sel`: the kit message reads `hi` again)
  const actor = (): Guard | null => who > 0 ? d.team()[who - 1] ?? null : null;   // (member i is the team's [i − 1]: the staging's order is the cards')
  /** THE LOOP HOLDS ON THE HIGHLIGHTED TILE (calls 1e): it never wanders through his other kit. No tile under the highlight (the cards, the size, a tile
   *  with no row): the gun, then the light */
  const nextThing = (): string => hi ?? (flip % 2 ? 'light' : 'weapon');   // (`flip` moves on as it begins: direct())

  // THE DISSOLVE (the owner, 10-14: "i don't like the fade to black animations"): ONE mechanism for what cannot be done live — the team's size,
  // the goggles, a blown door hung again, a frag's room. The last frame drawn is copied to a 2D canvas laid over the game's (in the task that
  // drew it: a WebGPU canvas reads back empty after it), the work is done under it on the next frame — every man put back where he stood, the file's order
  // kept — `settle` frames are drawn, and the copy fades out over `dissolveMs`. The camera is pinned, so the picture dissolves onto itself: only what
  // changed is seen changing. The director runs on underneath (a thing asked for begins under it). No copy to be had: the work is done as it stands
  const dissolve = (work: () => void) => { if (!kitViewLoop || !said || state === 'none') { work(); return; } dz.work.push(work); if (dz.phase !== 'work') dz.phase = 'ask'; };   // (a frame that finds it still asked for — asked outside the director's own frame: a card's change — holds a pick under 'mend': before())

  /** everything a staging needs before the world is let go: Sam cannot be killed and his belt refills (a sandbox row's flags: this instance files nothing),
   *  no autosave is built, the turn weight set and Sam's yaws governed, each sent to his slot from where he stands, the pools as the cards have them */
  const live = (S: Staged) => {
    game.godMode = true; game.infiniteAmmo = true; game.saves.enabled = false; game.tune.qrf = false;   // (…and no response team is ever called to a bang at this door)
    if (who > 0 && !actor()) who = 0;   // (the open card's man did not come: Sam)
    const pl = game.player; govern(pl.char); samCh = chan(pl.char.aimYaw); samH = 0;
    walk.clear(); swaps.length = 0; beamDir = null; kneel = null; homeT = NaN; stay(false);
    S.order.forEach(g => go(g, [homeOf(S, g).p]));
    d.turn(`1,aim=${(K.gunRate * R).toFixed(3)},aimAcc=${(K.gunRate * R / K.ramp).toFixed(2)},body=${(K.bodyRate * R).toFixed(3)},bodyAcc=${(K.bodyRate * R / K.ramp).toFixed(2)}`);
    d.team().forEach((g, k) => { const t = d.tints(k + 1); if (!t.suit) issued.suit.set(k + 1, [...g.char.tint] as Vec3); if (!t.trim) issued.trim.set(k + 1, [...g.char.tint2] as Vec3); });   // (a card as issued: what the scenario staged him in is what 'issued' means when he is written live)
    for (const g of d.team()) g.god = true;   // (IN THIS PAGE ONLY: Sam's own frag is thrown with the team a wall away — its judge passes a man so flagged, frag.ts)
    pools(); ventAt = -1; ventKill = -1; dirty = null; state = 'rest'; restUntil = game.time + (asked !== null ? 0 : K.restStage);
    if (who > 0) rotate(S, actor());
  };
  const finish = (B: Beat, how: string) => {
    const S = staged; if (beat === B) beat = null; lastEnd = game.time;
    const far = !!S && !!B.row.team && S.order.some(g => flat(g.char.pos, homeOf(S, g).p) > K.wallOff);   // (the whole team's row left men down the wall: no walk home through each other — put back under the dissolve)
    if (fogUp) { fogUp = false; game.fogOfWar.on = false; game.fogOfWar.viewer = false; game.fogOfWar.reset(); game.player.wand = wandWas; if (wandKit) { wandKit.k.wand = wandKit.was; wandKit = null; } }   // (the wand's row: the fog was the game's for its length. A look still under way ends in the next step by the game's own rule — no fog, and tidy() walks him)
    V.last = { n: B.n, field: B.field, i: B.i, t: B.t, phase: B.phase, marks: B.marks, how, rest: B.rest, peak: B.peak, flash: B.flash, drift: B.drift };
    if (B.field === 'smoke' && !isNaN(B.markT)) ventAt = B.markT + K.ventSecs;
    input.clicked = 0; input.buttons = 0; B.lit = false; beamDir = null; kneel = null; stay(false);
    if (S) { for (const g of S.order) low(g, lowAt(S, g));   // (everybody up — and the men the row took off their slots home, the nearest the door first: not a card switch's walk — arriving() — but a row of Sam's waits for them all the same, `swapSecs` at most: homing())
      const quick = how === 'cut';   // (A PICK cut it: all of them at once, at the card switch's pace — a row of Sam's waits `homeSecs` for them: homing())
      homeMen = B.moved.filter(g => g !== B.man); homeUntil = homeMen.length ? game.time + K.swapSecs : -1;
      if (!far) B.moved.forEach((g, j) => { if (g !== B.man && S.order.includes(g)) { go(g, [homeOf(S, g).p], quick ? K.swapPace : K.pace, quick ? 0 : K.shuffle[1] * (B.moved.length - 1 - j)); walk.get(g)!.t0 = -1e9; } }); }
    if (!B.man) game.player.crouch = Q;   // (the quiet picture: he stays down)
    if (B.shots) (B.man ? B.man.weapon : game.player.gunInHand())?.rearm();   // (his burst went through Firearm.fire — deps.fire: the rounds are counted, which is what lights a tracer round — and the magazine is topped up as the row ends)
    if (B.man) { const W = walk.get(B.man), A = game.orders.of(B.man); if (W) { W.watch = null; W.face = undefined; } if (A && A.order === 'cover') { A.watch = null; A.upper = 'none'; A.stance = 'lowReady'; A.face = S && S.order.includes(B.man) ? homeOf(S, B.man).yaw : A.face; }
      if (S && S.order.includes(B.man) && !(W && W.lane) && !far) go(B.man, B.via ? [B.via, homeOf(S, B.man).p] : [homeOf(S, B.man).p], how === 'cut' ? K.swapPace : K.pace); }   // (`via`: back by the corner he came round, not through the stack)
    else { const pl = game.player, G = govs.get(pl.char); if (Q && B.hand && pl.slot !== B.hand) { pl.slot = B.hand as typeof pl.slot; pl.holstered = true; }   // (the quiet picture: his hands were empty of a gun before the row and are after it — the gun selected again, put away, as a card writes it)
      else if (B.hand && pl.slot !== B.hand) { input.pressed.add(B.hand === 'rifle' ? 'Digit2' : 'Digit1'); handDue = B.hand; }   // (`handDue`: a launcher's row begun this very frame reads his hand before that key lands — handWas())
      if (G && !game.puppet?.aim) { samCh.v = samCh.want = G.aim.v; samCh.w = G.aim.w; samCh.own = false; }   // (a row that ran his channel with no Game.puppet to carry it to his gun — the wall charge on his card, its `spot`: the next row of his, begun this frame, eases from where the gun POINTS)
      game.puppet = null; if (tubeWas !== -2) { pl.rifle.attIdx = tubeWas; tubeWas = -2; }   // (tidy() walks him the half step home)
      if (B.row === swapRow && B.phase === 'stow') { samCard(); samDraw(); } }   // (his swap ended — a pick's cut, its cap, a throw — with his hands still empty: the cards already have the new gun, so nothing later would put it on him. His card and the draw, now)
    restUntil = game.time + (how === 'cut' ? 0 : B.marks.includes('kept') ? Math.min(B.row.rest, K.restQuiet) : hi === null && B.row.damage === 'none' && B.row.rest === K.restQuiet ? K.restNone : B.row.rest);   // (a thing kept — a charge the door never offered, a throw refused: a short rest, never the hold of a thing that went off)
    // A WALL THAT OPENS ONCE, LOUDLY: the charge that opened a blank wall for another row leaves its hole — the men put home under the dissolve, the wall NOT stood
    // again — and the row asked plays through it from then on (the loop holds on its tile); the wall charge's own tile, picked later, mends it first (begin())
    if (S && B.prelude && B.marks.includes('hole')) { S.hole = true; dirty = 'hole'; apart = false; restUntil = game.time + (how === 'cut' ? 0 : K.restQuiet); }
    else if (S && B.row.damage !== 'none' && (!!S.door?.off || B.marks.includes('frag') || B.marks.includes('gave') || (!!B.row.team && (B.marks.includes('blow') || far)))) { dirty = (!!S.door?.off || B.marks.includes('gave')) && B.row.damage === 'leaf' ? 'leaf' : 'world'; apart ||= far;
      if (how !== 'cut' && !isNaN(B.markT)) restUntil = B.markT + K.hold; else if (how !== 'cut' && B.row.team) restUntil = game.time + K.restQuiet; }   // (what it left has no undo: held as a resting picture, mended under the dissolve when the next row starts or the hold ends)
    // THE WALL CHARGE'S ROW OVER WITH NOTHING BLOWN (the stand-clear gate ran out, the order was refused once Sam had walked clear, the charge was lost, the row's
    // cap — never a pick's cut: that is the owner's): REMEMBERED for this way, whatever exit it was — the tile is the gun's row from then on. And a charge still
    // on the wall, or an order still out, is NOT taken down under the eye: the room is staged again under the dissolve, now — nothing is held (tidy() leaves it be)
    // THE LAMP SHOT OUT has no undo under the eye: the dark held to the row's end, then the room staged again under the dissolve (the restart mends the
    // lamp) and the loop's next turn waits `gunRest` — a pick still begins at once
    if (S && B.row === quietGun && pool?.broken) { dirty = 'world'; restUntil = game.time; restNext = how === 'cut' ? NaN : KIT_VIEW_QUIET.gunRest; }
    if (S && B.row === wallRow && how !== 'cut' && !B.marks.includes('blow')) {
      const no = B.marks.includes('cap') ? 'the wall charge never went off inside its row' : (V.refused ?? '').replace(/^[a-z]+: /, '') || 'the wall charge came down unblown'; wallKept(S, B, no); if (V.refused === null) V.refused = `walls: ${no}`;
      const WC = game.wallCharge; if (WC && (WC.set.length || WC.ops.length || B.marks.includes('down') || far)) { dirty = 'world'; apart ||= far; restUntil = game.time; } }
    // LOUD KIT'S COST (the quiet picture): a loud row that went off is answered from inside — costBegin(); what the row left is mended by the cost's own restage
    if (S && kitViewCostly({ quiet: Q, loud: !!B.row.loud, prelude: B.prelude, how, gun: B.row === gunRow || B.row === gunDoor, shots: B.shots, suppressed: !!(B.man ? B.man.weapon : game.player.gunInHand())?.def.suppressed, marked: !isNaN(B.markT) })) costBegin(S, B);
  };
  /** THE CUT (calls 1d): a pick ends whatever is running, now. A quiet beat: nothing to mend (his yaws come round under a rate: the next beat eases from where the
   *  gun points). A throw before the can left the hand: the wind-up cancelled, the open leaf the next row's to use or tidy()'s to pull to. A can already
   *  out: not waited for and not taken away — a stun goes off on its own fuse, a smoke's vent is shut. A frag not yet burst: taken away. A door order under
   *  way: the door tools' own reset (a charge set comes off). What is already broken: finish() marks it, and the next row starts under the dissolve */
  const cut = (S: Staged) => { const B = beat; if (!B) return; const pl = game.player; V.cuts++;
    if (!B.man && !B.item) { pl.pendingThrow = null; pl.throwHeld = false; }
    if (!B.man && pl.charging) tools().cancelSam();   // (his own charge, his hands still on it: nothing was spent)
    if (B.field === 'smoke' && (B.thrown || B.item)) { shutCans(); ventKill = game.time + K.ventKill; }
    { const I = game.items.items as unknown as { kind: string; fired: boolean }[]; for (let i = I.length - 1; i >= 0; i--) if (I[i].kind === 'frag' && !I[i].fired) I.splice(i, 1); }
    if (B.field === 'frags' && isNaN(B.markT) && (tools().stats.frags > B.base || !!B.item?.fired)) mark(B, 'frag');   // (burst in a step just before this cut — the row's own tick never saw it, or the door tools have not counted it yet: they tick BEFORE the items do, so a burst is theirs a step late and the thing thrown says it first. Damage done all the same: finish() has the room staged again)
    if (!B.man) { pl.launchHeld = null; if (B.row === camRow) pl.cams.length = 0; }   // (the launcher's button down, not yet let go: nothing is sent — and a camera in the air or on its wall is taken away)
    const onWall = !!B.row.team && game.wallCharge.set.length > 0;   // (a charge already ON the wall is not taken off under the eye: the room is staged again under the dissolve, and it goes under that — below)
    if (B.row.team && !onWall) game.wallCharge.reset();   // (the order, nothing yet set: taken away — pools() below writes the count again)
    if (B.row === bigSam) (pl as unknown as { kick: object | null }).kick = null;   // (his beat on the door, broken off: game.ts Game.kick is the whole of it — the tool's own clock rides it)
    if (B.row.door === 'none' || B.given) { tools().reset(); pools(); }
    void S; finish(B, 'cut'); if (onWall) dirty = 'world'; };
  /** what the last rows left on the floor, off it once it is old: nothing is taken away under the eye (a can just thrown lies where it fell) */
  const litter = () => { const I = game.items.items as unknown as { age: number }[]; for (let i = I.length - 1; i >= 0; i--) if (I[i].age > K.litter) I.splice(i, 1); while (I.length > 5) I.shift(); };
  const begin = (S: Staged, f: string): void => {
    const man = actor(), k = man ? S.order.indexOf(man) : -1; if (man && k < 0) { restUntil = game.time + 1; return; }
    if (f === 'light' && (man || kitTreeOn()) && cards[who]?.light !== true) f = 'weapon';   // (no light fitted: the gun comes up dark — the toggle is the tile's job. Yours is a row only on the tree's card: before it you always had one)
    if (!BEATS[f]?.[man ? 'mate' : 'sam']) f = 'weapon';
    const qRow = Q ? QUIET_BEATS[f]?.[man ? 'mate' : 'sam'] : undefined;   // (the quiet picture's row for this thing, where it has one)
    const c = man ? man.char : game.player.char, H = man ? homeOf(S, man) : { p: S.sam, yaw: S.samYaw };
    const B: Beat = { n: beatN + 1, field: f, i: who, t: 0, phase: 'act', marks: [], row: qRow ?? BEATS[f][man ? 'mate' : 'sam']!, man, char: c, home: H.p, yaw: H.yaw, t0: game.time, pt: game.time, markT: NaN, base: 0, post: null, spot: null,
      prelude: false, lit: false, thrown: false, given: false, hand: '', item: null, old: new WeakSet(game.items.items as unknown as object[]), rest: null, peak: 0, flash: 0, drift: 0,
      ch: man ? chan(c.aimYaw) : samCh, legs: [], leg: 0, legT: NaN, quiet: false, turn: false, pitch: null, rose: false, hTo: 1.1, moved: [], loose: false, fire: null, shots: 0, shotT: NaN, via: null };
    if (S.hole && B.row === wallRow) { dirty = 'world'; reask(f); hold('mend'); return; }   // (the wall charge's own tile at a wall already open: the wall stood again under the dissolve first, then its whole row)
    if (S.hole && shot && holeShots >= K.holeBursts) { dirty = 'world'; reask(f); hold('mend'); return; }   // (bursts through a wall left open are not mended live — mend(): after `holeBursts` of them the room is staged again under the dissolve, the wall standing, then this row)
    if (B.row.opening && walled(S)) { const no = shutWall.get(S.plan);   // (this way's wall would not open on its span: remembered — the gun's row and why, and no charge is spent on it again)
      if (no !== undefined) { V.refused = `${f}: ${no}`; if (!man) game.puppet = null; begin(S, 'weapon'); return; }
      B.row = wallRow; B.prelude = true; B.marks.push('prelude'); }   // (a blank wall, still whole, and a row that needs an opening: the wall charge first — refused, the gun's row and why)
    mend(); litter(); pools(B.prelude ? 'walls' : f); game.player.cams.length = 0;   // (…and a camera the last row left on its wall)
    let why: string | null; try { why = B.row.leaf && !S.door ? 'no leaf at this way in' : B.row.start(B, S); } catch (err) { why = String(err); }
    if (qRow) { qKept = why !== null ? `${f}: ${why}` : null;   // (a quiet row refused: the thing's own row of BEATS, as on every kind — and why, kept for a check)
      if (why !== null) { B.row = BEATS[f][man ? 'mate' : 'sam']!; try { why = B.row.leaf && !S.door ? 'no leaf at this way in' : B.row.start(B, S); } catch (err) { why = String(err); } } }
    if (why !== null) { V.refused = `${f}: ${why}`; if (!man) game.puppet = null; if (f !== 'weapon') { begin(S, 'weapon'); return; } restUntil = game.time + 1; return; }   // (refused: the gun's beat instead — never a dead cursor — and why is kept for a check)
    if (Q && !man && game.player.holstered && (B.row === gunRow || B.row === gunDoor || B.row === lightRow)) input.pressed.add(game.player.slot === 'rifle' ? 'Digit2' : 'Digit1');   // (the quiet picture rests with his gun put away: a row of the gun's own has it out)
    beatN++; beat = B; if (f !== 'weapon' || (B.row !== gunRow && B.row !== gunDoor && B.row !== quietGun)) V.refused = null;
    if (held && held.n === beatN) held.s = game.time - askT;   // (the row a pick waited for is up: the word's clock runs from the hearing to this)
  };
  /** between and under the beats: the leaf pulled to when no row has it open, Sam walked the half step home, a door order nobody's beat owns taken down */
  let stuckD = Infinity, stuckT = 0;
  const tidy = (S: Staged) => {
    const D = S.door, B = beat, pl = game.player;
    // (THE LEAF AT REST: shut — or, on the quiet picture, a hand ajar: `rest`. There it is pulled TO only for a row that works a shut leaf, or one that
    //  waits for it shut (waits(): `leafAsk`), and eased back ajar after — the host's own hand on the angle, no latch, no noise)
    const toShut = S.rest === S.shut || (B ? !!B.row.leaf : game.time < leafAsk);
    if (D && (!B || B.row.door === 'shut') && !D.off && toShut && Math.abs(D.angle - S.shut) >= 0.03 && game.time - pulled > 1) { pulled = game.time; game.doors.pullTo(D, (B ? B.char : S.order[0]?.char ?? pl.char).id); }
    if (D && (!B || B.row.door === 'shut') && !D.off && !toShut && !costOn() && Math.abs(D.angle - S.rest) > 1e-4) { const dA = S.rest - D.angle, st = KIT_VIEW_QUIET.leafRate * stepDt, L = D as unknown as { latched: boolean; closing: boolean; vel: number; angle: number }; L.latched = false; L.closing = false; L.vel = 0; L.angle = Math.abs(dA) <= st ? S.rest : D.angle + Math.sign(dA) * st; }
    // (…and his gun, left out by a row, goes back in its holster / across his back once he is home: his own key, the game's own motion)
    if (Q && !B && !game.puppet && !pl.holstered && (pl.slot === 'pistol' || pl.slot === 'rifle') && game.time - stowT > 1 && flat(pl.char.pos, S.sam) <= K.onSlot && !(pl.char.anim as unknown as { kitBusy?: boolean }).kitBusy && asked === null && game.time - lastEnd >= KIT_VIEW_QUIET.stow) { stowT = game.time; input.pressed.add('KeyE'); }
    // (AT A WALL LEFT OPEN — `hole`: what the charge threw down may lie on his place. A half step home that gets no nearer for a second is given up, and where he
    //  stands IS his place: Game.puppet left on him would refuse the squad every order for as long as the hole is kept)
    if (S.hole && game.puppet && !game.puppet.aim && !game.puppet.throwAt && (!B || B.man)) { const dH = flat(pl.char.pos, S.sam); if (dH <= K.onSlot || dH < stuckD - 0.02) { stuckD = dH; stuckT = game.time; } else if (game.time - stuckT >= 1 && dH <= K.samGive) { S.sam = [pl.char.pos[0], pl.char.pos[2]]; stuckD = Infinity; stuckT = game.time; } }   // (only the half step itself, and only its last stretch: a walk still metres out is a walk)
    else { stuckD = Infinity; stuckT = game.time; }
    // (THE QUIET PICTURE: Sam rests a body's width from where the game stacks a man on the door, and a partner taking his post shoulders him a few
    //  centimetres — over `onSlot`, and the walk home this gives him is Game.puppet, which takes the partner's order away: his frag went back on his
    //  belt. Under a teammate's row he is left where he was shouldered to, up to a quarter metre more; the row over, he is walked home as ever)
    //  (…AND HE GIVES WAY FIRST: with a partner's card open his place IS a step back along the wall — KIT_VIEW_QUIET.stepBack — so the walk there is
    //  this same walk home, taken as the card opens; a row of the partner's waits for it as it waits for any half step of his: waits(), 'sam')
    if (S.samBack) { const w = actor() ? S.samBack : S.samRest; if (S.sam[0] !== w[0] || S.sam[1] !== w[1]) S.sam = [w[0], w[1]]; }
    const slack = Q && B && B.man ? 0.25 : 0;
    if (costOn()) game.puppet = { goal: null, aim: S.at([0, 0, KIT_VIEW_QUIET.cost.aimY]), throwAt: null };   // (CAUGHT: under the cost he is frozen — no walk home, his feet where the row left them, turned to the door)
    else if ((!B || B.man) && !(B && B.row.team)) { if (flat(pl.char.pos, S.sam) > K.onSlot + slack && !(V.home && !B && !actor() && away(S))) game.puppet = { goal: [S.sam[0], 0, S.sam[1]], aim: null, throwAt: null, walk: K.samWalk }; else if (game.puppet) game.puppet = null; }   // (not under the whole team's row: Game.puppet takes the squad's order away — nor while a row of his waits for the men to walk home: under it they stood until he was home)
    if (!B && (tools().ops.length || tools().set.length)) { tools().reset(); pools(); }
    { const WC = game.wallCharge; if (!B && dirty !== 'world' && WC && (WC.ops.length || WC.set.length)) { WC.reset(); pools(); } }   // (not while the room waits for its restage: a charge that came down unblown goes under the dissolve, never off the wall under the eye — finish())
    if (!B && shot && game.time - shotAt >= K.hold) mend();   // (the pane his rounds broke: whole again, plain)
  };
  /** the encounter restarted and the team staged again as the table and the size now stand — every man put back where he stood, the file's order kept
   *  (`keep` false: a plain staging, the page's first) */
  const open = () => { const i = want >= 1 && d.team()[want - 1] ? want : 0; if (i === who) return false; who = i; flip = 0; return true; };   // (the card asked for, if its man is on the team as it now stands — a `sel` may come before the kit message that brings him)
  const unhang = () => { for (const who of ['porch', 'fill'] as const) { const l = lamps[who]; if (l) engine.lights.remove(l); } if (qOwn) engine.lights.remove(qOwn); costOff(); lifeOff(); quietUndo(); };   // (…the quiet picture's own lamp with them, and the room's lamps as the mission has them)
  const restage = (keep = true, onSlots = false) => {
    const S = staged, T = d.team(), pose = (c: { pos: Vec3; bodyYaw: number; aimYaw: number }): Pose => [c.pos[0], c.pos[2], c.bodyYaw, c.aimYaw];
    const kept: Keep | null = keep && S ? { perm: S.order.map(g => T.indexOf(g)), poses: onSlots ? [] : T.map(g => pose(g.char)), sam: pose(game.player.char) } : null;   // (`onSlots`: the file's order kept, each teammate ON his place)
    // (the picture's own two lamps come off the list for the restart and are hung again by place(): the game counts steady lights as it stands each man up, and a
    //  level near the light buffer's 64 — the bundled office — refused the fourth teammate with the lamps still on it: the picture went out on its first restage)
    unhang();
    try { beat = null; game.puppet = null; input.pressed.clear(); input.clicked = 0; game.restartEncounter(); V.restarts++; open(); stage(sizeN, actor(), kept); cam.kick = null; }
    catch (err) { console.error('kitview: the restart before a staging threw —', err); beat = null; none(); }   // (the end of the picture, said once: `none` is never staged again)
  };
  /** a blown door hung again: the leaf, the marks, the door tools — nobody staged, the rain and the men live under the dissolve */
  const rehang = (S: Staged) => { S.door?.reset(); game.decals.clear(); (game.destr as unknown as { clearMoving?(): void }).clearMoving?.(); tools().reset(); pools(); V.rehangs++; };
  const undo = (S: Staged) => { const what = dirty, on = apart; dirty = null; apart = false; dissolve(what === 'leaf' ? () => rehang(S) : what === 'hole' ? () => seat(true) : () => restage(true, on)); };
  /** THE WAIT: no row is begun into a refusal that is about to clear (begun then, it used up the pick and the gun's row played instead). A teammate's while
   *  Game.puppet has Sam on the half step home (the squad's orders are refused under it and taken away each step: his gun or his light would play unseen); a
   *  door order's while the leaf is not yet to (the order's own test says "it's open": tidy() is pulling it — not Sam's own charge, nor the big slot's tools: each of those rows begins at once and pulls the leaf to itself, under his walk to the door / before its order is given). KIT_VIEW_LOOP.wait s at most, then begun as it stands */
  const waits = (S: Staged, f: string): boolean => {
    const man = actor(), row0 = rowFor(f, man), row1 = row0?.opening && walled(S) && !shutWall.has(S.plan) ? wallRow : row0, row = row1 === wallRow && row0 === wallRow && shutOwn.has(S.plan) ? gunRow : row1;   // (the charge that opens the wall for it is the squad's order: waited for as the wall charge's own row is)
    if (!((!!man && !!game.puppet) || (!!row && !!row.team && (!!game.puppet || flat(game.player.char.pos, S.sam) > K.onSlot)) || (!!row && row.door === 'none' && row !== ownCharge && row !== bigSam && row !== bigMate && leafWait(S)))) return false;
    if (isNaN(waitT)) waitT = game.time;
    if (S.rest !== S.shut && row && row.door === 'none') leafAsk = game.time + 0.5;   // (the quiet picture's leaf rests ajar: a door order waits for it SHUT — tidy() pulls it to while this asks)
    return game.time - waitT < K.wait; };
  /** no row of SAM's begins while a man the last row took off his slot (the stack stood off his charge) is not home: Game.puppet —
   *  every row of Sam's — holds each man where he stands, so the stack stood a slot back for the whole of the next row. The cut itself, Sam walked home by
   *  tidy() and the men's walk ARE what a pick shows at once; `swapSecs` at most from the row's end.
   *  HOME (10-15): ANY man off his place, whoever took him off it (a restart makes new men: the list of the men 'the last row moved' named nobody, and a
   *  row of Sam's begun 0.3 m short of home froze them there) — `homeM`, for `homeSecs` at most; then, and at once for a man `farM` off (he ran from a
   *  grenade), every man not on his place is PUT on it under the dissolve: it exists for what cannot be mended live, and a pick is not left dead for a walk.
   *  While a row of Sam's waits for the men, tidy() does not walk SAM home (his puppet would hold them where they are); his own walk is not waited for:
   *  the row begins the frame every teammate is home, from where Sam stands (a cut sent them together at `swapPace`: finish()) */
  const offHome = (S: Staged, g: Guard) => flat(g.char.pos, homeOf(S, g).p), away = (S: Staged) => S.order.some(g => offHome(S, g) > K.homeM);
  const seat = (sam = false) => { const S = staged; if (!S) return; V.seats++;
    for (const g of S.order) { const H = homeOf(S, g).p; if (flat(g.char.pos, H) <= K.homeM) continue; g.char.pos = [H[0], 0, H[1]]; g.char.vel = [0, 0, 0]; g.speed = 0; g.path = []; g.pathGoal = null; go(g, [H]); }
    if ((sam || !actor()) && flat(game.player.char.pos, S.sam) > K.onSlot) { game.teleportPlayer([S.sam[0], 0, S.sam[1]]); game.puppet = null; } };   // (`sam`: on a TEAMMATE's card too — the charge that opened the wall for his row walked Sam clear of it, and a walk home under Game.puppet outlasted the row's wait: the teammate's order was refused under it and the gun's row played for the pick)
  const homing = (S: Staged) => { if (!V.home) return !actor() && game.time < homeUntil && homeMen.some(g => S.order.includes(g) && flat(g.char.pos, homeOf(S, g).p) > K.onSlot + 0.1);
    if (S.order.some(g => !walk.get(g)?.lane && offHome(S, g) > K.farM)) { homeT = NaN; dissolve(() => seat()); return true; }   // (ANY row: nobody is walked five metres under it, and no row begins with its man that far from where it would put him)
    if (actor() || !away(S)) { homeT = NaN; return false; }   // (a teammate's row is his own walk; Sam's waits for the men, on their own legs)
    if (isNaN(homeT)) homeT = game.time;
    for (const g of S.order) { const W = walk.get(g); if (W && !W.lane && offHome(S, g) > K.homeM && (W.pace < K.swapPace || W.at > game.time)) { W.pace = K.swapPace; W.at = Math.min(W.at, game.time); W.sent = null; } }   // (a row of Sam's is waiting: every man on his way home walks NOW and at the switch's pace, whoever dealt him the walk — a row's natural end staggers them at `pace`)
    if (game.time - homeT >= K.homeSecs) { homeT = NaN; dissolve(() => seat()); }
    return true; };
  /** `__kitview.held`: a PICK (`asked`) that this frame did not begin, and which rule kept it — said by the director where it turns back, read by a check.
   *  `askT`: the game's clock as the pick was heard (heard(): every place a pick is taken — a word left by a pick that never began is dropped there, so
   *  a later pick begun at once is never excused by it; reask(): the row's own second asking, the wall stood again first — a pick's: the same pick, its clock kept; the loop's own turn: from here) */
  let held: { n: number; field: string; i: number; why: string[]; by: Record<string, number>; s: number; frames: number } | null = null, askT = 0;
  const heard = (f: string) => { asked = f; askT = game.time; if (held && held.n === beatN + 1) held = null; };
  let picking = false;   // (direct(): the row being begun is a pick's — `asked` is already taken off)
  const reask = (f: string) => { if (!picking) askT = game.time; asked = f; };
  const hold = (...whys: string[]) => { if (asked === null || !whys.length) return; if (!held || held.n !== beatN + 1 || held.field !== asked || held.i !== who) held = { n: beatN + 1, field: asked, i: who, why: [], by: {}, s: 0, frames: 0 };
    for (const why of whys) { if (!held.why.includes(why)) held.why.push(why); held.by[why] = (held.by[why] ?? 0) + 1; } held.frames++; held.s = game.time - askT; };
  /** the director's own hand, each live frame: a pick's cut, the beat's tick, the tidying, and what begins */
  const direct = (S: Staged) => {
    if (cutNow) { cutNow = false; if (beat) cut(S); }
    const B = beat;
    if (B) { let r: Step = B.row.tick(B, S); if (r === 'on' && B.t >= B.row.cap) { B.marks.push('cap'); r = 'done'; } if (r === 'done') finish(B, B.marks.includes('cap') ? 'cap' : 'done'); }
    tidy(S); life(S);
    if (beat || !said) return;
    if (costTick(S)) return;   // (loud kit's cost is up: nothing begins under it — a pick ends it, and the room is staged again first)
    const now = asked !== null && (V.preempt || game.time >= restUntil);
    if (!now && game.time < restUntil) return;
    if (dirty) { hold('mend'); undo(S); return; }   // (the next frame, under the copy: the leaf hung / the room staged — and the row begins)
    if (arriving(S)) { hold('arrive'); return; } if (homing(S)) { hold('home'); return; }
    if (Q && !now && hi === null) { quietIdle(S); return; }
    if (!now && !isNaN(restNext)) { restUntil = game.time + restNext; restNext = NaN; return; }   // (the lamp just mended: the loop's own turn waits)
    restNext = NaN;
    const f = now ? asked! : nextThing();
    if (waits(S, f)) { hold(...(game.puppet || flat(game.player.char.pos, S.sam) > K.onSlot ? ['sam'] : []), ...(leafWait(S) ? ['leaf'] : [])); return; }   // (`asked` is kept: the pick plays when it can)
    waitT = NaN; if (now) asked = null; else if (hi === null) flip++;
    if (samCardDue && f !== 'swap') samCard();   // (a pick that CUT a row of Sam's this very step: before() left his card owed while that row had him — the row begun now is of the card as it is written, or the door never offers a tool the old card did not carry)
    picking = now; begin(S, f);
  };
  /** the aim put out: the actor's aim point on his channel's yaw (a teammate's watch, Sam's scripted aim), the beam's own line, Sam's channel kept on his gun between his beats */
  const aims = (S: Staged) => {
    const B = beat, pl = game.player, G = govs.get(pl.char);
    if (!B || B.man || !(B.quiet || B.spot)) { if (G) { samCh.v = samCh.want = G.aim.v; samCh.w = G.aim.w; samCh.own = false; } samH += (0 - samH) * Math.min(1, stepDt * 8); }
    beamDir = null; if (!B) return;
    const p = B.char.pos;
    if (!B.man && !B.quiet && B.spot) own(samCh, yawTo(B.post ? [B.post[0], 0, B.post[1]] : p, B.spot), K.gunRate * R);   // (Sam's throw: his aim comes round to the spot eased, as a quiet beat's does)
    chanTick(B.ch, (B.turn ? K.bodyRate : K.gunRate) * R, stepDt);
    if (!(B.quiet || (!B.man && B.spot))) return;
    const y = B.ch.v, D = B.quiet ? 3 : Math.max(1, flat(B.spot!, [p[0], p[2]]));
    if (B.man) { const A = game.orders.of(B.man), W = walk.get(B.man), H = homeOf(S, B.man), o = wrap(y - H.yaw), a = Math.abs(o);
      const face = B.turn ? y : a <= K.torso * R ? H.yaw : H.yaw + Math.sign(o) * (a - K.torso * R);   // (under `torso` off his rest: the chest alone, his feet still; a quarter turn: all of him)
      const P: Vec3 | null = B.turn ? null : [p[0] + Math.sin(y) * D, B.hTo, p[2] + Math.cos(y) * D];
      if (W) { W.watch = P; W.face = face; } if (A && A.order === 'cover') { A.watch = P; A.face = face; A.upper = P ? 'aim' : 'none'; A.stance = P ? 'none' : 'lowReady'; } }
    else if (game.puppet) { samH += (B.hTo - samH) * Math.min(1, stepDt * 6); game.puppet.aim = [p[0] + Math.sin(y) * D, B.quiet ? samH : 1, p[2] + Math.cos(y) * D]; }
  };
  /** Sam's two yaws, governed: each channel's step toward what the game last wrote — after the game's step, by the time THAT step took (a step by the
   *  frame before's time read as a rate half as fast again on an uneven frame) */
  const yaws = (dt: number) => { const G = govs.get(game.player.char); if (!G) return;
    const T = costOn() ? KIT_VIEW_QUIET.cost.turn : 0;   // (under a loud row's cost ALL of him comes round to the door, at the cost's own rate: the game turns his chest and gun to an aim under `torso` off his feet and leaves the feet — he stood twisted, a stride's pose — so his body's channel is asked for the door too)
    if (T > 0 && staged) G.body.want = yawTo(game.player.char.pos, staged.at([0, 0, 0]));
    chanTick(G.body, Math.max(K.bodyRate, T) * R, dt); chanTick(G.aim, Math.max(K.gunRate, T) * R, dt); };
  const SHORT = /fiveseven|guard9mm|hk45|g18|g19bare/;   // the pistols' rows (the rest are long guns)
  /** a teammate's gun written live: his hands' errand now (the animator's own kit swap: the right hand over the shoulder and back), the model at its far point */
  const swapGun = (man: Guard, id: string) => {
    const had = swaps.find(x => x.man === man); if (had) { had.id = id; return; }   // (a new pick before the write only changes what is written)
    const item = (x: string) => SHORT.test(x) ? 'pistol' : 'rifle', from = item(man.weapon.def.id), into = item(id);
    try { (man.char.anim as unknown as { kitSwap(a: string, b: string, shown?: unknown, same?: boolean): number }).kitSwap(from, into, undefined, from === into); } catch { /* no errand: the model is written all the same */ }
    swaps.push({ man, id, at: game.time + K.swapAt });
  };
  /** Sam's card put on him again as he stands (kit.ts kitShow then kitPlayer, through main.ts) — what is in his hand kept where the card still has it */
  const samCard = () => { const pl = game.player, slot = pl.slot, hol = pl.holstered; d.samCard(); if (slot !== 'rifle' || pl.hasRifle) pl.slot = slot; pl.holstered = hol; samCardDue = false; pools(beat?.field);
    pl.rifle.lightOn = pl.pistol.lightOn = samLit; };   // (kitPlayer builds him new guns, their lights off: his marker light as place() set it)
  // IDLE LIFE (calls 2; the owner's first note, 10-14 — the men a row was not about stood dead still): a man who is in NO row, on his place, lets his gun
  // wander a few degrees to either side of his rest aim — a fixed list of angles and waits (KIT_VIEW_LOOP.scanDeg / scanGap: no dice, and the clock is the
  // game's), each man from another place in it, each move eased by a minimum-jerk curve of `scanEase` s and drawn under the turn weight / Sam's governed
  // channel. A teammate: the watch point of the order that holds him on his slot (his arms stay at the low ready); Sam: his cursor. It ENDS the frame a row
  // needs the man (the row's own aim starts from where his gun points), is HELD as it stands under a dissolve, and nobody's feet move. Under Game.puppet (a
  // row of Sam's, his walk home) the squad has no orders and the stack stands as it is
  interface Scan { k: number; from: number; to: number; t0: number; next: number; v: number; on: boolean }
  const scans = new WeakMap<object, Scan>();
  const scan = (key: object, i: number, ok: boolean, v0 = 0): number => {
    let s = scans.get(key); if (!s) { s = { k: i * 3, from: v0, to: v0, t0: -1e9, next: game.time + 0.6 + 0.9 * i, v: v0, on: false }; scans.set(key, s); }
    if (!ok) { s.on = false; s.from = s.to = s.v = 0; s.next = game.time + 0.5 + 0.4 * i; return 0; }
    if (dz.phase !== '' || lifeStill) { s.t0 += stepDt; s.next += stepDt; return s.v; }   // (under a dissolve — and through the quiet picture's idle beat, where every man freezes: as he stands)
    s.on = true;
    if (game.time >= s.next) { s.from = s.v; s.to = K.scanDeg[s.k % K.scanDeg.length] * R; s.t0 = game.time; s.next = game.time + K.scanGap[(s.k + i) % K.scanGap.length]; s.k++; }
    const u = Math.max(0, Math.min(1, (game.time - s.t0) / K.scanEase)), u3 = u * u * u; s.v = s.from + (s.to - s.from) * (10 * u3 - 15 * u3 * u + 6 * u3 * u * u); return s.v; };
  const idle = (S: Staged) => { const B = beat, pl = game.player, free = !game.puppet && state !== 'none';
    S.order.forEach((g, i) => { const W = walk.get(g), A = game.orders.of(g), H = homeOf(S, g), p = g.char.pos, was = !!scans.get(g)?.on, o = wrap(g.char.aimYaw - H.yaw);
      const ok = free && !(B && (B.man === g || B.row.team || B.moved.includes(g))) && !!W && !W.lane && W.k >= W.pts.length - 1 && game.time >= W.at && !!A && A.order === 'cover' && flat(p, H.p) <= K.onSlot && !swaps.some(x => x.man === g);
      const v = scan(g, i + 1, ok, Math.abs(o) <= 8 * R ? o : 0);
      if (ok && A) A.watch = [p[0] + Math.sin(H.yaw + v) * 3, K.scanY, p[2] + Math.cos(H.yaw + v) * 3];
      else if (was && A && A.order === 'cover' && !(B && B.man === g)) A.watch = null; });   // (his own row's aim is the row's)
    // SAM AT REST IS NOT AIMED THROUGH HIS CURSOR (the review, 10-15: his gun swung 19° to 30° aside whenever a teammate's row took its man across the door —
    // the game's aim is a ray from the lens through the cursor's pixel that lands on bodies and leaves too: the man who stepped onto that pixel WAS the aim
    // point, and the friend rule put the gun down for him): his rest aim — the foot of the door, and the scan — is written to his governed aim channel after
    // the step (`samAt`: after()), whatever the cursor's ray met. The cursor is still put on that line, at the first of three places along it whose ray
    // ends on something that stands (so the game's own "a friend is under the cursor" has no body to find). Not in a row of his own hands: `samAt` NaN
    { const rest = !(B && !B.man && !B.row.team), ok = free && !(B && !B.man) && flat(pl.char.pos, S.sam) <= K.onSlot, v = scan(pl, 0, ok), p = pl.char.pos, y = yawTo(p, S.foot) + v, D = flat(S.foot, [p[0], p[2]]);
      samAt = rest ? y : NaN;
      if (rest) for (const k of [1, 0.6, 0.3]) { cursor([p[0] + Math.sin(y) * D * k, 0, p[2] + Math.cos(y) * D * k]);
        const r = cam.ray(input.mouseX / Math.max(1, view.clientWidth), input.mouseY / Math.max(1, view.clientHeight)), h = engine.world.raycast(r.ro, r.rd, 200, undefined, pl.char.id); if (!h || h.index < engine.world.statics.length) break; } }
  };
  /** each live frame, before the game's step: the defenders parked and calmed, Sam's cursor on the foot of the door, the work a dissolve covers, the director */
  const before = () => {
    let S = staged; if (!S || state === 'none' || state === 'staging') return;
    if (dz.phase === 'work') { const W = dz.work.splice(0); dz.phase = 'settle'; dz.left = K.settle; for (const w of W) w(); S = staged; if (!S || (state as string) === 'none') return; }
    park(); stepDt = Math.max(0, Math.min(0.25, game.time - stepT)); stepT = game.time;
    { const s = cam.project([S.foot[0], 0, S.foot[2]], view.clientWidth, view.clientHeight); if (s[2]) { input.mouseX = s[0]; input.mouseY = s[1]; } }
    for (let i = swaps.length - 1; i >= 0; i--) { const x = swaps[i]; if (game.time < x.at) continue; swaps.splice(i, 1); if (!S.order.includes(x.man)) continue;
      if (x.man.weapon.def.id !== x.id && !SHORT.test(x.man.weapon.def.id) && !SHORT.test(x.id)) (x.man.char.anim as unknown as { longGun: boolean }).longGun = false;   // (a long gun for another: game.ts dealWeapons writes his muzzle's reach only as long ↔ short changes — it kept the old gun's. Told short for the instant before this step deals him the new one, it writes all of it again)
      (x.man.route as { weapon?: string }).weapon = x.id; }
    if (samCardDue && !(beat && !beat.man) && asked !== 'swap') samCard();   // (a swap asked for puts it on him itself, his hands empty; a swap never begun — another pick took its place — leaves it owed here)
    if (beat) beat.t = game.time - beat.t0;
    if (dz.phase === 'ask') hold('mend');   // (a dissolve asked for between two frames — a card's change that restages: the director does not run under it, and the pick it brought waits for the room)
    else {
      if (game.player.down || S.order.some(g => g.state === 'dead') || stagedWay().ended) { if (beat) finish(beat, 'down'); if (!dz.work.length) dissolve(() => restage()); }   // (a man down, a 'mission' ended: nothing the picture shows — staged again)
      else direct(S);
    }
    if (seenWas !== undefined && !(beat && beat.man && beat.field === 'bangs') && !matesCan()) spareSam(false);   // (a teammate's stun is over and no can of his lies unfired: the game's rule again — a row cut with the can out is waited for)
    walks(S); aims(S); idle(S); handDue = ''; poolSync();   // (the key lands in this frame's step)
    state = beat ? 'beat' : arriving(S) ? 'swap' : 'rest';
    V.men = men(S.order);
  };
  /** …and after it, before the frame is drawn: the staging's lights again, the defenders again (what this step made of a bang is not carried into the next),
   *  the picture's whiting and the camera's kick put out, the thing thrown followed, a can's vent shut off */
  const after = () => {
    const S = staged; if (!S || state === 'none' || state === 'staging') return;
    const pl = game.player, B = beat;
    { const G = govs.get(pl.char); if (G && !isNaN(samAt)) G.aim.want = samAt; }   // (Sam at rest: his aim is the director's, not the cursor ray's — idle())
    yaws(Math.max(0, Math.min(0.25, game.time - yawT))); yawT = game.time;
    beamDir = null; if (B && B.lit) { const y = B.char.aimYaw, pit = B.pitch ? B.pitch.v : 0; beamDir = [Math.sin(y) * Math.cos(pit), Math.sin(pit), Math.cos(y) * Math.cos(pit)]; }   // (the beam's line is the gun's as it is DRAWN — the yaw his weight has let him get to — and the director's own pitch)
    S.torches(); park();
    if (Q) { const QK = KIT_VIEW_QUIET, u = isNaN(liftAt) ? 0 : Math.max(0, Math.min(1, (game.time - liftAt) / QK.liftSecs));   // (the dark: the fill lifted — eyes adjusting; the half crouch he shoots from, over the game's own knee)
      const e = u * u * (3 - 2 * u); if (lamps.fill && fillBase > 0) lamps.fill.intensity = lamps.fill.peakIntensity = fillBase * (1 + (QK.liftFill - 1) * e);
      if (qMoon) qMoon.intensity = moonAt * (1 + (QK.lift - 1) * e);
      if (B && B.row === quietGun && qRise > 0) { const an = pl.char.anim as unknown as { crouch: number }; an.crouch = Math.min(an.crouch, 1 - QK.half * qRise); } else qRise = 0; }
    if (S.plan.indoors) for (const c of [pl.char, ...S.order.map(g => g.char)] as unknown as { wet: number; beads: number; wetRain: number }[]) { c.wet = 0; c.beads = 0; c.wetRain = 0; }   // (the plan: the team stands under a roof — no weather on the men, whatever the level's own roof test makes of a ceiling the camera never draws)
    if (B) { B.flash = Math.max(B.flash, pl.hitFlash);
      const I = game.items.items as unknown as { pos: Vec3; fired: boolean }[]; if (!B.item) for (let i = I.length - 1; i >= 0; i--) if (!B.old.has(I[i])) { B.item = I[i]; break; } if (B.item) B.rest = [B.item.pos[0], B.item.pos[1], B.item.pos[2]];
      S.order.forEach(g => { if (g !== B.man && !walk.get(g)?.lane) B.drift = Math.max(B.drift, flat(g.char.pos, homeOf(S, g).p)); }); if (B.man) B.drift = Math.max(B.drift, flat(pl.char.pos, S.sam)); }
    // THE HOLD, Sam's frag from before it leaves his hand to the row's end: whatever the game's own men would do about a live grenade (run from it, duck, an
    // order of their own), every teammate is on his place and — from the moment the row has them down — on his knee when the frame is drawn. Put right HERE,
    // after the game's step and with nothing of its AI asked: place, speed, path, knee. `pins` counts each time it had to (a check holds it to 0)
    if (B && pin === B && V.home) { const el = Math.max(0, Math.min(0.25, game.time - pinT));
      for (const g of S.order) { if (g === B.man) continue; const H = homeOf(S, g), c = g.char, A = c.anim as unknown as { crouch: number; crouchTarget: number; speed: number }; let put = false;
        if (flat(c.pos, H.p) > K.homeM + 0.02) { c.pos = [H.p[0], 0, H.p[1]]; c.vel = [0, 0, 0]; g.speed = 0; A.speed = 0; g.path = []; g.pathGoal = null; c.bodyYaw = H.yaw; put = true; }
        if (kneel === B && game.time - kneelT > 0.3) { const was = knees.get(g) ?? A.crouch; if (A.crouchTarget < 1 || A.crouch < was - 1e-3) { A.crouchTarget = 1; A.crouch = Math.min(1, was + el * 4); put = true; } knees.set(g, A.crouch); }
        if (put) V.pins++; } }
    pinT = game.time;
    if (B && ((!B.man && B.row.damage === 'leaf') || B.row.team)) for (const g of S.order) { if (g.dazzledUntil > game.time || g.staggerUntil > game.time) V.hits.team++; if (g.dazzledUntil > game.time) g.dazzledUntil = -1; if (g.staggerUntil > game.time) g.staggerUntil = -1; }   // (Sam's own charge with no floor for the stack to step back onto, a wall charge whose stand-off was cut short by the clock: nobody of his is left blind by it — counted)
    pl.hitFlash = 0; cam.kick = null; if (pl.dazzledUntil > game.time) pl.dazzledUntil = -1; if (pl.staggerUntil > game.time) { V.hits.sam++; pl.staggerUntil = -1; }   // (a stun's line through the open door can find Sam: he is not rooted for it, and nothing whites the picture)
    if (ventAt >= 0 && game.time >= ventAt) { shutCans(); ventAt = -1; }
    if (game.time < ventKill && !(B && B.field === 'smoke')) shutCans();   // (a smoke cut short: its can vents nothing, whenever its fuse runs out)
  };

  const V: KitView & { readonly lamps: { porch: RtLight | null; fill: RtLight | null }; readonly pin: FollowCamera['pin']; /** for the page check (tools/qa/kitview-levels.cjs HOUR): the way's own lamps put out for the hour, by id · the porch lamp's glowing box is among the world's statics */ readonly dayOut: string[]; readonly fixtureUp: boolean; /** THE QUIET PICTURE (KIT_VIEW_QUIET), for the page checks: null on a loud link or with the switch off — else the link's kind, whether it is staged, the pool lamp as the game has it, the level's lamps put out, the room's dimmed and the share they burn at, the leaf's rest angle, where Sam and a partner rest, how he is, and why the last quiet row gave way to the loud one */ readonly quiet: { kind: 'quiet' | 'solo'; on: boolean; lamp: { target: boolean; on: boolean; broken: boolean; lit: boolean; fixture: boolean; pos: Vec3 } | null; out: string[]; /** the roof slabs drawn (KIT_VIEW_QUIET.roofs) */ roofs: number; inside: { lamps: string[]; own: boolean; share: number }; leaf: number; place: V2 | null; mate: V2 | null; crouch: boolean; knee: number; holstered: boolean; lift: number; kept: string | null } | null } = {
    get state() { return kitViewLoop && paused && said && state !== 'none' ? 'paused' : state; }, drawn: 0, skipped: 0, blocked: 0, men: [], door: null, way: 0,
    get beat() { return beat ? { n: beat.n, field: beat.field, i: beat.i, t: beat.t, phase: beat.phase, marks: beat.marks, post: beat.post ?? null } : null; }, get queue() { return asked !== null ? [asked] : []; }, get held() { return held ? { ...held, why: held.why.slice(), by: { ...held.by } } : null; }, restarts: 0, rehangs: 0, cuts: 0, preempt: true, home: true, standClear: true, seats: 0, pins: 0, roused: { men: 0, alarms: 0 }, last: null, refused: null, hits: { sam: 0, team: 0 }, shots: 0, stroke: { n: 0, raw: 0, drawn: 0, cap: 0 },
    get dissolve() { return { n: dz.n, phase: dz.phase, cuts: dz.cuts }; },
    get settled() { const S = staged; return !!S && !beat && !costOn() && !game.puppet && dz.phase === '' && !offRest(S) && S.order.every(g => flat(g.char.pos, homeOf(S, g).p) <= (V.home ? K.homeM : K.onSlot + 0.1)) && flat(game.player.char.pos, S.sam) <= K.onSlot + 0.1; },
    get pace() { return { hz: pacer.hz, every: pacer.every, base: pacer.base, slow: pacer.slow }; }, pacer: kitViewPacer,
    get lamps() { return lamps; }, get pin() { return cam.pin; }, get dayOut() { return dayOut; }, get fixtureUp() { return !!fixture && engine.world.statics.includes(fixture); },
    get plan() { const S = staged; if (!plan || state === 'none') return null; const o = { ...plan, reachIn: S ? S.reachIn : 0, hole: !!S?.hole, sunk: sunkN };
      // (the quiet picture: the places the men are STAGED on — Sam's rest, the partner's as it now stands — are what a check measures them against)
      if (Q && S) o.slots = plan.slots.map((p, i) => { const g = S.order[i - 1], H = i === 0 ? { p: S.sam, yaw: S.samYaw } : g ? homeOf(S, g) : null; return H ? [H.p[0], H.p[1], H.yaw / R] as [number, number, number] : p; });
      return o; },
    get quiet() { if (quietKind === null) return null; const S = staged, pl = game.player, t = pool;
      return { kind: quietKind, on: Q && !!S, lamp: Q && t ? { target: game.targets.includes(t), on: t.on, broken: t.broken, lit: !!t.light && t.light.enabled && t.light.intensity > 0, fixture: t.boxes.length > 0 && engine.world.statics[t.boxes[0]] === fixture, pos: [t.pos[0], t.pos[1], t.pos[2]] as Vec3 } : null,
        out: qOut.slice(), roofs: qRoofs.size, inside: { lamps: qIn.map(x => x.name), own: !!qOwn && engine.lights.lights.includes(qOwn), share: qShare }, leaf: S ? S.rest - S.shut : 0, place: Q && S ? [S.sam[0], S.sam[1]] as V2 : null, mate: Q && S?.mate ? S.mate.p : null,
        crouch: pl.crouch, knee: (pl.char.anim as unknown as { crouch: number }).crouch, holstered: pl.holstered, lift: lamps.fill && fillBase > 0 ? lamps.fill.intensity / fillBase : 1, kept: qKept }; },
    get life() { return { n: lifeSeen.n, cuts: lifeSeen.cuts, on: !isNaN(lifeT), still: lifeStill, lamp: lifeLamp ? (lifeHung ? 'beat' as const : 'own' as const) : null, far: lifeSeen.far, next: isNaN(lifeT) && !isNaN(lifeNext) ? lifeNext - game.time : NaN }; }, idleEvery: null, idleOn: null,
    get cost() { return { n: costSeen.n, cuts: costSeen.cuts, on: costOn(), last: costSeen.last ? { ...costSeen.last } : null }; },
    get scan() { const S = staged, row = (name: string, k: object, c: { aimYaw: number }, rest: number) => { const s = scans.get(k); return { name, on: !!s?.on, deg: s ? s.v / R : 0, off: wrap(c.aimYaw - rest) / R }; }; return S ? [row('Sam', game.player, game.player.char, yawTo(game.player.char.pos, S.foot)), ...S.order.map(g => row(g.callsign, g, g.char, homeOf(S, g).yaw))] : []; },
    rest() {
      if (kitViewLoop ? state !== 'none' && !(paused && said) : state === 'warm' || state === 'staging') return false;   // (a pause waits for the first picture: a child paused before it would never say `ready`)
      V.skipped++; pacer.reset(); return true; },
    skip(ts) { return kitViewLoop && state !== 'none' && typeof ts === 'number' && pacer.skip(ts); },
    again() { if (state === 'none' || kitViewLoop) return; left = warmN; state = 'warm'; },   // (the loop draws every frame: a resize or a frame message moves the camera only)
    stage: () => stage(),
  };
  (window as unknown as { __kitview: unknown }).__kitview = V;
  dead = () => { beat = null; none(); };
  const snap = () => JSON.parse(JSON.stringify(d.kit())) as Record<string, unknown>[];
  cards = snap();
  /** a thing asked for NOW (calls 1: a pick cuts whatever is running and its demo starts from where he stands) */
  const pick = (f: string | null) => { heard(f ?? 'weapon'); waitT = NaN; if (f === null) flip = 1; if (beat && V.preempt) cutNow = true; };   // (no tile: the gun now, the light after it — and the wait is this pick's own: one left running by a pick a card switch replaced had it expired already)

  // the parent's messages: the same origin, and from the window that holds this frame (this window itself when the page is opened alone: a check's)
  window.addEventListener('message', e => {
    if (!kitViewFrom(e.origin) || e.source !== window.parent) return;
    const m = e.data as { kv?: unknown; members?: unknown; squad?: unknown; who?: unknown; field?: unknown; on?: unknown; cx?: unknown; cy?: unknown; h?: unknown; w?: unknown; man?: unknown; door?: unknown; left?: unknown; right?: unknown; keep?: unknown; top?: unknown; bottom?: unknown } | null; if (!m || typeof m !== 'object') return;
    if (m.kv === 'kit') {
      try {
        const was = cards; if (Array.isArray(m.members)) { d.kitCards(m.members); cards = snap(); hi = thing(hiF); }   // (…and the highlighted tile's thing read again: a value may name it — TILES)
        let n = typeof m.squad === 'number' && Number.isInteger(m.squad) && m.squad >= 0 && m.squad <= 4 ? m.squad : undefined;   // (anything else: the size is left as it stands)
        if (n !== undefined && stagedWay().fixed) n = undefined;   // (a quiet or a solo mission: the men are the mission's own — the cards are written, the size is not asked)
        if (n !== undefined) { sizeN = n; if (game.rescue.active) game.rescue.knobs.squad = n as never; else game.nightBreach.knobs.squad = n as never; }
        if (!kitViewLoop) { unhang(); game.restartEncounter(); V.restarts++; stage(n); cam.kick = null; return; }   // STILL: every kit message a plain restage (the picture's lamps off the list first, as the live restage takes them: the office with four men is at the light cap with them on it, and said `none`)
        // WHAT MOVED, on the cards of the men who come — and each written LIVE where the game can take it (a count: the pools; a teammate's gun, light,
        // suit, trim; all of Sam's card). What it cannot (the size, the goggles): a restage under the dissolve
        const team = n ?? ops().length, moved: { i: number; f: string }[] = [];
        for (let i = 0; i <= team; i++) for (const f of new Set([...Object.keys(was[i] ?? {}), ...Object.keys(cards[i] ?? {})])) if (was[i]?.[f] !== cards[i]?.[f]) moved.push({ i, f });
        const S = staged, T = d.team(); let hard = !S || state === 'none' || team !== ops().length, play: string | null = null;
        if (!hard) for (const x of moved) { const c = cards[x.i] ?? {}, g = x.i > 0 ? T[x.i - 1] : null, f = x.f;
          if (x.i > 0 && !g) { hard = true; break; }
          if (COUNTS.includes(f)) { if (x.i === who && thing(f) && play !== 'swap') play = thing(f); continue; }   // (a count that moved WITH his gun — the launcher's rounds go with the rifle — is the gun's change)
          if (!g) {   // Sam's own card: put on him again as he stands — a gun by way of his holster
            if (f === 'weapon' || f === 'primary' || f === 'secondary') { samCardDue = true; if (who === 0) play = 'swap'; } else { samCardDue = true; if (who === 0 && thing(f) && play !== 'swap') play = thing(f); }
            continue; }
          if (f === 'weapon' || f === 'primary' || f === 'secondary' || f === 'suppressed') { swapGun(g, d.gun(x.i)); if (x.i === who) play = 'swap'; }
          else if (f === 'light') { g.lightDeadUntil = c.light === true ? -1 : Infinity; if (x.i === who && play !== 'swap') play = 'light'; }
          else if (f === 'suit' || f === 'trim') { const t = d.tints(x.i), v = f === 'suit' ? t.suit ?? issued.suit.get(x.i) : t.trim ?? issued.trim.get(x.i); if (!v) { hard = true; break; }
            if (f === 'suit') g.char.tint = [...v] as Vec3; else g.char.tint2 = [...v] as Vec3; if (x.i === who && play === null) play = 'turn'; }
          else { hard = true; break; } }   // (the goggles: no live path in the game)
        if (hard) { if (beat && staged) cut(staged); if (play !== null) heard(play === 'swap' ? 'weapon' : play); dissolve(() => restage()); return; }
        pools(beat?.field);
        if (play !== null) pick(play);   // (a tile just changed on the open card: its thing, now)
      } catch (err) { console.error('kitview: the kit message could not be staged —', err); none(); }
    } else if (m.kv === 'sel') {
      if (!kitViewLoop) return;
      const w = Number(m.who); want = Number.isInteger(w) && w >= 1 && w <= 4 ? w : 0; hiF = typeof m.field === 'string' ? m.field : null;
      try { const opened = open(), f = thing(hiF);   // (by the card that is open NOW)
        if (opened) { hi = f; pick(f); if (staged && state !== 'none') { if (beat && V.preempt) { cutNow = false; cut(staged); } rotate(staged, actor()); } }   // (another card: its man to the head of the file — the same men, walking — and his tile's thing as he arrives)
        else if (f !== hi) { hi = f; pick(f); }   // (the highlight on another tile: that thing, now)
      } catch (err) { console.error('kitview: the open card\'s man could not be moved —', err); none(); }
    } else if (m.kv === 'pause') { paused = m.on === true; }
    else if (m.kv === 'frame') {
      const cx = Number(m.cx), cy = Number(m.cy), h = Number(m.h); if (![cx, cy, h].every(Number.isFinite) || !(h > 0.02 && h <= 1)) return;
      const w = Number(m.w), man = Number(m.man), was = frameAsk; frameAsk = { cx: Math.max(-1, Math.min(1, cx)), cy: Math.max(-1, Math.min(1, cy)), h, w: w > 0.02 && w <= 1 ? w : 1, man: man > 0.02 && man <= 1 ? man : 1 };
      { const dr = Number(m.door), l = Number(m.left), r = Number(m.right), kp = Number(m.keep);   // (hung on the door: all three, in order, inside the view — or the men's middle as before)
        if (typeof m.door === 'number' && typeof m.left === 'number' && typeof m.right === 'number' && [dr, l, r].every(Number.isFinite) && l >= -1 && r <= 1 && l < dr && dr < r) Object.assign(frameAsk, { door: dr, left: l, right: r, keep: kp > 0 && kp <= 1 ? kp : 1 }); }
      { const tp = Number(m.top), bt = Number(m.bottom); if (typeof m.top === 'number' && typeof m.bottom === 'number' && [tp, bt].every(Number.isFinite) && tp <= 1.5 && bt >= -1.5 && tp - bt > 0.2) Object.assign(frameAsk, { top: tp, bottom: bt }); }   // (the column's own top and foot in the window: the quiet picture's framing)
      const hang = (f: typeof frameAsk) => (f!.door ?? 9) + (f!.left ?? 9) + (f!.right ?? 9) + (f!.keep ?? 9) + (f!.top ?? 9) + (f!.bottom ?? 9);
      if (state === 'none' || (was && Math.abs(was.cx - frameAsk.cx) + Math.abs(was.cy - frameAsk.cy) + Math.abs(was.h - frameAsk.h) + Math.abs(was.w - frameAsk.w) + Math.abs(was.man - frameAsk.man) + Math.abs(hang(was) - hang(frameAsk)) < 1e-3)) return;
      aim(); V.again();
    }
  });
  window.addEventListener('resize', () => { if (state !== 'none' && state !== 'staging') { aim(); V.again(); } });

  post('boot');   // (the listener is up: the parent tells the frame and the kit before the first picture is drawn — a message is a task, the first draw a later frame)
  stage();
  return V;
}

/** THE PACE (the owner's recording, 10-14: on a 120 Hz display the picture's presents alternated 8 ms and 25 ms): an even 60 a second beats an uneven
 *  80. Every n-th display frame is stepped and drawn — the rest are passed over whole (main.ts frame(): the clock is not touched, so the next frame's step
 *  takes the real time since the last). Read off the rAF stamps alone (no thread time: what the GPU costs is seen the only way the page can, a late rAF):
 *  THE PERIOD: a rAF after work that ran long comes a whole number of periods later, so only a frame PASSED OVER shows one period — the first frames at
 *  boot are passed over until eight gaps have been read (`probe` at most), and the period is those gaps over the periods they span (`fastest`), read again
 *  off a fuller window `settle` gaps later, then KEPT. A faster one is taken as it is seen; a slower one (the window moved to a slower display) only by a
 *  PEEK — no gap near the period for `lost` s: frames are passed over until one is (the same display: asked half as often each time, to `lostMax`) or
 *  `peek` of them have shown another. THE BASE n: the rate over the target, `edge` under a whole number rounds up to it (60 to 100 Hz: every frame; 120,
 *  144, 165: every second; 180: every third; 240: every fourth) — never a pace under 57 a second: the quality ladder (ui/quality.ts, fed the gap between
 *  WORKED frames by main.ts) cuts the render scale under 57.9 at its default aim, and the pacer's own choice must not read as a slow machine there.
 *  A SLOW MACHINE is judged by the gaps between worked frames alone: over `late` of a `secs` window's frames more than n periods long, and it stays so
 *  (over `ease` of that) for `hold` s on end, the last `fresh` s too — it cannot hold this pace — and n goes up by ONE (90 Hz to an even 45 before 30),
 *  never past the count that gives `floor` a second. A hitch of 2 s (a frag, a restage) moves nothing; nor does one late frame in ten. BACK: after `stay`
 *  s one step up is tried; a try dropped again inside `proof` s doubles `stay`; after `tries` of those it is tried every `again` s only — never parked
 *  for good — until the load is said to have changed (`eased`: the ladder moved the render scale). A period that reads as a whole multiple or part of the
 *  old one may be the same display seen through late frames: the pace in ms and the tries are kept across it. Pure but for its own state. */
export const KIT_VIEW_PACE = { target: 60, floor: 30, edge: 0.1, near: 1.25, probe: 12, lost: 5, lostMax: 300, peek: 3, settle: 32, secs: 2, late: 0.3, ease: 0.8, hold: 3, fresh: 0.5, stay: 4, tries: 2, again: 300, proof: 15 };
export function kitViewPacer() {
  const K = KIT_VIEW_PACE, raw: number[] = [], win: { t: number; n: number }[] = [];
  let lastTs = -1, lastWork = -1, period = 1000 / 60, known = false, seenAt = 0, lostFor = K.lost, probe = K.probe, peek = 0, peekAt = 0, rough = 0;
  let every = 1, badAt = -1, since = 0, stay = K.stay, fails = 0, trying = false;
  const base = (p: number) => Math.max(1, Math.floor(1000 / p / K.target + K.edge)), cap = (p: number) => Math.max(base(p), Math.round(1000 / p / K.floor));
  /** the period `G` shows: its fastest gaps that agree (three within `near` of each other) say roughly what it is — then every gap that is a whole number of
   *  those, over the number of periods they span (the fastest alone read short: uneven stamps put the SHORT gaps in that bunch) — NaN: none yet */
  const fastest = (G: number[]) => { const s = [...G].sort((a, b) => a - b);
    for (let i = 0; i + 2 < s.length; i++) if (s[i + 2] <= s[i] * K.near) { let n = 0, sum = 0; for (let j = i; j < s.length && s[j] <= s[i] * K.near; j++, n++) sum += s[j];
      let p = sum / n; for (let pass = 0; pass < 2; pass++) { let k = 0, tot = 0; for (const g of G) { const m = Math.round(g / p); if (m >= 1 && Math.abs(g / p - m) <= 0.3) { k += m; tot += g; } } p = tot / k; } return p; }
    return NaN; };
  /** the display's period is `p` now: the pace in ms is kept when the new period is a whole multiple or part of the old one (the same display read through
   *  late frames, as far as anybody can tell: the count is the same pace in the new frames, the tries kept) — else a new display, from its base */
  const adopt = (p: number, ts: number) => { const r = p > period ? p / period : period / p, whole = known && Math.abs(r - Math.round(r)) < 0.1, ms = every * period;
    period = p; seenAt = ts; lostFor = K.lost; win.length = 0; badAt = -1; rough = K.settle; since = ts;
    if (whole) every = Math.max(base(p), Math.min(cap(p), Math.round(ms / p))); else { every = base(p); stay = K.stay; fails = 0; trying = false; }
    known = true; };
  const P = {
    get hz() { return 1000 / period; }, get every() { return every; }, get base() { return base(period); }, get slow() { return every > base(period); },
    /** a pause, a held frame: the gaps across it are nobody's (the period is kept: nothing is read again as it ends) */
    reset() { lastTs = lastWork = -1; win.length = 0; badAt = -1; peek = 0; },
    /** the load has changed (the quality ladder moved the render scale): the tries used up are given back — one step up is tried again after `stay` */
    eased() { if (fails) { fails = 0; stay = K.stay; trying = false; since = lastTs; } },
    /** a rAF at `ts` (ms): true = pass it over */
    skip(ts: number): boolean {
      if (lastTs < 0) seenAt = ts;
      else { const dt = ts - lastTs;
        if (dt > 250) { lastWork = -1; win.length = 0; badAt = -1; peek = 0; seenAt = ts; }
        else if (dt >= 1.5) { raw.push(dt); if (raw.length > 64) raw.shift();
          if (known && dt <= period * K.near && dt >= period / K.near) seenAt = ts;
          if (known && rough > 0 && --rough === 0) { const p = fastest(raw), b = base(period); if (p === p && p < period * K.near && p > period / K.near) { period = p; if (every === b) every = base(p); } }   // (the first read was a few gaps' worth: the same again, off a fuller window)
          if (raw.length >= (known ? 3 : 8) && (!known || dt < period / K.near)) { const p = fastest(raw); if (p === p && (!known || p < period / K.near)) adopt(p, ts); } } }
      lastTs = ts;
      // THE PROBE: frames passed over so that the gaps read are one period each (a rAF after work that ran long is a whole number of them, and with nothing
      // passed over that is all there is: a machine slow from its first frame never showed the period). At boot until it is read; and a PEEK when no gap
      // near the period has come for `lostFor` s — one gap near it and it is the same display (asked half as often each time), `peek` frames without one and
      // the period is theirs (the window is on a slower display)
      if (!known) { if (probe > 0) { probe--; return true; } }
      else if (peek > 0) {
        if (seenAt > peekAt) { peek = 0; lostFor = Math.min(K.lostMax, lostFor * 2); }
        else if (--peek > 0) return true;
        else { const a = raw[raw.length - 1], b = raw[raw.length - 2]; seenAt = ts; if (Math.max(a, b) <= Math.min(a, b) * K.near) adopt((a + b) / 2, ts); } }   // (two gaps after frames passed over, and they agree: the period)
      else if (ts - seenAt > lostFor * 1000) { peek = K.peek; peekAt = ts; return true; }
      if (lastWork >= 0 && ts - lastWork < (every - 0.4) * period) return true;
      if (lastWork >= 0) { win.push({ t: ts, n: (ts - lastWork) / period }); while (ts - win[0].t > K.secs * 1000) win.shift();
        const late = (from: number) => { let n = 0, k = 0; for (const w of win) if (w.t >= from) { n++; if (w.n > every + 0.4) k++; } return n ? k / n : 0; };   // (the share of the frames since `from` that came late)
        if (ts - win[0].t >= K.secs * 900 && win.length >= 8) { const f = late(0);
          if (f > K.late || (badAt >= 0 && f > K.late * K.ease)) { if (badAt < 0) badAt = ts; } else badAt = -1; }
        if (badAt >= 0 && ts - badAt >= K.hold * 1000 && every < cap(period) && late(ts - K.fresh * 1000) > K.late) {   // (late for `hold` s on end, and still: it cannot hold this pace — one step down)
          every++; win.length = 0; badAt = -1; since = ts; if (trying) { trying = false; fails++; stay *= 2; } }
        else if (every > base(period) && ts - since >= (fails < K.tries ? stay : K.again) * 1000) { every--; win.length = 0; badAt = -1; since = ts; trying = true; }   // (a try at one step up)
        else if (trying && ts - since >= K.proof * 1000) trying = false; }   // (it has held: a drop after this is a new one, not this try's)
      lastWork = ts; return false; },
  };
  return P;
}
