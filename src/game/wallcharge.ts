// WALL CHARGE (Game.wallCharge) — the door charge's TWIN on a partition wall: the same tool, the same count (doortools.ts DoorTools.charges), the same trigger
// (DOORTOOLS.blowKey, F) and the same rule for the men near its far side, set on a wall the destruction engine can open (wallbreak.ts: a thin interior
// partition) instead of on a leaf. It is the first thing in play that calls the engine's blast entry point (destruction.ts Destruction.blast).
//
//   THE SQUAD   the order menu (orders.ts — X or the middle button) opened with the cursor ON A WALL is the floor's menu with its fifth row turned to
//               'wall tools ▸'; on that page row 3 is 'breach with a charge · N left' — X, 5, 3: the three presses that put a charge on a door
//               (WALLCHARGE.menu 'direct' puts the row straight on 5 instead). One man sets it (DOORTOOLS.setSecs at the wall), the rest stand off along the
//               wall out of the blast (WALLCHARGE.standoff metres from it, else back across the floor), and then NOTHING happens until Sam's own trigger:
//               F, or the same row — it reads 'blow the charge' while one is set there. On the trigger the charge calls g.destr.blast against the wall (a
//               hole a man walks through: WALLS.blast.minHole columns), the report / flash / scorch are the stun charge's (combat.ts detonateStun with
//               nobody on its list), the men near the far side are knocked down (inside DOORTOOLS.knockM) or flash-blind and staggered (out to stunM, in
//               its open view) by the door charge's own numbers, and the squad goes in THROUGH THE HOLE — each man to the hole's far mouth, then to a
//               point of his own inside, gun and light up, searching — and the order ends as every entry ends: the men holding the room.
//   SAM ALONE   the same thing by hand, with the rows he uses at a door: with the cursor on a partition and Sam at its foot the Space list offers
//               'breach with a charge · N left' (player.ts buildInteractables → wallChargeRows); he stands on it DOORTOOLS.setSecs (a step breaks it
//               off, nothing spent), and F blows it. No entry follows: there is nobody to send.
//   REFUSED IN WORDS, as the door's are (said by a man, the row greyed with the reason): "concrete. a charge won't cut it." · "steel. a charge won't cut
//               it." · "outer wall. a charge won't cut it." · "it's open." · 'no charges left.' · 'already on it.' · 'no room at that wall.' · 'no floor
//               behind it.' · 'no room to stand off.' · '<callsign> is behind that wall.' / '<callsign> is too close to that wall.' · "can't get there."
//   OUTER WALLS (WALLCHARGE.outer — the maintainer, 10-10: "they pretty much only make sense on exterior walls, where they're currently not allowed … we should allow them
//               exterior too"): a building's outer wall — structure up to `outerThick`, not steel, the open sky over one face of it and a roof over the other (the
//               level's own geometry: outerWall below) — and, `outerYard`, a yard wall with the sky over both takes a charge like a partition, from either face:
//               the same rows, the same stand-off, the same trigger, the same entry through the hole. The engine takes that wall on as a HARD wall on the frame the
//               charge goes (wallbreak.ts adopt + BlastOpts.breach): the hole is the charge's alone — rounds, frags and every other blast leave it the structure it
//               was. Inside the building concrete is still concrete: refused in the same words as ever. Off (the table's own value; the page turns it on,
//               ?noouterwall = off): every outer wall is refused as it always was and nothing here is asked.
//   THE SAFETY RADIUS (WALLCHARGE.safe — the maintainer, 10-10: "the minimum safety radius for the wall charge needs to be larger, especially when indoors!"): two
//               numbers at the charge's place, both larger than the door charge's and larger again where the charge's OWN side is indoors (a roof over the
//               floor at its foot — the level's geometry, chargeIndoors below: the blast has nowhere to go; outdoors it vents). The STAND-OFF the squad takes
//               before it is blown (safeStandoff: 4 m outdoors, 6 m indoors, where it was 2.6) — along the wall, back across the floor, or anywhere near with
//               something solid between it and the charge (round a corner, out of the room); where the floor has no such place they stand off as they
//               always did and the man who calls it says so. And the REACH inside which the blast punishes whoever is on the charge's side with a line to it
//               (safeReach: 3 m outdoors, 5 m indoors, where it was the door charge's 1.6): a teammate is flash-blind longer the nearer he stood, and SAM is
//               rocked — thrown off his feet's line, no round or throw for a beat, his aim opened wide (samCaught). Never hit points. The row and the note
//               that offer the trigger name who is inside it. Off (the table's own value; the page turns it on, ?wallsafe=0 = off): the radii as they were.
//
// THE SWITCH is this module's own: WALLCHARGE.on — and it only ever runs under the destruction goal's (wallBreakOn: destructionSwitch.ts DESTRUCTION.on, the
// walls' own tune.wallBreak, never under a show) at chaos > 0. Off — either of them — the rows are not registered, no target carries a wall, Sam's list has
// no wall row, input() and tick() return on their first line: the build is its base. Nothing here draws from Math.random.
//
// SEAMS (one line each, in files this module does not own): orders.ts targetAt (wallTarget: a floor target under a wall carries it), rowsFor (wallRows),
// hoverWords ('that wall') and OrderTarget's floor variant (`wall?`); game.ts the field, its construction after the door tools, input() ahead of the door
// tools' and tick() after theirs, Interactable's kind 'wall' and Verb 'charge'; player.ts buildInteractables (wallChargeRows) and INTERACT_PRIORITY.wall.
// NOT here: a charge on a door (doortools.ts, and the doors goal's own blast), the frag (the gear goal), what either side makes of a hole afterwards.
// Restart / a checkpoint's load: a new Player or a new cast is a fresh run — nothing set, nothing under way (sync); the wall itself is the engine's to put
// back. A set charge is not saved.
import { SideMap } from '../math/side';
import { holdFireOrder } from './holdfire';   // (called inside blow only)
import { Vec3, v3, clamp, lerp } from '../math/vec';
import type { Game, Guard, Interactable, Verb } from './game';
import type { Input } from './input';
import type { OrderDef, OrderTarget, OrderNote, SquadOrders, Assignment } from './orders';
import type { Box } from '../scene/boxes';
import { BoxFlag, makeBox } from '../scene/boxes';
import { DOORTOOLS } from './doortools';
import { wallBreakOn, WALLS } from './wallbreak';
import { chaosOf } from './destruction';
import { FURN, chargeSource, type BlastFirst } from './furnblast';
import { surfOf } from './particleFx';
import { killGuard, detonateStun, hitPlayer } from './combat';
import { OWNBLOW, SAM_BY, blowKeyWord, blowTail } from './ownblow';   // (called inside rows, notes and the key's press only: his own charge is his own actions' to set off — ownblow.ts)
import { chronHit } from './chronicle';
import { civiliansShown } from './civilians';   // (called inside blow only)
import { NIGHTBREACH } from './nightbreach';
import { COVER } from './cover';
import { isHostile } from './teams';
import { PLAYER_ID } from './consts';
import { PACE } from './guards';
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { SAMSTUN, dazzlePlayer } from './samstun';
import { chargeHands } from './handwork';
import { moraleBlast } from './morale';
import { messWall } from './floormess';
import { gunLast } from './gunroles';   // (called inside enter only)
import { PICTURE, PICTURE_STATS, knownPlaces } from './picture';   // (called inside knownFoes and repick only)

export const WALLCHARGE = {
  /** THE SWITCH (this module's own; it also needs the destruction goal's — see the head) */
  on: true,
  /** how the menu reaches the row: 'page' = X, 5 'wall tools ▸', 3 — the door charge's own three presses · 'direct' = X, 5 */
  menu: 'page' as 'page' | 'direct',
  /** m: how near a wall's footprint the cursor's point must be for the target to be that wall */
  pickM: 0.06,
  /** m: the charge's height on the wall · how near a wall's end it may sit · how far along the wall a spot is slid to find floor on both faces */
  height: 1.05, endM: 0.75, slide: [0, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5],
  /** m off the face: where the man who sets it stands · how near that he must be to be setting it */
  setOff: 0.5, setNear: 0.9,
  /** Sam's own row: how near the foot of the wall he must be · how far he may shift while setting it */
  samReach: 1.35, samShift: 0.35, samMarkerM: 3.0,
  /** the stand-off: metres from the charge along the wall (tried in turn), off its face, between men; else back across the floor at these distances */
  standoff: [2.6, 2.0], postOff: 0.55, fileGap: 0.9, backM: [3.0, 3.9, 4.8],
  /** m: a post ALONG the wall is legal only this far past where the blast can open it — WALLS.blast.radius × portK plus half a cell (2.01 m of the charge at
   *  the shipped numbers), so the 2.0 m fallback of `standoff` starts at 2.46 (on the 0.45 m step that is the 2.6 pass's own first post, 2.70: a stretch that only fitted a man at 2.25 goes to the fan
   *  back across the floor, or is refused) and the 2.6 is as it was. 0 = the posts as they were */
  clearM: 0.45,
  /** the men stood off wait with their BACKS to the charge (not staring at it from 2.7 m with the gun on it), start at the blast (the animator's own
   *  flinch) and turn in to the wall while `afterBlow` runs; the rear men's eyes stay the cover's. false = as it was: facing the charge, no start.
   *  (A crouch is not this module's to give: orders.ts poses every man under an order with crouch false.) */
  brace: true,
  /** m: a teammate outside the order nearer the charge than this on its own side is in the blast (refused) */
  mateM: 2.0,
  /** s after the blast before the first man goes · between men: DOORTOOLS.second · the whole entry's cap · on their points before the order ends */
  afterBlow: 0.7, enterCap: 16, sweepSecs: 1.5,
  /** m past the far face: the point in the hole's far mouth each man is sent through · their lanes' half-spread across the hole */
  mouthIn: 0.6, lane: 0.35,
  /** m: on his way to the hole a man's gun is on a point this deep inside it, through the opening (he comes to the hole's edge already looking into the room,
   *  not along the wall with the opening on his shoulder). 0 = as it was: no point, the gun leads his feet */
  laneWatch: 3.0,
  /** the points inside, [across the hole's centre line, past the far face] in metres — first man's first; mirrored / pulled in where the floor says no */
  pods: [[-1.3, 1.9], [1.3, 1.9], [-2.1, 1.0], [2.1, 1.0]] as [number, number][],
  /** WHO WATCHES WHAT once they are in. Through the hole every gun is on the room ahead of it. `doors` = each of the room's own doors is then one man's to
   *  hold from his point — nearest the hole first, to the nearest man with a line to it who has nothing yet — while one man at least keeps the room; `hole` =
   *  with three or more in, the last man through whom no door took keeps his gun on the hole they came in by (the door entry's last-out rule, under its
   *  switch DOORTOOLS.lastOut too). `doors` ON since 10-08 (rebuild/destruction/ai-charge.md, 'The wall order holds the room'): with every gun left on the
   *  room a defender walked in by an inside door nobody watched — 144 warehouse seeds with the scripted commander, paired: squads wiped by 60 s 48 → 33,
   *  teammates up 147 → 176, aim-snap flags 831 → 546. `hole` stays OFF: 24 block seeds, 37 teammates up with it against 48 without (and as first
   *  shipped, hole dealt before the doors and both taken together at the end: 11 up of 96 on the warehouse against 17 with neither). */
  hole: false, doors: true,
  /** with `hole` / `doors` on: they are taken up once the room is theirs (the entry's last act), not on the way in */
  holdLate: true,
  /** THE TRADE: what one wall charge takes out of the squad's breaching bag (doortools.ts DoorTools.charges, 2 a run): 2 = the whole bag, so a run is one wall OR
   *  two doors, chosen at the wall — the row is offered only while the bag holds it, and all of it comes back if the charge comes off the wall unblown.
   *  1 = a wall costs what a door costs (the build before this knob, by digest) */
  cost: 2,
  /** WALL CHARGES CARRIED apart from the bag, for a kit screen that sells the slot before the run: null (the default) = none are, the `cost` rule above exactly;
   *  a number = every run starts with that many (WallCharge.carried, set per run by setCarried): the row is offered while one is left, a wall spends one and
   *  leaves the door charges alone */
  carried: null as number | null,
  /** … and each man takes his up by himself, once HE has been on his point `holdSecs` with his gun on the room (false: all of them together, when the last
   *  man is on his — a mate held up in the hole left every door of the room unwatched until he was through) */
  holdEach: true, holdSecs: 1.5,
  /** m: no door is given to a man whose line to it passes this near a mate's point inside (he would hold it with a friend down his muzzle) */
  mateLine: 0.6,
  /** m: none of this order's marks is in a DOORWAY — a stand-off post or the setter's spot within `offFrame` of a door frame's centre is passed over for
   *  the next place (both knobs 0 = the marks as they were: on the compound a man stood off in the 'ab' door frame, 4 s and more at a time); a point INSIDE only
   *  within `offFramePod` (the frame's own footprint: wider, and in a small room the point moves into the hole's mouth, where Sam walks in) */
  offFrame: 0.8, offFramePod: 0.5,
  /** a stand-off post is not put at the foot of a place where that wall is ALREADY OPEN (a hole blown earlier, a port shot through it): the man waiting there
   *  for Sam's word would be stood in the one stretch of the wall the room behind sees him through (false = the posts as they were) */
  offHoles: true,
  /** OUTER WALLS TAKE A CHARGE (the head's note). Off = the table's own value: the build before it. The page turns it on (src/host/profile.ts pageSwitches;
   *  ?noouterwall = off) and so does the harness's shipped stand; its frozen stand holds it off (TPS_OUTERWALL=1 turns it on there).
   *  `outerThick` m: the thickest structure a charge cuts (the levels' shells are 0.24; past 0.26 a half-metre column of it is no longer a slab to the break table) · `outerMinLen` m: the shortest stretch of it (a hole a man fits
   *  through is WALLS.blast.minHole columns) · `outerYard`: a free-standing yard wall — the sky over both its faces — counts too (false: only a wall with a roof
   *  behind it) */
  outer: false, outerThick: 0.26, outerMinLen: 1.5, outerYard: true,
  /** FURNITURE AGAINST THE FAR FACE IS NOT 'NO FLOOR BEHIND IT' (10-11, the maintainer on the barracks: "weird that it doesn't let me use a wall charge here" — a
   *  cot stood against the wall inside): where the nav grid has no floor behind a place — and only there, so a place that had floor is the place it was —
   *  floor that only the piece of furniture this charge breaks first stands on counts (mouthAfter). false = the nav grid as it stands today is the only
   *  answer, as it was. ON in the page (`?wallfurn=0`), off here and on the frozen stand (`TPS_WALLFURN=1`); a recording from before the key replays with it off. `farSlack` m: how far along the wall from the charge the
   *  middle of the hole may land (the engine's columns) · `farReach` m: how far from its middle holeAt() looks for the way through. */
  farFurn: false, farSlack: 0.5, farReach: 0.375,
  /** …AND WHAT THE BLOWN HOLE'S OWN CLEARING TAKES IS NO FLOOR IN THE WAY EITHER (with `farFurn`, and only while furnblast.ts FURN.mouth is on): the promise
   *  above knew the furniture INDEX alone, and a blown hole clears more than the index lists (furnblast.ts mouth(): a cot a hair over the index's size bar,
   *  a counter, shelving on legs — whole, with what rests on it). Mousehole's ward has cots of 0.706 m³ down its west wall against the index's 0.7: the wall
   *  was refused 'no floor behind it' for six metres and every place of it opened a way in when blown. mouthAfter() now also takes a far-side cell shut only
   *  by things `Furniture.mouthWouldTake` says go from the hole's mouth. false = the index alone, as it was; a recording from before the key replays with it off. */
  farMouth: true,
  /** THE SAFETY RADIUS (the head's note). Off = the table's own value: the stand-off of `standoff` and the door charge's backblast reach, as they were. The
   *  page turns it on (src/host/profile.ts pageSwitches; ?wallsafe=0 = off) and so does the harness's shipped stand; its frozen stand holds it off
   *  (TPS_WALLSAFE=1 turns it on there). Every pair below is [the charge's side outdoors, the charge's side indoors]. */
  safe: false,
  /** A CHARGE SET ON WHAT HANGS ON THE WALL TAKES IT AND THE WALL. A thin thing hung on a wall's face (a notice board, a whiteboard, a sign) stood between
   *  the charge set on it and the wall: the blast's plan found every column shielded, the charge went off and opened nothing — the row was offered and was a
   *  dud. With this the blast is told which wall the charge is on (wallbreak.ts BlastOpts.hung) and that wall goes AT THE CHARGE whatever stands on its face:
   *  the hole a man fits through. The BOARDS hung on that face within `hungM` of the charge on the plan, at its height (wallbreak.ts hungAt, WALLS.hung),
   *  shield nothing from this blast at all — the wall opens cell for cell as the same wall bare would — and once it holes they go with it IN PIECES, not let
   *  down whole (furnblast.ts hungGoes, FURN.hung: slabs through the hole and back into the room); one the hangers' own rule would have left up is taken all
   *  the same, and a checkpoint keeps that (WallsSave.h). OFF here and on the frozen stand (TPS_HUNGCHARGE=1 raises it there); the page turns it on
   *  (src/host/profile.ts pageSwitches; ?hungcharge=0 = off) and so does the shipped stand. off = the build as it was: no `hung` on any blast. */
  hung: false, hungM: 0.35,
  /** m: how far from the charge a man with a line to it stands off (it was `standoff`'s 2.6, then 2.0) */
  safeStandoff: [4.0, 6.0] as [number, number],
  /** m: on the charge's own side, with a line to it, the blast reaches this far (it was DOORTOOLS.backblastM, 1.6) */
  safeReach: [3.0, 5.0] as [number, number],
  /** s a man caught inside the reach is flash-blind: at the wall · at the reach's edge (it was DOORTOOLS.backblastSecs, 1.5, flat) */
  safeSecs: [3.0, 1.0] as [number, number],
  /** m: a place OUT OF THE BLAST'S LINE (something solid between it and the charge that the blast cannot open) is looked for this far from the charge · and
   *  taken only within this much walk of the wall's foot (a room away, not a floor away) */
  safeHideM: 9, safeWalkM: 16,
  /** BACK AT THE HOLE WHILE THE BLAST STILL HOLDS THE ROOM (acts only with `safe`; false = the marks and the wait as they were): a place out of the blast's
   *  line is taken only within `safeBackM` of WALK from the wall's foot and the shortest walks are dealt first (they were dealt by the straight line, up to
   *  safeWalkM of walk: a mark on another side of the building, eight seconds from the hole it was stood off for) — and the men do not stand `afterBlow` on
   *  marks that far back: afterBlow is the time before anybody is AT the hole, and their walk already is that. */
  safeBack: true, safeBackM: 9,
  /** OUT OF KNOWN FIRE (acts only with `safe`; false = the marks as they were): a stand-off mark that an enemy THE TEAM KNOWS OF can shoot — a living enemy in
   *  the team's picture now where he stands, or one seen inside `fireKnownS` where he was last seen (fogofwar.ts sighting: the fog's own record, what the
   *  player has been shown — and, with picture.ts's PICTURE.wall on, what the squad's men saw, heard or were told as well: a man heard and never shown is
   *  known too, knownFoes; with the fog off or standing aside the picture shows everybody), within `fireM`, with a line a round can
   *  take (glass passes) to a man on the mark or `fireStep` either way of it — is dealt only when the floor has no other, and of those the LEAST under fire
   *  first (underFire: nearer enemies and clearer lines weigh more, in steps of `fireGrain`). The maintainer, 10-14, The pass: "the two guys move away from the
   *  wall charge to a place that doesn't make sense (isn't safe since there are known enemies that can shoot them from there)" — they stood off along the
   *  wall past its end, in front of the window of the room being breached, on the line of the man in it they had just called. Out of the blast still comes
   *  first: a mark under fire is taken before a mark in the blast, and no new place is looked for — the same places, in another order. The wall the
   *  charge is on is no cover where it will open (underFire): square in front of the charge is the lane of whoever is known behind it. */
  outOfFire: false, fireKnownS: 30, fireM: 30, fireStep: 0.5, fireGrain: 0.03,
  /** THE MEN WITH SAM STEP BACK FROM A SET CHARGE (acts with `safe`; off: they keep their places in the file, in the blast or not). A man on 'fall in' whose
   *  place — where he stands when that is his place, his place in the file, or the step cover or his picture gave him — is inside the radius of a charge on
   *  a wall (in its line and nearer than the stand-off distance, `menClearIn` under it: wider than the reach the trigger's row warns by) is walked to a stand-off mark instead: the same
   *  marks an ordered charge deals (safePosts — along the wall past the radius, out of the blast's line, back across the floor; only on floor the squad
   *  holds), the nearest to him that nobody else has. He keeps it until his place has been out of the blast `menClearS` — Sam walking clear with the file
   *  behind him, or the charge gone off the wall — and then falls in as he would. Never a sprint: the pace he steps out of Sam's way at; the silent squad
   *  at a walk. A man on an order of his own keeps the order. The maintainer, 10-16, The pass, the row reading TOO CLOSE with two of his men named: "after
   *  i place a wall charge, my guys should move away with standoff". */
  menClear: false, menClearIn: 0.1, menClearS: 0.75,
  /** SAM inside the reach when it goes: s with no round and no throw, at the wall · at the reach's edge — and his aim opened by suppression's own scalar,
   *  whole at the wall, `samSup` of it at the edge */
  samSecs: [2.0, 0.6] as [number, number], samSup: 0.5,
};
export const WALLCHARGE_DEFAULTS = JSON.parse(JSON.stringify(WALLCHARGE)) as typeof WALLCHARGE;
/** A WALL SHOT, FELT (the maintainer, 10-19, of a room taken through a blown wall: "the smoke after a wall shot makes it too hard -- we should probably (1) turn
 *  down its density a little and (2) make it so everyone in the room gets more of a shock"). With `on`:
 *  (1) the charge's pall (destruction.ts CHAOS.pall.wall) is asked at `pall` of its density, the picture's dust thinned with it: the hole reads sooner. Only the
 *      wall charge's: a grenade's pall and the charge's borrowed report are as they were.
 *  (2) EVERY defender in the room the hole opens into is shocked. One with a line to the hole, as before, but longer: folded (rooted, no round) `staggerSecs`
 *      (it was DOORTOOLS.staggerSecs, 2.0) and blind `stunSecs` at the wall · at stunM (it was DOORTOOLS.stunSecs, 6.0 · 2.5). One with NO line to the hole,
 *      or past stunM, who was untouched: folded the same `staggerSecs` (the shock wave fills the room; the flash needs the line, so his eyes are his own) —
 *      out to `roomM` from the charge, so that a hole into a long hall or the open air does not fold a man a street away.
 *      One of ours and the player beyond the wall, with a line: blind `oursSecs` (it was DOORTOOLS.backblastSecs, 1.5) — a blast does to the player what it
 *      does to anyone (one of a team of TWO beyond the wall takes what a defender there takes, as he always did: the longer numbers are his too). The reach
 *      inside which a man behind the wall is killed still needs the line and is as it was; no health number is touched.
 *  OFF here and on the frozen stand (TPS_WALLSHOT=1); ON in the page (?wallshot=0). Check: tools/qa/wallshot-check.ts (WALLSHOT_BREAK=1). */
export const WALLSHOT = { on: false, pall: 0.75, staggerSecs: 3.5, stunSecs: [8.0, 4.0] as [number, number], roomM: 12, oursSecs: 2.0 };
/** A WALL CHARGE KILLS WHOEVER STANDS AT IT (the maintainer, 10-19, god mode off, 0.9 m from his own charge when he blew it and told only 'you were too
 *  close': "blowing a wall charge with me right next to it should kill me"). A blast does to the player what it does to anyone, so with `on` the rule is one
 *  rule for every man on the floor — the player, ours, the defenders, a civilian who is in the building:
 *    on the charge's OWN side, nearer than `nearM` with a line to it: killed, dead as a frag leaves a man (he was blind for the safety radius's seconds — a
 *      teammate, a defender — or rocked and blind — the player; a civilian was not asked about at all);
 *    BEHIND a wall it opened, nearer than DOORTOOLS.knockM with a line to the hole: down as a defender there always was (the charge's knock: 'struck') — now
 *      the player too (he was blind a second or two), a civilian, and one of ours whatever the team's size (on a team of more than two he was blind a second
 *      or two; on a team of two he already went down);
 *    past that reach one of ours behind the wall is blind as one of ours, whatever the team's size (on a team of two he took the defenders' longer stun and fold).
 *  The player goes down as a round puts him down (combat.ts hitPlayer: his one hit): never in god mode, never the tour's scripted player. A man with god mode
 *  of his own (Guard.god) is passed over. WHO BLOWS IT: the player's trigger and his order's release — and a plan's own clock (host/kitView.ts), which is no
 *  press of his: that caller says so (`pressed` false) and its blast is the blast as it was. With the safety radius on (the page) the trigger's row names who
 *  is too close and who is behind the wall before he presses it. No hit points anywhere: nobody takes more or fewer rounds.
 *  OFF here and on the frozen stand (TPS_WALLKILL=1); ON in the page (?wallkill=0). Check: tools/qa/wallkill-check.ts (WALLKILL_BREAK=1). */
export const WALLKILL = { on: false, nearM: 1.5 };
/** the menu page the wall's fifth row opens */
export const WALL_PAGE = 'walltools';
/** the order's id (orders.ts give / Assignment.order) */
export const WALL_ORDER = 'wallCharge';

/** A place on a wall for a charge. `index`: the authored static (the engine's id for a partition); `alongX`: the wall runs along x (its normal is z); `u`:
 *  the charge's place along it (world x or z); `side`: the face it goes on (+1 / −1 along the normal axis — the side the men work from); `ok`: a charge cuts
 *  it — else `why` is the refusal. */
export interface WallSpot { index: number; box: Box; alongX: boolean; u: number; side: 1 | -1; ok: boolean; why: string; /** an outer wall (WALLCHARGE.outer): structure the engine takes on when the charge goes */ outer?: boolean }
/** `paid`: what it took out of the bag when set (0: a carried one) — what comes back if it comes off the wall unblown · `free`: set under unlimited ammo
 *  (Game.infiniteAmmo): nothing was spent, so nothing comes back */
export interface SetWallCharge { wall: WallSpot; t: number; by: string; paid: number; free?: boolean }
type Phase = 'place' | 'standoff' | 'armed' | 'wait' | 'enter';
/** a walk's answer by its key: the one kept for the open menu, or worked out now and kept (WallCharge.keptWalks) */
type Kept = <T>(key: string, work: () => T) => T;
/** a man's point inside: where, which way he faces, and the point his gun stays on if he has one — out through the hole (the rear man), or a door of the room (`door`: its name) */
interface Pod { pos: Vec3; face: number; watch?: Vec3; door?: string; hold?: { face: number; watch: Vec3; door?: string }; took?: boolean }
export interface WallOp {
  wall: WallSpot; men: Guard[]; lead: Guard; phase: Phase; t0: number;
  /** where the setter stands · when he began setting it (NaN: not yet) */
  spot: Vec3; setT: number;
  /** WALLKILL: the setter's 'charge set.' is owed — said once he is `nearM` off the charge he set, not with his hands still on it (absent: said, or the rule off) */
  owes?: boolean;
  /** the assignments this order handed out (a man whose assignment is no longer this one has been re-ordered: he is not ours) · each man's stand-off mark */
  mine: Map<Guard, Assignment>; post: Map<Guard, Vec3>; from: Map<Guard, Vec3>;
  /** the hole as it opened: its centre along the wall (metres from the charge) and half its width — null until the blast */
  hole: { du: number; half: number } | null;
  /** the entry: who goes when, by which lane, to which point · where each man is in it · where he crossed the wall's line (metres along it from the charge: cross()) · his last place while he has yet to (null: he has) */
  queue: { gd: Guard; at: number; lane: Vec3; pod: Pod }[]; stage: Map<Guard, 'lane' | 'pod'>; pod: Map<Guard, Pod>; crossed: Map<Guard, number>; last: Map<Guard, Vec3 | null>;
  inT: number; beats: { t: number; what: string }[];
  /** the floor had no place out of the blast for them all (WALLCHARGE.safe): they stand off as near as they always did, and the man who calls it says so */
  close?: boolean;
  /** repick (picture.ts PICTURE.step): when the stand-off marks are next asked about known fire · whose mark was under it at the last ask · who has been
   *  dealt again (once a man) · how many searches it has cost · the walks those searches measured */
  repickT?: number; repickBad?: Set<Guard>; redealt?: Set<Guard>; repickN?: number; repickKept?: Map<string, unknown>;
}

const flat = v3.distXZ, yawTo = v3.yawTo;
/** how near a point passes a line on the floor, a to b (m) */
const nearSeg = (q: Vec3, a: Vec3, b: Vec3): number => { const dx = b[0] - a[0], dz = b[2] - a[2], L = dx * dx + dz * dz, k = L > 1e-9 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[2] - a[2]) * dz) / L)) : 0; return Math.hypot(q[0] - a[0] - dx * k, q[2] - a[2] - dz * k); };
/** m off a face: where the rays that ask 'is the wall still here' start and end (near enough that what stands by the wall is not taken for it) */
const FACE = 0.06;
const thick = (W: WallSpot) => 2 * (W.alongX ? W.box.h[2] : W.box.h[0]);
/** where the charge sits: on the near face, at the charge's height (what blow() blasts from, and what is asked ahead of it) */
const chargeAt = (W: WallSpot): Vec3 => wallPt(W, 0, FACE, WALLCHARGE.height);
/** a point by the wall: `du` metres along it from the charge, `off` metres out from the charge's face (negative: into the wall — the far face is at −thick), at height y */
export function wallPt(W: WallSpot, du: number, off: number, y = 0): Vec3 { const b = W.box; return W.alongX ? [W.u + du, y, b.c[2] + W.side * (b.h[2] + off)] : [b.c[0] + W.side * (b.h[0] + off), y, W.u + du]; }
/** metres out from the charge's face (negative: in the wall, or past it) · metres along the wall from the charge */
/** the wall's unit normal on the charge's side */
export const wallN = (W: WallSpot): Vec3 => W.alongX ? [0, 0, W.side] : [W.side, 0, 0];
export function wallOff(W: WallSpot, p: Vec3): number { const b = W.box; return W.alongX ? (p[2] - b.c[2]) * W.side - b.h[2] : (p[0] - b.c[0]) * W.side - b.h[0]; }
export function wallAlong(W: WallSpot, p: Vec3): number { return (W.alongX ? p[0] : p[2]) - W.u; }
const sameWall = (a: WallSpot, b: WallSpot) => a.index === b.index && Math.abs(a.u - b.u) < 1.6;

/** is the wall charge live in this game right now: its own switch, the destruction goal's, the walls', outside a show, chaos above 0 */
export function wallChargeOn(g: Game): boolean { return WALLCHARGE.on && wallBreakOn(g) && chaosOf(g) > 0; }

/** how high the open-sky test looks (m) · the samples it takes off each face: metres out, and along the wall as a share of its half length */
const SKY_TOP = 12, SKY_OFF = [0.5, 1.0, 1.6], SKY_ALONG = [-0.5, 0, 0.5];
const skyMemo = new SideMap<object, Map<number, number>>('wallcharge.skyMemo');
/** THE FACES OF A WALL THE OPEN SKY IS OVER: 0 = neither (a wall inside), 1 = one (a building's outer wall), 2 = both (a yard wall). Asked of the level's own
 *  geometry as the glass asks it of a pane (glassbreak.ts skySide): upward solid rays from chest height at nine places off each face — a canopy or a lamp head
 *  over part of one side does not flip the majority. Kept per static (the authored statics do not move; a hole in the wall changes nothing over it). */
export function skyFaces(g: Game, index: number): number {
  let memo = skyMemo.get(g.col); if (!memo) skyMemo.set(g.col, memo = new Map());
  let n = memo.get(index); if (n !== undefined) return n;
  const b = g.col.boxes[index], alongX = b.h[0] >= b.h[2], hu = alongX ? b.h[0] : b.h[2], ht = alongX ? b.h[2] : b.h[0]; n = 0;
  for (const sg of [1, -1]) { let sky = 0;
    for (const off of SKY_OFF) for (const t of SKY_ALONG) { const d = sg * (ht + off), p: Vec3 = alongX ? [b.c[0] + t * hu, 1.5, b.c[2] + d] : [b.c[0] + d, 1.5, b.c[2] + t * hu]; if (!g.col.solidBlocked(p, [p[0], SKY_TOP, p[2]], 0.02)) sky++; }
    if (sky * 2 > SKY_OFF.length * SKY_ALONG.length) n++; }
  memo.set(index, n); return n;
}
/** IS STRUCTURE STATIC `index` AN OUTER WALL A CHARGE CUTS (WALLCHARGE.outer; wallAt has already found it a full-height unrotated wall in a wall's stuff):
 *  not steel, no thicker than outerThick, at least outerMinLen long, something the engine can take on (wallbreak.ts adoptable: it lights nothing, carries no
 *  fixture) — and the open sky over one face of it, or over both with outerYard. */
export function outerWall(g: Game, index: number): boolean {
  const K = WALLCHARGE, walls = g.destr?.walls; if (!K.outer || !walls) return false;
  const b = g.col.boxes[index], thin = 2 * Math.min(b.h[0], b.h[2]), long = 2 * Math.max(b.h[0], b.h[2]);
  if (thin > K.outerThick || long < K.outerMinLen || b.metal || surfOf(b.albedo) === 'metal' || !walls.adoptable(index)) return false;
  const sky = skyFaces(g, index); return sky === 1 || (sky === 2 && K.outerYard);
}

/** IS THE CHARGE'S OWN SIDE INDOORS: a roof over the floor at its foot. The level's own geometry, asked as skyFaces asks it — upward solid rays from chest
 *  height at nine places off the charge's face, a metre either way along the wall from it — so the roof slab's overhang over an outer wall's outside face, a
 *  canopy or a lamp head does not make a yard a room. */
export function chargeIndoors(g: Game, W: WallSpot): boolean {
  let roof = 0;
  for (const off of SKY_OFF) for (const du of [-1, 0, 1]) { const p = wallPt(W, du, off, 1.5); if (g.col.solidBlocked(p, [p[0], SKY_TOP, p[2]], 0.02)) roof++; }
  return roof * 2 > SKY_OFF.length * 3;
}
/** THE SAFETY RADIUS AT A PLACE: how far the squad stands off from a charge there, and how far its blast reaches on its own side (WALLCHARGE.safe; off: the
 *  numbers as they were — `standoff`'s first, the door charge's backblastM) */
export function safeRadius(g: Game, W: WallSpot): { standoff: number; reach: number; indoors: boolean } {
  const K = WALLCHARGE; if (!K.safe) return { standoff: K.standoff[0], reach: DOORTOOLS.backblastM, indoors: false };
  const indoors = chargeIndoors(g, W), i = indoors ? 1 : 0; return { standoff: K.safeStandoff[i], reach: K.safeReach[i], indoors };
}

/** THE WALL AT A POINT (the cursor's, a probe's): the full-height unrotated wall whose footprint the point is on (within pickM) — a partition the engine can
 *  open (`ok`), or structure, with the word for what it is. `from`: whose side the charge goes on (default Sam's). Null: no wall there. */
/** the room a hole in `W` at `du` opens into (0: none — open floor, a doorway): the first room a point beyond the far face stands in, stepping in from the
 *  face (what stands against the wall is no floor to the room map) and a pace to either hand. WALLSHOT's. */
function roomBeyond(g: Game, W: WallSpot, du: number, T: number): number {
  for (let d = 0.45; d <= 1.95; d += 0.25) for (const s of [0, 0.5, -0.5]) { const r = g.cleared.roomAt(wallPt(W, du + s, -(T + d))); if (r) return r; }
  return 0;
}
export function wallAt(g: Game, at: Vec3, from: Vec3 = g.player.char.pos): WallSpot | null {
  const walls = g.destr?.walls; if (!walls) return null;
  const boxes = g.col.boxes, K = WALLCHARGE, n = Math.min(walls.authored, boxes.length), skip = BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Dynamic;
  let best: WallSpot | null = null, bd = K.pickM + 1e-6;
  for (let i = 0; i < n; i++) {
    const b = boxes[i]; const dx = Math.max(b.c[0] - b.h[0] - at[0], 0, at[0] - b.c[0] - b.h[0]); if (dx > bd) continue;
    const dz = Math.max(b.c[2] - b.h[2] - at[2], 0, at[2] - b.c[2] - b.h[2]); if (dz > bd) continue;
    const B = walls.breakableAt(i); if (B ? B.kind !== 'wall' : (b.flags & skip) !== 0) continue;   // (a partition already holed is hidden — its pieces stand in for it — and still the wall)
    if (b.rot || Math.abs(Math.sin(b.yaw)) > 1e-6) continue;
    const sx = b.h[0] * 2, sz = b.h[2] * 2, long = Math.max(sx, sz), thin = Math.min(sx, sz); let why = '';
    const part = !!B && !B.hard;   // (a partition is the engine's from the start; a hard wall — an outer wall a charge has opened, wallbreak.ts adopt — is still structure, and takes another only while WALLCHARGE.outer)
    if (!part) {   // structure: full height off the floor, long enough to be a wall, in a wall's stuff — said so in words
      if (b.c[1] - b.h[1] > 0.1 || b.c[1] + b.h[1] < WALLS.wallMinTop || long < 0.8 || thin > 1.2) continue;
      const s = surfOf(b.albedo); if (s !== 'drywall' && s !== 'concrete' && s !== 'metal') continue;
      why = s === 'metal' || b.metal ? "steel. a charge won't cut it." : thin > WALLS.wallMaxThick || s === 'concrete' ? "concrete. a charge won't cut it." : "outer wall. a charge won't cut it.";
    }
    const d = Math.hypot(dx, dz) - (B ? 1e-3 : 0); if (d >= bd) continue;
    const outer = !part && (B ? K.outer : outerWall(g, i));   // (an outer wall takes a charge: WALLCHARGE.outer — one already holed is the engine's by now, and still it)
    if (K.outer && !part && !outer && !/^steel/.test(why) && thin <= K.outerThick) why = long < K.outerMinLen ? 'too short a stretch of wall for a charge.' : /^outer/.test(why) ? "a charge won't cut that one." : why;   // (with outer walls taking a charge, 'outer wall' is no reason)
    const alongX = sx >= sz, c = alongX ? b.c[0] : b.c[2], L = long / 2, m = Math.min(K.endM, L);
    const perp = alongX ? from[2] - b.c[2] : from[0] - b.c[0];
    bd = d; best = { index: i, box: b, alongX, u: clamp(alongX ? at[0] : at[2], c - L + m, c + L - m), side: perp >= 0 ? 1 : -1, ok: part || outer, why: part || outer ? '' : why, ...(outer ? { outer } : null) };
  }
  return best;
}
/** orders.ts targetAt's last line: a floor target whose point is on a wall carries the wall (nothing when the module is not live) */
export function wallTarget(g: Game, at: Vec3, base: OrderTarget): OrderTarget {
  if (base.kind !== 'floor' || !g.wallCharge || !wallChargeOn(g)) return base;
  const W = wallAt(g, at); return W ? { ...base, wall: W } : base;
}
/** orders.ts rowsFor: the rows of a wall's menu — the floor's, its fifth turned to 'wall tools ▸' (or, WALLCHARGE.menu 'direct', to the charge itself), and the
 *  wall tools' own page */
export function wallRows(g: Game, t: OrderTarget, page: string | null, rows: OrderDef[]): OrderDef[] {
  const WC = g.wallCharge; if (t.kind !== 'floor' || !t.wall || !WC || !wallChargeOn(g) || !WC.seated) return rows;
  const direct = WALLCHARGE.menu === 'direct';
  if (page === null) return [...rows.filter(d => d.key !== 5), direct ? WC.row : WC.opener, ...rows.filter(d => d.key === 5).map(d => WC.undigit(d))];   // (the floor's own fifth row — 'go silent' — stays on the wall's menu, below, with no digit: the wheel reaches it, as any row past the fifth)
  return page === WALL_PAGE && !direct ? [WC.row] : rows;
}
type RowFn = (base: Interactable, verb: Verb, text: string, hints?: string, over?: Partial<Interactable>) => Interactable;
type OfferFn = (it: Interactable, verbs: Interactable[]) => void;
/** player.ts buildInteractables: Sam's own row at the foot of a partition his cursor is on */
export function wallChargeRows(g: Game, p: Vec3, busy: boolean, row: RowFn, offer: OfferFn) { g.wallCharge?.samRows(p, busy, row, offer); }

export class WallCharge {
  readonly knobs = WALLCHARGE;
  ops: WallOp[] = []; done: (WallOp & { ended: string })[] = []; set: SetWallCharge[] = [];
  stats = { orders: 0, set: 0, bySam: 0, blown: 0, holes: 0, duds: 0, knocked: 0, stunned: 0, backblast: 0, entries: 0, back: 0, cleared: 0 };
  /** WALLCHARGE.menClear: the men walked off a set charge (his mark, and when his place was last in the blast · when he was last asked about) and the marks dealt for each charge */
  private away = new Map<Guard, { c: SetWallCharge; at: Vec3; hitT: number; t: number }>();
  private awayMarks = new Map<SetWallCharge, { n: number; marks: Vec3[]; t: number; sets: number; R: ReturnType<typeof safeRadius>; pad: ReturnType<typeof safeRadius> }>();
  private awayNone = new Map<Guard, number>();
  log: { t: number; what: string }[] = [];
  /** the two rows (registered only while the module is live — seat()) */
  readonly opener: OrderDef; readonly row: OrderDef;
  seated = false;
  private mode = ''; private player: unknown = null; private roster: Guard[] = []; private alone = 0;
  /** Sam setting one by hand: the place, since when, where he stood · the place his row was last offered on */
  private sam: { wall: WallSpot; t0: number; at: Vec3 } | null = null; private offered: WallSpot | null = null;

  constructor(private g: Game) {
    this.opener = { id: WALL_PAGE, label: 'wall tools', targets: ['floor'], listed: [], opens: WALL_PAGE, key: 5, issue: () => { } };
    this.row = { id: WALL_ORDER, label: t => { const c = this.chargeOnTarget(t); return c ? `blow the charge${this.closeWords(c)}` : this.rowWords(); }, targets: ['floor'], listed: [], ack: ['copy.', 'on it.'],
      can: (_S, gd, t) => this.canOf(gd, t), valid: (_S, t, men) => this.valid(t, men), issue: (_S, men, t) => this.issue(men, t) };
    g.orders.notes.push(() => this.hudNotes());
  }

  // ------------------------------------------------------------ the run, the switch, the rows
  /** a new Player or a new cast is a fresh run; the rows are on the menu only while the module is live. Returns live. */
  private sync(): boolean {
    const g = this.g; let i = 0, same = this.player === g.player;
    for (const gd of g.guards) if (gd.unit && gd.team === 'operative' && this.roster[i++] !== gd) same = false;
    if (!same || i !== this.roster.length) {
      const first = this.player === null, was = this.roster.length; this.roster = g.guards.filter(gd => !!gd.unit && gd.team === 'operative'); this.player = g.player;
      // (the door tools put their counts back when the cast changes; with no cast before or after they never do — what Sam spent alone goes back here)
      if (!first && !was && !this.roster.length && this.alone > 0) { g.doorTools.sync(); while (this.alone-- > 0 && g.doorTools.charges < DOORTOOLS.charges) g.doorTools.refund('charge'); }
      this.reset();
    }
    const live = wallChargeOn(g), mode = live ? WALLCHARGE.menu : '';
    if (mode !== this.mode) { this.mode = mode; this.seat(); if (!live) this.stop(); }
    return live;
  }
  /** a row the wall's fifth has taken the digit of: itself, digitless (one stand-in a row, so the menu's highlight rides it by identity) */
  private standIns = new SideMap<OrderDef, OrderDef>();
  undigit(d: OrderDef): OrderDef { let x = this.standIns.get(d); if (!x) this.standIns.set(d, x = Object.create(d, { key: { value: undefined, writable: true, enumerable: true } }) as OrderDef); return x; }
  private seat() {
    const S = this.g.orders; S.unregister(WALL_PAGE); S.unregister(WALL_ORDER); this.seated = false; if (!this.mode) return;
    const page = this.mode === 'page';
    this.opener.key = 5; if (page) S.register(this.opener);
    this.row.page = page ? WALL_PAGE : undefined; this.row.key = page ? 3 : 5; S.register(this.row); this.seated = true;
  }
  /** a fresh run: nothing set, nothing under way (the counts are the door tools' to put back) */
  reset() { this.ops = []; this.done = []; this.set = []; this.sam = null; this.offered = null; this.alone = 0; this.carried = this.brought = WALLCHARGE.carried; this.log = []; for (const k of Object.keys(this.stats) as (keyof WallCharge['stats'])[]) this.stats[k] = 0; this.lastBlow = null; this.walks = null; this.keep.asks = this.keep.hits = 0; this.away.clear(); this.awayMarks.clear(); this.awayNone.clear(); }
  /** the switch went off mid-run: what is set comes off the wall and back into the bag, what is under way ends where it stands */
  private stop() { for (const op of [...this.ops]) this.end(op, 'switched off'); for (const c of this.set.splice(0)) this.giveBack(c, 'switched off'); this.sam = null; this.marker = null; this.walks = null; }
  private note(what: string) { this.log.push({ t: this.g.time, what }); if (this.log.length > 300) this.log.splice(0, 100); }
  private beat(op: WallOp, what: string) { op.beats.push({ t: this.g.time, what }); this.note(`wall ${op.wall.index}: ${what}`); }
  /** WALL CHARGES CARRIED THIS RUN apart from the bag (WALLCHARGE.carried's note): null = none, a wall is paid out of the bag at WALLCHARGE.cost. Put back to
   *  the knob by reset() — every new cast, restart and load — so whoever sets it sets it again per staging (setCarried) */
  carried: number | null = WALLCHARGE.carried;
  /** the kit's hook (kit.ts kitStage, once per staging after the cast stands): this run carries `n` wall charges of its own — null: back to the cost rule */
  setCarried(n: number | null) { this.sync(); this.carried = this.brought = n === null ? null : Math.max(0, Math.floor(n)); }
  /** a mission's own issue (issue.ts, after the kit's call in the same staging): this run carries AT LEAST `n` — what the kit gave is never lowered */
  raiseCarried(n: number) { this.sync(); const k = Math.max(0, Math.floor(n)); if ((this.carried ?? 0) < k) this.carried = this.brought = k; }
  /** what setCarried last gave this run (0 = the kit issued none: the refusal says 'carried', not 'left') */
  private brought: number | null = WALLCHARGE.carried;
  /** what a wall takes out of the bag now (0 while they are carried) · can one be set · how many more walls this run could blow */
  private get price(): number { return this.carried !== null ? 0 : Math.max(1, Math.floor(WALLCHARGE.cost)); }
  get affordable(): boolean { return this.carried !== null ? this.carried > 0 : this.g.doorTools.charges >= this.price; }
  get wallsLeft(): number { return this.carried !== null ? this.carried : Math.floor(this.g.doorTools.charges / this.price); }
  /** the row's words (the squad's menu and Sam's own) · the refusal's, with none to set */
  private rowWords(): string { const n = this.g.doorTools.charges, p = this.price;
    return this.carried !== null ? `breach with a wall charge · ${this.carried} left` : p <= 1 ? `breach with a charge · ${n} left` : p === 2 && n === 2 ? 'breach the wall · uses both charges' : `breach the wall · uses ${p} of ${n} charges`; }
  private noneWords(): string { return this.carried !== null ? (this.brought === 0 ? 'no wall charge carried.' : 'no wall charge left.') : this.price > 1 && this.g.doorTools.charges > 0 ? 'not enough charge for a wall.' : 'no charges left.'; }
  /** one set on a wall: paid out of the carried ones, else out of the bag (all `cost` of it or none). The price paid, or −1 = there was none to set */
  private take(): number { const g = this.g; this.freeSet = false;
    // UNLIMITED AMMO (the sandbox row; the maintainer, 10-14: "unlimited ammo doesn't apply to wall charges"): with one to set, it is set and none is spent
    if (g.infiniteAmmo && this.affordable) { this.freeSet = true; this.stats.set++; this.note('wall charge set · unlimited ammo: none spent'); return 0; }
    if (this.carried !== null) { if (this.carried <= 0) return -1; this.carried--; this.stats.set++; this.note(`wall charge set · ${this.carried} carried left`); return 0; }
    const p = this.price; if (g.doorTools.charges < p) return -1; for (let i = 0; i < p; i++) g.doorTools.take('charge');
    if (!this.roster.length) this.alone += p; this.stats.set++; return p; }
  /** the last take() spent nothing (unlimited ammo): the record it makes is `free` */
  private freeSet = false;
  private giveBack(c: SetWallCharge, why: string) {
    if (c.free) { /* (nothing was spent on it) */ } else if (c.paid <= 0) { if (this.carried !== null) this.carried++; } else { for (let i = 0; i < c.paid; i++) this.g.doorTools.refund('charge'); if (!this.roster.length) this.alone = Math.max(0, this.alone - c.paid); }
    this.stats.back++; this.note(`charge off wall ${c.wall.index}: ${why}`); }
  /** the squad block's lines: what is CARRIED, while this run brought wall charges of its own (a kit card's, a mission's issue) — the door tools' count line beside it
   *  is the breaching bag, which a carried wall charge never touches, so without this the player learned of them only at a wall's menu row; nothing under the
   *  cost rule (the bag's own line is the count) nor on a run that brought none — and a charge waiting for the trigger. The count is read as it stands: the HUD is the page's alone, so a read here never
   *  re-syncs the roster (that writes state the simulation reads) */
  private hudNotes(): OrderNote[] { const n = this.set.length; if (!wallChargeOn(this.g)) return [];
    const out: OrderNote[] = this.carried !== null && (this.brought ?? 0) > 0 ? [{ key: '', text: `wall charges ${this.carried}` }] : []; if (!n) return out;
    const mark = ((this.g as any).pair?.waiting?.().length ?? 0) > 0;   // (a build with the pair's orders in it: while his partner waits on a mark, F is the mark first — the note says so)
    // (ownblow.ts: the squad's key for the charges that are its to blow, the interaction's for his own — a note each, counted apart)
    for (const own of [false, true]) { const of = (c: SetWallCharge) => this.keyIs(c) !== own, k = this.set.filter(of).length; if (!k) continue;
      out.push({ key: blowKeyWord(!own, DOORTOOLS.blowKey.replace('Key', '')), text: `blow the charge · the wall${k > 1 ? ` (${k})` : ''}${mark && !own ? ' · after the mark' : ''}${this.closeWords(this.nearest(of), true)}` }); }
    return out; }
  summary(): string { const s = this.stats; return `${wallChargeOn(this.g) ? `on (${WALLCHARGE.menu})` : 'off'} · ${this.g.doorTools.charges} charges · ${this.set.length} set · ${this.ops.map(o => o.phase).join(',') || 'nothing under way'} · set ${s.set} (${s.bySam} by the player) blown ${s.blown} holes ${s.holes} · knocked ${s.knocked} stunned ${s.stunned} backblast ${s.backblast} · entries ${s.entries}`; }

  // ------------------------------------------------------------ the place
  chargeOn(W: WallSpot): SetWallCharge | null { return this.set.find(c => sameWall(c.wall, W)) ?? null; }
  private chargeOnTarget(t: OrderTarget): SetWallCharge | null { return t.kind === 'floor' && t.wall ? this.chargeOn(t.wall) : null; }
  /** the target's wall as these men would work it now: the charge on Sam's side, slid along the wall (WALLCHARGE.slide) to the nearest place with floor to
   *  set it from and floor behind it that is not open already */
  spot(t: OrderTarget): WallSpot | null {
    if (t.kind !== 'floor' || !t.wall) return null; const g = this.g, w = t.wall, sam = g.player.char.pos;
    const perp = w.alongX ? sam[2] - w.box.c[2] : sam[0] - w.box.c[0];
    return this.settle({ ...w, side: perp >= 0 ? 1 : -1 });
  }
  private settle(W: WallSpot): WallSpot {
    if (!W.ok || this.chargeOn(W) || this.openAt(W)) return W; const b = W.box, c = W.alongX ? b.c[0] : b.c[2], L = W.alongX ? b.h[0] : b.h[2], m = Math.min(WALLCHARGE.endM, L);
    // (floor as it stands today first, over every slide — the places it finds are the places it always found; only where it finds none, floor as the charge leaves it)
    for (const furn of WALLCHARGE.farFurn ? [false, true] : [false]) for (const s of WALLCHARGE.slide) { const u = W.u + s; if (u < c - L + m - 1e-6 || u > c + L - m + 1e-6) continue; const q = { ...W, u }; if ((s === 0 || !this.chargeOn(q)) && !this.openAt(q) && this.setSpot(q) && this.farFloor(q, furn)) return q; }
    return W;
  }
  /** nothing stands at the charge's place any more (the sill gone: a hole — a port's sill still takes a charge) */
  openAt(W: WallSpot): boolean { return !this.g.col.solidBlocked(wallPt(W, 0, FACE, 0.35), wallPt(W, 0, -(thick(W) + FACE), 0.35)); }
  /** where the man who sets it stands (null: no floor at the wall's foot there) */
  private setSpot(W: WallSpot): Vec3 | null {
    const nav = this.g.col.nav;
    for (const strict of [true, false]) for (const du of [0, 0.3, -0.3]) { const q = wallPt(W, du, WALLCHARGE.setOff); if (!nav.isBlocked(q[0], q[2]) && !(strict && this.inFrame(q))) return q; }   // (out of a doorway where the wall's foot allows)
    return null;
  }
  /** floor past the far face (null: none — a hole there lets nobody through). `furn`: failing floor as the nav grid has it today, floor as it will be once the
   *  charge has taken the furniture against the far face (mouthAfter) */
  private farFloor(W: WallSpot, furn = WALLCHARGE.farFurn): Vec3 | null {
    const nav = this.g.col.nav, T = thick(W);
    for (const d of [0.5, 0.8]) for (const du of [0, 0.4, -0.4]) { const q = wallPt(W, du, -(T + d)); if (!nav.isBlocked(q[0], q[2])) return q; }
    return furn ? this.mouthAfter(W) : null;
  }
  private nearby = new Int32Array(48);
  /** THE HOLE'S MOUTH ONCE THE CHARGE HAS GONE (WALLCHARGE.farFurn): a way through wherever the hole lands. The wall engine puts the hole on its own
   *  columns — its middle up to `farSlack` along the wall from the charge, never past the wall's ends — and holeAt() then wants floor both sides at some
   *  point within `farReach` of that middle. So: for EVERY middle the hole could have there is such a point, where 'floor' is the nav grid's today or a
   *  cell that only the opened stretch of this wall and furniture this charge is sure to break stand on (floorAfter). null = no promise, the refusal as
   *  it was. NOT promised (refused as before): a piece on the squad's OWN side of the wall nearer the charge than the one behind it (it is the blast's
   *  first, and nothing is promised of a second). */
  private mouthAfter(W: WallSpot): Vec3 | null {
    const g = this.g, T = thick(W), K = WALLCHARGE, step = 0.125;
    const first = g.destr.furn.firstToGo(chargeAt(W), chargeSource(WALLS.blast.radius)), cleared = K.farMouth && FURN.mouth.on; if (!first && !cleared) return null;
    const wall = g.destr.walls.breakableAt(W.index)?.id ?? W.index, b = g.col.boxes[wall] ?? W.box;   // (the wall as authored: once holed, `W.box` is one of the pieces standing in for it, and the engine still lands the hole on the whole wall's columns)
    const c = W.alongX ? b.c[0] : b.c[2], L = W.alongX ? b.h[0] : b.h[2], half = WALLS.blast.minHole * WALLS.col / 2;
    const lo = Math.max(-K.farSlack, c - L + half - W.u), hi = Math.min(K.farSlack, c + L - half - W.u); if (lo > hi + 1e-6) return null;   // (the hole's middle: inside the wall's own length)
    let any: Vec3 | null = null, anyAt = Infinity;
    for (let m = lo, last = false; !last; m += step) {   // (every middle, both ends of the run among them: a run of shut floor wider than the reach is at least two steps long)
      if (m >= hi - 1e-9) { m = hi; last = true; }
      const mouth = [wallPt(W, m, -(T + FURN.mouthM), 1.0)];   // (where furnblast.ts blast() will blow from on the far side: the hole's own middle, past the far face)
      // what the hole's own clearing takes (furnblast.ts mouth(): the stretch open from the floor up, FURN.mouth.depth out from either face) — asked only when a
      // cell needs it, of the narrowest hole the engine opens, and half a step short at either end: its middle may lie between two of the middles tried here
      const a0 = W.u + m - half + step / 2, a1 = W.u + m + half - step / 2, tc = W.alongX ? b.c[2] : b.c[0], td = (W.alongX ? b.h[2] : b.h[0]) + FURN.mouth.depth;
      const zone: [number, number, number, number] = W.alongX ? [a0, tc - td, a1, tc + td] : [tc - td, a0, tc + td, a1];
      const goes = cleared ? (i: number) => g.destr.furn.mouthWouldTake(i, zone) : null;
      const through = (du: number): Vec3 | null => { const far = wallPt(W, du, -(T + K.mouthIn));
        // (near side, the wall's own cell between, the cell behind the far face, the far cell: all at ONE place along the wall. On the near side the cell
        //  at the face is mostly the wall's own — shut today, open once holed — so there must also be floor a man can stand on TODAY, in it or in the next
        //  one out: floor either side of a hole is no way through where a piece on the squad's own side stands across the rest of its breadth (sandbags
        //  against the near face in a lived-in yard). Nothing is asked of the second cell where the first is open: a passage one cell wide is a way in.)
        const nav = g.col.nav, n0 = wallPt(W, du, 0.35), n1 = wallPt(W, du, 0.35 + nav.cell);
        return this.floorAfter(W, m, half, n0, wall, null, mouth) && (!nav.isBlocked(n0[0], n0[2]) || !nav.isBlocked(n1[0], n1[2]))
          && this.floorAfter(W, m, half, wallPt(W, du, -T / 2), wall, first, mouth, goes) && this.floorAfter(W, m, half, wallPt(W, du, -(T + Math.max(0.05, K.mouthIn - nav.cell))), wall, first, mouth, goes)
          && this.floorAfter(W, m, half, far, wall, first, mouth, goes) ? far : null; };
      let got: Vec3 | null = through(m);
      for (let k = step; k <= K.farReach + 1e-6 && !got; k += step) got = through(m - k) ?? through(m + k);
      if (!got) return null; if (Math.abs(m) < anyAt) { any = got; anyAt = Math.abs(m); }
    }
    return any;
  }
  /** the nav cell at `q` will be open once a hole `half` wide either way of `m` (along the wall from the charge) is in this wall: it is open today, or
   *  everything that shuts it — the bake's own question, NavGrid.cellBlockers — is this wall (its box, or the pieces standing in for it once it has been
   *  holed: `wall`, the engine's id for it) with the stretch left standing beside the hole clear of the cell's circle, or, past the far face (`first`
   *  given), a part of the piece of furniture this charge breaks first that the blast takes from the hole's far mouth (furnblast.ts wouldTake). A cot
   *  against the far face is no reason to refuse the wall: it goes with the wall, and the floor it stood on is re-baked open. Anything else in the cell's
   *  way (another wall, a second piece, furniture out of the band, a cell off the grid) and it is no floor, as before — unless (`goes`, past the far face
   *  under WALLCHARGE.farMouth) it is a thing the blown hole's own clearing takes from its mouth. */
  private floorAfter(W: WallSpot, m: number, half: number, q: Vec3, wall: number, first: BlastFirst | null, mouth: Vec3[], goes: ((i: number) => boolean) | null = null): boolean {
    const g = this.g, nav = g.col.nav; if (!nav.isBlocked(q[0], q[2])) return true;
    const n = nav.cellBlockers(q[0], q[2], this.nearby); if (n <= 0) return false;
    let ours = false;
    for (let k = 0; k < n; k++) { const i = this.nearby[k];
      if (i === W.index || g.destr.walls.breakableAt(i)?.id === wall) ours = true;
      else if (!(first && g.destr.furn.wouldTake(first, i, mouth)) && !goes?.(i)) return false; }
    if (!ours) return true;
    // what is left of the wall beside the hole: nearer the cell's centre than the bake's circle and the cell stays shut
    const cx = (Math.floor(q[0] / nav.cell) + 0.5) * nav.cell, cz = (Math.floor(q[2] / nav.cell) + 0.5) * nav.cell, b = g.col.boxes[wall] ?? W.box, R = 0.36;
    const off = Math.max(0, Math.abs(W.alongX ? cz - b.c[2] : cx - b.c[0]) - thick(W) / 2); if (off >= R) return true;
    return half - Math.abs((W.alongX ? cx : cz) - W.u - m) >= Math.sqrt(R * R - off * off);
  }
  /** in a doorway (WALLCHARGE.offFrame of a door frame's centre): no place for a man to wait or to hold from */
  private inFrame(q: Vec3, m = WALLCHARGE.offFrame): boolean { return m > 0 && this.g.doors.list.some(d => flat(q, d.frameCentre) < m); }
  /** the wall is already open at the foot of a post `du` along it from the charge (WALLCHARGE.offHoles: a hole to the floor or a port over its sill, there or within a man's half-width; only on this wall's own box) */
  private openFoot(W: WallSpot, du: number): boolean { if (!WALLCHARGE.offHoles) return false; const b = W.box, c = W.alongX ? b.c[0] : b.c[2], L = W.alongX ? b.h[0] : b.h[2];
    for (const e of [0, 0.35, -0.35]) { const u = W.u + du + e; if (u <= c - L || u >= c + L) continue; const w = { ...W, u };
      if (this.openAt(w) || !this.g.col.solidBlocked(wallPt(w, 0, FACE, 1.2), wallPt(w, 0, -(thick(w) + FACE), 1.2))) return true; } return false; }
  /** n stand-off marks, the nearest the setter's spot first: along the wall either way from the charge while the floor at its foot runs on, at least
   *  WALLCHARGE.standoff from it — else back across the floor (null: no room) */
  standoffPosts(W: WallSpot, n: number, spot: Vec3 = wallPt(W, 0, WALLCHARGE.setOff), old = false): Vec3[] | null {
    const g = this.g, nav = g.col.nav, K = WALLCHARGE, sam = g.player.char.pos, at = wallPt(W, 0, 0);
    if (K.safe && !old) { const out = this.safePosts(W, n, spot); if (out) return out; }   // (the larger radius, or out of the blast's line; no room for them all: the marks as they always were, below)
    const free = (q: Vec3) => !nav.isBlocked(q[0], q[2]), clear = (a: Vec3, b: Vec3) => !g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]);
    const reach = K.clearM > 0 ? WALLS.blast.radius * WALLS.blast.portK + 0.25 + K.clearM : 0;   // (what the blast can open along the wall, and a man's width past it)
    for (const min of K.standoff) for (const strict of [true, false]) {   // (strict: out of doorways and off old holes' feet; where that leaves no room for them all, the marks as they would have been)
      const out: Vec3[] = [], ok = (q: Vec3) => !out.some(o => flat(o, q) < 0.8) && flat(q, sam) >= 0.7;
      const runs: Vec3[][] = [];
      for (const dir of [1, -1]) { const run: Vec3[] = [], lo = Math.max(min, reach); let prev = spot, next = lo;
        for (let s = 0.45; s <= lo + n * K.fileGap + 0.5; s += 0.45) { const q = wallPt(W, dir * s, K.postOff); if (!free(q) || !clear(prev, q)) break; prev = q; if (s + 1e-6 >= next && !(strict && (this.inFrame(q) || this.openFoot(W, dir * s)))) { run.push(q); next = s + K.fileGap; } }   // (a place in a doorway, or at the foot of a hole already in this wall, is walked past: the post is the next one along)
        runs.push(run); }
      for (let k = 0; out.length < n && (k < runs[0].length || k < runs[1].length); k++) for (const r of runs) if (r[k] && out.length < n && ok(r[k])) out.push(r[k]);
      if (out.length < n) {   // back across the floor, in a fan off the wall's normal
        const nx = spot[0] - at[0], nz = spot[2] - at[2], L = Math.hypot(nx, nz) || 1;
        for (const ang of [0, 0.5, -0.5, 1.0, -1.0]) { const cs = Math.cos(ang), sn = Math.sin(ang), dx = (nx * cs - nz * sn) / L, dz = (nx * sn + nz * cs) / L;
          for (const d of K.backM) { if (out.length >= n) break; const q: Vec3 = [at[0] + dx * d, 0, at[2] + dz * d]; if (free(q) && clear(spot, q) && flat(q, at) >= min && wallOff(W, q) > 0.3 && ok(q) && !(strict && this.inFrame(q))) out.push(q); } }
      }
      if (out.length >= n) return out.sort((a, b) => flat(a, spot) - flat(b, spot));
    }
    return null;
  }
  /** THE SAFE STAND-OFF (WALLCHARGE.safe): n marks out of the blast, the nearest the setter's spot first (safeBack: the shortest WALK back first, and no hidden mark past safeBackM of it) — along the wall at the safety radius or more, or anywhere within safeHideM on the charge's side that the blast has no line to: something solid between, further from the
   *  charge than the blast can open, and no more than safeWalkM of walk from the wall's foot (round a corner, through a door and beside it); then, for whoever is left, back
   *  across the floor at the radius. Never in a doorway, never at the foot of an old hole. Null: the floor has not n of them. */
  private safePosts(W: WallSpot, n: number, spot: Vec3, can?: (q: Vec3) => boolean, kept?: Kept): Vec3[] | null {
    const g = this.g, nav = g.col.nav, K = WALLCHARGE, sam = g.player.char.pos, at = wallPt(W, 0, 0), R = safeRadius(g, W);
    const free = (q: Vec3) => !nav.isBlocked(q[0], q[2]), clear = (a: Vec3, b: Vec3) => !g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]);
    const pool: Vec3[] = [], fan: Vec3[] = [], back = K.safeBack, cap = back ? Math.min(K.safeWalkM, K.safeBackM) : K.safeWalkM, walk = new Map<Vec3, number>();
    const fire = K.outOfFire ? this.underFire(W) : null;
    // (OURS: a mark is only ever on floor the squad holds — the room the charge is set from, a room one of them has stood in (cleared.ts), or open floor. A place out of the
    //  blast's line is very often the next room, and the next room is very often the defenders')
    const room0 = g.cleared.roomAt(spot), ours = (q: Vec3) => { const r = g.cleared.roomAt(q); return !r || r === room0 || g.cleared.isKnown(r); };
    for (const dir of [1, -1]) { let prev = spot, next = R.standoff;   // along the wall, while the floor at its foot runs on
      for (let s = 0.45; s <= R.standoff + n * K.fileGap + 0.5; s += 0.45) { const q = wallPt(W, dir * s, K.postOff); if (!free(q) || !clear(prev, q)) break; prev = q; if (s + 1e-6 >= next && !this.inFrame(q) && !this.openFoot(W, dir * s) && ours(q)) { pool.push(q); next = s + K.fileGap; } } }
    { const nx = spot[0] - at[0], nz = spot[2] - at[2], L = Math.hypot(nx, nz) || 1;   // back across the floor, in a fan off the wall's normal: only for whom the wall and the corners have no place
      for (const ang of [0, 0.5, -0.5, 1.0, -1.0]) { const cs = Math.cos(ang), sn = Math.sin(ang), dx = (nx * cs - nz * sn) / L, dz = (nx * sn + nz * cs) / L;
        for (const d of [0.1, 1.0, 1.9]) { const q: Vec3 = [at[0] + dx * (R.standoff + d), 0, at[2] + dz * (R.standoff + d)]; if (free(q) && clear(spot, q) && wallOff(W, q) > 0.3 && !this.inFrame(q) && ours(q)) fan.push(q); } } }
    { const hid: Vec3[] = [], STEP = [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]], open = WALLS.blast.radius * WALLS.blast.portK + 0.25, lo = Math.max(K.standoff[0], open + 0.6), src = wallPt(W, 0, 0.5, 1.1);   // out of its line (`open`: what stands nearer the charge than this the blast may take away — no cover)
      for (let x = -K.safeHideM; x <= K.safeHideM + 1e-6; x += 0.9) for (let z = -K.safeHideM; z <= K.safeHideM + 1e-6; z += 0.9) {
        const q: Vec3 = [at[0] + x, 0, at[2] + z], d = flat(q, at); if (d < lo || d > K.safeHideM || !free(q) || wallOff(W, q) <= 0.3 || this.inFrame(q) || !ours(q)) continue;
        // (a door leaf is no cover: the blast flings it or takes it off its hinges; nor is a pane of glass. And the cover has to hold a step either way: a man stops within a stride of his mark, not on it)
        const covered = (p: Vec3) => { const chest: Vec3 = [p[0], 1.1, p[2]], from = v3.lerp(src, chest, open / v3.dist(src, chest)); return g.col.solidBlocked(from, chest) && g.col.segmentBlocked(from, chest); };
        if (this.noLeaves(() => covered(q) && STEP.every(([dx, dz]) => { const p: Vec3 = [q[0] + dx, 0, q[2] + dz]; return !free(p) || covered(p); }))) hid.push(q); }
      hid.sort((a, b) => flat(a, spot) - flat(b, spot));
      // (outOfFire: the search's few walks are spent twice over — on the places no known enemy can shoot, then on the ones under fire, each the nearest few of
      //  its kind: a floor whose unwatched places are all too far a walk still has every place the search would have found without the rule)
      //  (the under-fire ones met on the way are kept for the second go, with whatever the first never reached: `any` is asked of no more places than that)
      const late: Vec3[] = []; let left = hid;
      for (const pass of fire ? [0, 1] : [1]) { let walks = 0, tries = 0; const list = pass ? left : hid; if (!pass) left = late;
      for (let k = 0; k < list.length; k++) { const q = list[k]; if (walks >= n + 8 || tries >= 3 * (n + 8)) { if (!pass) for (let m = k; m < list.length; m++) late.push(list[m]); break; }
        if (pool.some(o => flat(o, q) < 0.8)) continue; if (!pass && fire!.any(q)) { late.push(q); continue; } tries++; if (!back) walks++;   // (a walk is a search: the nearest few only — safeBack: the nearest few it TAKES, since the nearest by the straight line are the ones through the wall, a long way round)
        const way = (): number => { const path = nav.findPath(spot, q, 4000); if (!path) return -1; let len = 0, a = spot, held = true;   // (…and the walk there keeps to floor that is ours)
          for (const b of path) { const L = flat(a, b), m = Math.max(1, Math.ceil(L / 0.5)); for (let i = 1; i <= m && held; i++) held = ours(v3.lerp(a, b, i / m)); len += L; a = b; } return held && len <= cap ? len : -1; };
        const len = kept ? kept(`w|${spot[0]},${spot[2]}|${q[0]},${q[2]}|${cap}`, way) : way(); if (len >= 0) { pool.push(q); walk.set(q, len); if (back) walks++; } } } }
    // (safeBack: the walk back is what the blast's seconds are spent on, so the shortest walk is the first mark dealt — a place along the wall is its own straight line)
    const near = (a: Vec3, b: Vec3) => flat(a, spot) - flat(b, spot), far = (q: Vec3) => walk.get(q) ?? flat(q, spot); pool.sort(back ? (a, b) => far(a) - far(b) : near); fan.sort(near);
    // (outOfFire: the least under known fire first — a stable sort, so among the places nobody known can shoot the order is the one it was)
    const all = [...pool, ...fan], out: Vec3[] = []; if (fire) all.sort((a, b) => fire.score(a) - fire.score(b));
    for (const q of all) { if (out.length >= n) break; if (!out.some(o => flat(o, q) < 0.8) && flat(q, sam) >= 0.7 && (!can || can(q))) out.push(q); }   // (`can`: a place the men cannot walk to — the far side of a locked door — is no place: asked only of the ones about to be dealt)
    return out.length >= n ? out : null;
  }
  /** WHO THE TEAM KNOWS OF, AND WHERE (WALLCHARGE.outOfFire): each living enemy in the team's picture now, where he stands — or seen inside fireKnownS, where he
   *  was last seen (fogofwar.ts sighting). The one place this file asks what the squad knows of the enemy; with picture.ts's rule on, the men's own pictures
   *  answer with the fog's record (a man heard and never shown is known too: the ?picture view shows where). */
  knownFoes(): Vec3[] {
    const g = this.g, out: Vec3[] = [], held = g.player.holding?.g ?? null;
    const counts = (h: Guard) => h !== held && h.state !== 'dead' && h.char.alive && isHostile(h.team, 'player');
    // (picture.ts PICTURE.wall: under the fog of war ONE function answers — knownPlaces: what the fog has shown and what the squad's men saw, heard or were
    // told, the freshest of each man inside the same fireKnownS, nobody whose place one of them has since seen empty. The rule off, or the fog off: the
    // record alone, as below.)
    if (PICTURE.on && PICTURE.wall && g.fogOfWar.active) { for (const k of knownPlaces(g, g.guards.filter(m => m.team === 'operative'), WALLCHARGE.fireKnownS)) if (k.who !== 'player' && counts(k.who)) out.push(k.at); return out; }
    for (const h of g.guards) { if (!counts(h)) continue;
      const s = g.fogOfWar.sighting(h); if (s && s.age >= 0 && s.age <= WALLCHARGE.fireKnownS) out.push(s.at); }
    return out;
  }
  /** HOW MUCH UNDER THEIR FIRE A PLACE IS: 0 = none of them has a line a round can take (glass passes; a door leaf stops it where it hangs) to the chest or
   *  head of a man standing on it, or to the chest of one a step either way of it (a man stops within a stride of his mark, not on it) — else, summed over the
   *  ones who have, the share of those lines that are clear over his distance, in whole steps of `fireGrain` (1 = the least: a stride's worth of difference is
   *  not worth a longer walk). The middle of a near man's lane is the worst floor, the edge of a far one's the least bad. THE WALL ABOUT TO GO IS NO COVER
   *  (`W`): a line that crosses it inside the hole the charge will open, with nothing else on it either side, is a line — the floor square in front of the
   *  charge is the lane of whoever is known behind it. `any` = is it under fire at all, the first clear line ending the asking. Each asked once a place. */
  private underFire(W: WallSpot | null = null, all = this.knownFoes()): { score: (q: Vec3) => number; any: (q: Vec3) => boolean } {
    const g = this.g, K = WALLCHARGE, e = K.fireStep, AT = [[0, 0, 1.1], [0, 0, 1.55], [e, 0, 1.1], [-e, 0, 1.1], [0, e, 1.1], [0, -e, 1.1]];
    const T = W ? thick(W) : 0, half = WALLS.blast.radius * WALLS.blast.holeK, memo = new Map<Vec3, number>(), hit = new Map<Vec3, boolean>();
    const line = (a: Vec3, b: Vec3): boolean => { if (!g.col.segmentBlocked(a, b)) return true; if (!W) return false;
      const oa = wallOff(W, a), ob = wallOff(W, b); if (!(oa < -T && ob > 0)) return false;   // (he is past its far face, the place on the charge's side)
      const at = (off: number): Vec3 => v3.lerp(a, b, (oa - off) / (oa - ob)); if (Math.abs(wallAlong(W, at(-T / 2))) > half) return false;
      return !g.col.segmentBlocked(a, at(-T - 0.05)) && !g.col.segmentBlocked(at(0.05), b); };
    const lines = (f: Vec3, q: Vec3, stop: boolean): number => { let n = 0; const from: Vec3 = [f[0], 1.4, f[2]];
      for (const [dx, dz, y] of AT) { const x = q[0] + dx, z = q[2] + dz; if ((dx || dz) && g.col.nav.isBlocked(x, z)) continue; if (line(from, [x, y, z])) { n++; if (stop) break; } } return n; };
    const near = (q: Vec3) => all.filter(f => flat(f, q) <= K.fireM);
    const score = (q: Vec3) => { let v = memo.get(q); if (v !== undefined) return v; let sum = 0; for (const f of near(q)) sum += lines(f, q, false) / AT.length / Math.max(1, flat(f, q));
      v = sum > 0 ? 1 + Math.floor(sum / K.fireGrain) : 0; memo.set(q, v); hit.set(q, v > 0); return v; };
    const any = (q: Vec3) => { let v = hit.get(q); if (v === undefined) { v = near(q).some(f => lines(f, q, true) > 0); hit.set(q, v); } return v; };
    return { score, any };
  }
  /** how much a place is under the fire of the enemies the team knows of (0 = not at all; `W`: a charge's wall, which is then no cover where it will open —
   *  the check's question, and anybody's) */
  fireAt(q: Vec3, W: WallSpot | null = null): number { return this.underFire(W).score(q); }
  /** HOW MUCH OF THE BLAST A PLACE ON THE CHARGE'S OWN SIDE TAKES: 0 = none (past the reach, behind the wall, or something solid between it and the charge),
   *  up to 1 at the wall. The one test blow() punishes by and the trigger's rows warn by. */
  blastShare(W: WallSpot, p: Vec3, R = safeRadius(this.g, W), leaves = true): number {
    const d = flat(p, wallPt(W, 0, 0)); if (d >= R.reach || wallOff(W, p) < -thick(W) / 2) return 0;
    const cut = () => this.g.col.solidBlocked(wallPt(W, 0, 0.5, 1.1), [p[0], 1.1, p[2]]);
    return (leaves ? cut() : this.noLeaves(cut)) ? 0 : 1 - d / R.reach;
  }
  /** A FOLLOWER'S PLACE IS IN THE BLAST OF A SET CHARGE (WALLCHARGE.menClear): the stand-off mark he walks to instead — null: his place is clear of every
   *  charge on a wall (and has been for menClearS), the floor has no mark for him, or the switch is off. Asked by orders.ts of a man on 'fall in', every
   *  step, with the place he would otherwise take (`where`: read only when a charge is on a wall). */
  clearOf(gd: Guard, where: () => Vec3): Vec3 | null {
    const K = WALLCHARGE, g = this.g, t = g.time;
    if (!K.on || !K.safe || !K.menClear || !this.set.length) { if (this.away.size) this.away.clear(); if (this.awayMarks.size) this.awayMarks.clear(); if (this.awayNone.size) this.awayNone.clear(); return null; }
    for (const c of this.awayMarks.keys()) if (!this.set.includes(c)) this.awayMarks.delete(c);
    for (const [m, a] of this.away) if (m.state === 'dead' || !this.set.includes(a.c) || (m !== gd && Math.abs(t - a.t) > 0.5)) this.away.delete(m);   // (the charge gone, or a man no longer on 'fall in': his mark is free)
    /** the charge's radius, read once while it is on the wall (the roof over it is a handful of rays), and the same with the stand-off distance for its reach */
    const rOf = (c: SetWallCharge) => { let M = this.awayMarks.get(c); if (!M) { const R = safeRadius(g, c.wall); this.awayMarks.set(c, M = { n: 0, marks: [], t: -1e9, sets: 0, R, pad: { ...R, reach: Math.max(R.reach, R.standoff - K.menClearIn) } }); } return M; };
    const hit = (c: SetWallCharge, q: Vec3) => this.blastShare(c.wall, q, rOf(c).pad, false) > 0;   // (blastShare: the distance first, the line only inside it)
    let A = this.away.get(gd); if (A && this.set.some(o => hit(o, A!.at))) { this.away.delete(gd); A = undefined; }   // (another charge has gone on a wall by his mark: dealt again)
    const place = where(), c = this.set.find(c => hit(c, place));
    if (A) { A.t = t; if (c || t < A.hitT) A.hitT = t; else if (t - A.hitT >= K.menClearS) { this.away.delete(gd); return null; } return A.at; }
    if (!c) return null;
    const none = this.awayNone.get(gd); if (none !== undefined && t >= none && t - none < 1) return null; this.awayNone.delete(gd);   // (the floor had no mark for him: asked again a second on)
    const p = gd.char.pos, nav = g.col.nav, S = g.orders, taken: Vec3[] = []; for (const [m, a] of this.away) if (m !== gd) taken.push(a.at);
    for (const op of this.ops) for (const q of op.post.values()) taken.push(q);   // (the marks of the men an order stood off: theirs)
    const clear = (q: Vec3) => !this.set.some(o => hit(o, q));   // (out of EVERY charge on a wall, not only the one his place is by)
    const others = S.men().filter(m => m !== gd), free = (q: Vec3) => !taken.some(o => flat(o, q) < 0.8) && !others.some(m => flat(m.char.pos, q) < 0.6) && clear(q);
    const n = Math.max(1, others.length + 1), M = rOf(c);
    // (the marks: dealt once for the charge and kept — asked again when more men want one, another charge has gone on a wall, or the deal is two seconds old; two more than the men, where the floor has them)
    if (M.n < n || M.sets !== this.set.length || Math.abs(t - M.t) > 2) { const spot = this.setSpot(c.wall) ?? wallPt(c.wall, 0, K.setOff), memo = new Map<string, unknown>(), kept: Kept = <T>(key: string, work: () => T): T => { if (!memo.has(key)) memo.set(key, work()); return memo.get(key) as T; };
      let marks: Vec3[] | null = null; for (let k = n + 2; k >= 1 && !marks; k--) marks = this.safePosts(c.wall, k, spot, clear, kept); M.n = n; M.marks = marks ?? []; M.t = t; M.sets = this.set.length; }
    let at: Vec3 | null = null; const all: Vec3[] = []; for (const o of this.set) all.push(...rOf(o).marks);
    for (const q of all.sort((a, b) => flat(p, a) - flat(p, b))) if (free(q) && !S.reach(gd, q)) { at = q; break; }   // (the nearest to him that is nobody's and that he can walk to)
    if (!at) for (const o of [c, ...this.set.filter(k => k !== c)]) {   // (no mark left for him: straight back from a charge to its stand-off, where that is floor he can walk to and out of every blast)
      const w = wallPt(o.wall, 0, 0), dx = p[0] - w[0], dz = p[2] - w[2], L = Math.hypot(dx, dz), R = rOf(o).R; if (at || L <= 0.2) continue;
      for (const d of [0, 0.9, 1.8]) { const q: Vec3 = [w[0] + dx / L * (R.standoff + d), 0, w[2] + dz / L * (R.standoff + d)];
        if (!nav.isBlocked(q[0], q[2]) && nav.walkable(p, q) && !this.inFrame(q) && free(q)) { at = q; break; } } }
    if (!at) { this.awayNone.set(gd, t); return null; }
    A = { c, at: [at[0], 0, at[2]], hitT: t, t }; this.away.set(gd, A); this.stats.cleared++; this.note(`${gd.callsign} steps back from the charge on wall ${c.wall.index}`);
    return A.at;
  }
  /** a line asked with the door leaves out of the way: BEFORE the blast a leaf standing between a man and the charge is no cover (the blast flings it or takes
   *  it off its hinges) — the stand-off marks and the trigger's warning ask this way; blow() itself asks with the leaves where the blast left them */
  private noLeaves<T>(f: () => T): T { const col = this.g.col, dyn = col.dynamicBoxes; col.dynamicBoxes = []; try { return f(); } finally { col.dynamicBoxes = dyn; } }
  /** WHO IS INSIDE THE RADIUS of a set charge right now (WALLCHARGE.safe): 'you' and the teammates by callsign — [] = nobody, or the switch off */
  tooClose(c: SetWallCharge | null): string[] {
    if (!c || !WALLCHARGE.safe) return []; const g = this.g, R = safeRadius(g, c.wall), out: string[] = [];
    if (!g.player.down && this.blastShare(c.wall, g.player.char.pos, R, false) > 0) out.push('you');
    for (const gd of g.orders.men()) if (this.blastShare(c.wall, gd.char.pos, R, false) > 0) out.push(gd.callsign);
    return out;
  }
  /** WHO THE BLAST WOULD CATCH BEYOND THE WALL right now (WALLCHARGE.safe): the far-side half of blow()'s own test, asked BEFORE the wall has gone — past
   *  the wall's middle, inside the stun's reach of the charge, and a line to him from the far face. blow() asks that line from the hole's own middle with the
   *  leaves where the blast left them; neither is known yet, so the warning asks from the far face at the charge and a step either side of it with the door
   *  leaves out (noLeaves, as tooClose asks: the blast flings a leaf) and names him if any is clear — it may name a man the blast then spares, never the other
   *  way where the level lets it know. A teammate who walked round; and 'you' where the blast does to the player what it does to a teammate standing there
   *  (samstun.ts, live play only, as blow() has it — off, nothing reaches him through the wall and nothing is said). [] = nobody, or the switch off */
  behind(c: SetWallCharge | null): string[] {
    if (!c || !WALLCHARGE.safe) return []; const g = this.g, W = c.wall, T = thick(W), at = wallPt(W, 0, 0), out: string[] = [];
    const lined = (p: Vec3) => this.noLeaves(() => [0, 0.4, -0.4].some(du => !g.col.solidBlocked(wallPt(W, du, -(T + 0.45), 1.1), [p[0], 1.1, p[2]])));
    const beyond = (p: Vec3) => wallOff(W, p) < -T / 2;
    { const p = g.player.char.pos; if (SAMSTUN.on && !g.player.down && !g.puppet && !g.touring && beyond(p) && flat(p, at) < DOORTOOLS.stunM && lined(p)) out.push('you'); }
    for (const gd of g.orders.men()) { const p = gd.char.pos; if (beyond(p) && flat(p, at) <= DOORTOOLS.stunM && lined(p)) out.push(gd.callsign); }
    return out;
  }
  /** the trigger's warning in words: who is inside the radius on the charge's side, then who stands beyond the wall where it will open ('' = nobody) */
  private closeWords(c: SetWallCharge | null, caps = false): string { const near = this.tooClose(c), far = this.behind(c);
    return (near.length ? `${caps ? ' · TOO CLOSE: ' : ' · too close: '}${near.join(', ')}` : '') + (far.length ? `${caps ? ' · BEHIND THE WALL: ' : ' · behind the wall: '}${far.join(', ')}` : ''); }
  /** a teammate OUTSIDE the order in the blast: past the wall in the charge's open reach once it is a hole, or too near it on its own side (the word for it; null: none) */
  private inBlast(W: WallSpot, men: Guard[]): string | null {
    const g = this.g, at = wallPt(W, 0, 0), out = wallPt(W, 0, 0.5, 1.1), inn = wallPt(W, 0, -(thick(W) + 0.45), 1.1);
    for (const gd of g.orders.men()) { if (men.includes(gd)) continue; const p = gd.char.pos, d = flat(p, at), chest: Vec3 = [p[0], 1.1, p[2]];
      if (wallOff(W, p) < -thick(W)) { if (d < DOORTOOLS.stunM && !g.col.solidBlocked(inn, chest)) return `${gd.callsign} is behind that wall.`; }
      else if (d < WALLCHARGE.mateM && !g.col.solidBlocked(out, chest)) return `${gd.callsign} is too close to that wall.`; }
    return null;
  }
  /** who sets it, from where, and where everybody stands off — or the word for why not */
  private plan(W: WallSpot, men: Guard[], kept?: Kept): { lead: Guard; spot: Vec3; deal: [Guard, Vec3][]; close: boolean } | string {
    const S = this.g.orders, K = WALLCHARGE, cs = this.g.col.nav.cell; if (!men.length) return 'nobody to take it.';
    // (`kept`: the open menu's re-read — a man's walk from the nav cell he stands in to a place is asked of the orders once while nothing it is judged by changes)
    const reach = (gd: Guard, to: Vec3): string | null => kept ? kept(`r|${gd.char.id}|${Math.floor(gd.char.pos[0] / cs)},${Math.floor(gd.char.pos[2] / cs)}|${to[0]},${to[2]}`, () => S.reach(gd, to)) : S.reach(gd, to);
    const spot = this.setSpot(W); if (!spot) return 'no room at that wall.';
    if (!this.farFloor(W)) return 'no floor behind it.';
    const lead = [...men].sort((a, b) => flat(a.char.pos, spot) - flat(b.char.pos, spot))[0], rest = men.filter(m => m !== lead);
    const deal = (posts: Vec3[]): [Guard, Vec3][] => [[lead, posts[0]], ...(rest.length ? S.pair(rest, posts.slice(1)) : [])];
    const walk = (d: [Guard, Vec3][]): string | null => { for (const [gd, p] of d) { const w = reach(gd, p); if (w) return w; } return null; };
    if (K.safe) {   // the marks out of the blast, where the floor has them and every man can walk to his — else the marks as they always were, below
      const posts = this.safePosts(W, men.length, spot, q => !reach(lead, q), kept);
      if (posts && !this.inBlast(W, men) && !reach(lead, spot)) { const d = deal(posts); if (!walk(d)) return { lead, spot, deal: d, close: false }; }
    }
    const posts = this.standoffPosts(W, men.length, spot, true); if (!posts) return 'no room to stand off.';
    const mate = this.inBlast(W, men); if (mate) return mate;
    const w0 = reach(lead, spot); if (w0) return w0;
    const d = deal(posts), w = walk(d); if (w) return w;
    return { lead, spot, deal: d, close: K.safe };
  }
  /** the walks of the open menu, kept between its re-reads, when `t` is that menu's own target (`plan`'s `kept`) */
  private keptFor(t: OrderTarget): Kept | undefined { const M = WALLCHARGE.safe && this.keep.on ? this.g.orders.menu : null; return M && M.target === t ? this.keptWalks(M) : undefined; }
  /** one man's part (orders.ts OrderDef.can): a man with no walk to the wall — stood in a pocket of floor no path reaches, behind a door locked against the
   *  team — says so and is left as he was while the others set it. It used to be `plan`'s refusal for everybody. With a charge already on the wall the row is
   *  the trigger, which is nobody's walk; where there is no place to set one `valid` says why */
  private canOf(gd: Guard, t: OrderTarget): true | string {
    if (!this.sync()) return true; const W = this.spot(t); if (!W || !W.ok || this.chargeOn(W) || this.openAt(W)) return true;
    const spot = this.setSpot(W); if (!spot) return true; const S = this.g.orders, cs = this.g.col.nav.cell, kept = this.keptFor(t);
    const ask = () => S.reach(gd, spot); return (kept ? kept(`r|${gd.char.id}|${Math.floor(gd.char.pos[0] / cs)},${Math.floor(gd.char.pos[2] / cs)}|${spot[0]},${spot[2]}`, ask) : ask()) ?? true;
  }
  /** the row's test (orders.ts OrderDef.valid): true, or the refusal in words */
  private valid(t: OrderTarget, men: Guard[]): true | string | false {
    if (!this.sync()) return false; const W = this.spot(t); if (!W) return false;
    if (this.chargeOn(W)) return true;
    if (!W.ok) return W.why;
    if (this.openAt(W)) return "it's open.";
    if (!this.affordable) return this.noneWords();
    if (this.ops.some(o => o.phase === 'place' && sameWall(o.wall, W))) return 'already on it.';
    // (WALLCHARGE.safe, the open menu asking of its own target — orders.ts refresh hands a wall's menu its very target object: the walks it asks are kept
    //  between its re-reads, keptWalks. An order being given — the menu has closed, or it was given by code on a target of its own — keeps and reads nothing)
    const P = this.plan(W, men, this.keptFor(t)); return typeof P === 'string' ? P : true;
  }
  /** THE WALKS A WALL'S ROW ASKS, KEPT WHILE THE ORDERS MENU IS UP (WALLCHARGE.safe). The menu re-asks every row each ORDERS.refreshSecs, and this row's answer
   *  is a whole plan: the stand-off search, then a walk priced for the setter to every mark he might be dealt and for every man to his own — path searches,
   *  1 to 20 ms of them on the office (orders.ts keeps its own answers under a second, so each re-read paid for all of them again: a hitch a second with a wall
   *  under the cursor). While the menu that asked is still up, a walk asked again — the same man in the same nav cell to the same place, or the stand-off's
   *  'can a man get from the wall's foot to this corner' — is answered as it was, for as long as nothing a walk is judged by has changed: the floor (every nav
   *  cell), Sam's ring and codes, which doors are locked and latched, how many rooms are known and what an unknown one costs, the walls' change count and the level's. EVERYTHING ELSE IS
   *  ASKED AFRESH at every re-read: every line (the leaves where they hang now), every distance, who is in the blast.
   *  IT IS ONLY EVER THE GREYED ROW'S YES OR WHY-NOT. An order GIVEN keeps nothing and reads nothing kept — the menu closes before it gives (orders.ts release:
   *  `S.menu` is null by then), and the quick key, the console and a probe hand over a target of their own, never the open menu's — so valid() and issue()
   *  plan it as they always did: which marks come out cannot depend on this, nor can a run and its checkpoint load differ by it (a load is a fresh run:
   *  reset() drops it, and its menu is another menu). What it can do is leave the greyed row a re-read behind where a walk's answer turns on something the
   *  stamp does not hold (a man shifting inside his nav cell — the grain orders.ts keeps its own walks by); picking the row plans afresh and says so. */
  private walks: { menu: object; stamp: string; map: Map<string, unknown> } | null = null;
  /** `on`: the checks' handle for their paired run (not a knob: no row, no flag, nothing kept per machine) · walks the open menu asked · … and was given again */
  keep = { on: true, asks: 0, hits: 0 };
  private keptWalks(M: object): Kept {
    const g = this.g, P = g.player, B = g.col.nav.blocked, O = g.orders.knobs;
    let locks = ''; for (const d of g.doors.list) locks += d.locked && d.latched ? 1 : 0;
    let h = 0; for (let i = 0; i < B.length; i++) h = (Math.imul(h, 31) + B[i]) | 0;
    const stamp = `${[...P.keys].join(',')}|${[...P.codes].join(',')}|${locks}|${g.cleared.known}|${g.destr.walls.serial}|${(g.engine.world as { geomSerial?: number }).geomSerial ?? 0}|${B.length}:${h}|${O.cleared ? `${O.clearedDear},${O.roundCap}` : 0}|${WORDS.on ? 1 : 0}`;
    let k = this.walks; if (!k || k.menu !== M || k.stamp !== stamp || k.map.size > 512) k = this.walks = { menu: M, stamp, map: new Map() };
    const map = k.map, n = this.keep;
    return <T>(key: string, work: () => T): T => { n.asks++; if (map.has(key)) { n.hits++; return map.get(key) as T; } const v = work(); map.set(key, v); return v; };
  }

  // ------------------------------------------------------------ the order
  private assign(op: WallOp, gd: Guard, a: Pick<Assignment, 'post' | 'face' | 'going' | 'there'> & Partial<Assignment>) { const S = this.g.orders; S.assign(gd, { order: WALL_ORDER, ...a }); op.mine.set(gd, S.of(gd)!); }
  private standOff(op: WallOp, gd: Guard) {
    const W = op.wall, P = op.post.get(gd)!, watch = wallPt(W, 0, 0, WALLCHARGE.height), away = WALLCHARGE.brace && op.phase !== 'wait';   // (braced: his back to it until it has gone)
    this.assign(op, gd, { post: P, face: away ? yawTo(watch, P) : yawTo(P, watch), watch: away ? null : watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, going: 'standing off', there: 'stood off · the wall' });
  }
  /** the row's release (orders.ts OrderDef.issue): a set charge there is blown; else one man to the wall, the rest to the stand-off */
  private issue(men: Guard[], t: OrderTarget): string | void {
    if (!this.sync()) return 'not here'; const g = this.g, W = this.spot(t); if (!W) return 'no wall there';
    const c = this.chargeOn(W); if (c) { this.blow(c); return; }
    const P = this.plan(W, men); if (typeof P === 'string') return P;
    for (const o of [...this.ops]) { o.men = o.men.filter(m => !men.includes(m)); if (!o.men.length) this.end(o, 're-ordered'); }   // (the men are this order's now)
    const op: WallOp = { wall: W, men: [...men], lead: P.lead, phase: 'place', t0: g.time, spot: P.spot, setT: NaN, mine: new Map(), post: new Map(P.deal), from: new Map(men.map(m => [m, [m.char.pos[0], 0, m.char.pos[2]] as Vec3])), hole: null, queue: [], stage: new Map(), pod: new Map(), crossed: new Map(), last: new Map(), inT: NaN, beats: [], ...(P.close ? { close: true } : null) };
    this.ops.push(op); this.stats.orders++;
    this.assign(op, P.lead, { post: P.spot, face: yawTo(P.spot, wallPt(W, 0, 0)), watch: null, stance: 'none', upper: 'none', going: 'charge · the wall', there: 'setting the charge' });
    for (const gd of men) if (gd !== P.lead) this.standOff(op, gd);
    this.beat(op, `ordered · ${men.map(m => m.callsign).join(', ')} · ${P.lead.callsign} sets it`);
  }
  /** the order by code (the console, a probe, the scripted commander): 'breach with a charge' on the wall at that point — null when given, else why not */
  order(at: Vec3, who?: Parameters<SquadOrders['give']>[2]): string | null { const S = this.g.orders; return S.give(WALL_ORDER, S.targetAt(at), who); }
  private end(op: WallOp, why: string) {
    const i = this.ops.indexOf(op); if (i < 0) return; this.ops.splice(i, 1); this.beat(op, `end: ${why}`);
    if (WALLCHARGE.brace && (op.phase === 'place' || op.phase === 'standoff' || op.phase === 'armed')) { const S = this.g.orders, watch = wallPt(op.wall, 0, 0, WALLCHARGE.height);   // (ended before the blast turned them in — a dud, the charge gone, the module off: nobody is left with his back to that wall)
      for (const gd of op.men) { const A = op.mine.get(gd); if (A && S.of(gd) === A && A.going === 'standing off' && !A.spare && A.watch === null && A.post) { A.face = yawTo(A.post, watch); A.watch = watch; } } }
    this.done.push(Object.assign(op, { ended: why })); if (this.done.length > 12) this.done.shift();
  }
  /** A STAND-OFF MARK THAT HAS COME UNDER KNOWN FIRE IS DEALT AGAIN (picture.ts PICTURE.step; acts with `safe` and `outOfFire` — off, the marks stand as
   *  they were dealt, which is this rule as it was: 'the men do not re-pick when an enemy shows up later'). While the charge waits for the word, once a
   *  second: a man whose mark an enemy the team knows of can shoot at two asks running (underFire's own test, knownFoes' own list) is dealt the least under
   *  that fire of the places safePosts has for this wall, if none can shoot it or it is two steps of underFire's own score under his own (a walk is not worth
   *  less; the worst off first, the nearest on a tie) — out of the blast by that rule's own tests, a body's room from the marks the others keep, a walk
   *  he can make that takes him no further into the blast than he stands. ONCE A MAN: nobody is walked back and forth by an enemy who keeps moving, and the
   *  whole order spends four searches at most (their walks kept). The others keep theirs. No such place: he stays, and it is asked again in three seconds.
   *  Nobody says anything; a man on his way to the new mark when the word comes is as a man walking to his first. */
  private repick(op: WallOp) {
    const g = this.g, K = WALLCHARGE, t = g.time; if (!(PICTURE.on && PICTURE.step && K.safe && K.outOfFire) || op.close) return;
    if (t < (op.repickT ?? 0) && t >= (op.repickT ?? 0) - 3) return; op.repickT = t + 1;
    const done = op.redealt ??= new Set(), was = op.repickBad ?? new Set<Guard>(), at = (m: Guard) => op.post.get(m);
    const open = op.men.filter(gd => !done.has(gd) && !!at(gd)); if (!open.length || (op.repickN ?? 0) >= 4) { op.repickT = t + 3; return; }
    const fire = this.underFire(op.wall), hot = new Set(open.filter(gd => fire.any(at(gd)!))); op.repickBad = hot;
    const bad = [...hot].filter(gd => was.has(gd)); if (!bad.length) return;
    const cache = op.repickKept ??= new Map(), kept: Kept = (key, work) => { if (!cache.has(key)) cache.set(key, work()); return cache.get(key) as ReturnType<typeof work>; };
    const n = op.men.length, posts = this.safePosts(op.wall, n + 2, op.spot, undefined, kept) ?? this.safePosts(op.wall, n, op.spot, undefined, kept); let moved = 0;
    op.repickN = (op.repickN ?? 0) + 1;
    // (the walk: never deeper into the blast than where he stands now — the other side of the charge is no place to be sent across its front)
    const safeWalk = (gd: Guard, q: Vec3) => { const p0 = gd.char.pos, path = g.col.nav.findPath(p0, q, 4000); if (!path) return false; const lim = this.blastShare(op.wall, p0) + 0.05; let a = p0;
      for (const b of path) { const m = Math.max(1, Math.ceil(flat(a, b) / 0.5)); for (let i = 1; i <= m; i++) if (this.blastShare(op.wall, v3.lerp(a, b, i / m)) > lim) return false; a = b; } return true; };
    if (posts) for (const gd of bad.sort((a, b) => fire.score(at(b)!) - fire.score(at(a)!))) {   // (the worst off first; a place another man has, or has just been dealt, is his)
      const cur = at(gd)!, now = fire.score(cur), held = op.men.filter(m => m !== gd).map(at).filter((q): q is Vec3 => !!q);
      const q = posts.filter(q => { const f = fire.score(q); return (f === 0 || f <= now - 2) && !held.some(k => flat(k, q) < 0.8); }).sort((a, b) => fire.score(a) - fire.score(b) || flat(a, gd.char.pos) - flat(b, gd.char.pos)).find(q => !g.orders.reach(gd, q) && safeWalk(gd, q));
      if (!q) continue;
      op.post.set(gd, q); done.add(gd); if (op.mine.get(gd)?.going === 'standing off') this.standOff(op, gd); moved++; this.beat(op, `${gd.callsign} dealt again: his mark came under known fire`);
    }
    if (moved) PICTURE_STATS.stepped += moved; else op.repickT = t + 3;
  }
  /** REAR SECURITY while they stand off and wait for the word (the stack's rule at a door — orders.ts spareRear, COVER.stacked): the man stood furthest from
   *  the charge — with four or more, the two — has his eyes spare for the way a man could come at them (cover.ts deals it; `from`: the way he came). The
   *  others' guns stay on the wall. One man alone keeps his eyes on it. */
  private spareRear(op: WallOp) {
    const at = wallPt(op.wall, 0, 0), live = op.men.filter(m => op.mine.get(m)?.post); for (const m of live) op.mine.get(m)!.spare = false;
    if (!COVER.stacked || live.length < 2) return;
    const dist = (m: Guard) => flat(op.mine.get(m)!.post!, at);
    for (const m of [...live].sort((a, b) => dist(b) - dist(a) || live.indexOf(b) - live.indexOf(a)).slice(0, live.length >= 4 ? 2 : 1)) { const A = op.mine.get(m)!; A.spare = true; A.from ??= op.from.get(m) ?? [A.anchor[0], 0, A.anchor[2]]; }
  }
  /** is a walk to the marks still worth waiting on (doortools.ts waiting, with its knobs) */
  private waiting(op: WallOp, el: number): boolean {
    const g = this.g, K = DOORTOOLS; if (el >= K.stackCap) return false;
    return el < K.stillSecs || op.men.some(gd => { const A = op.mine.get(gd)!; return !A.arrived && g.time - A.movedT < K.stillSecs; });
  }

  // ------------------------------------------------------------ Sam's key, the frame
  /** the set charge nearest Sam (null: none) */
  nearest(of: (c: SetWallCharge) => boolean = () => true): SetWallCharge | null { const sam = this.g.player.char.pos; return this.set.filter(of).sort((a, b) => flat(wallPt(a.wall, 0, 0), sam) - flat(wallPt(b.wall, 0, 0), sam))[0] ?? null; }
  /** Sam's trigger (game.ts, ahead of the door tools' input): the nearest set charge goes — a door's, if that is the nearer, is the door tools' press and this
   *  one waits for the next. With door orders under way the press is also their word (left in the frame); otherwise it is used up here. */
  input(input: Input) {
    this.pressed = false; if (!this.sync() || !this.set.length) return; const g = this.g, S = g.orders, key = DOORTOOLS.blowKey; if (!input.hit(key)) return;
    if (g.player.down) { if (this.set.some(c => this.keyIs(c))) input.pressed.delete(key); return; }
    if (S.menu && S.menu.rows.some(d => d.hotKey === key)) return;   // (a menu up with a row on this key: the key IS that row — the door tools' rule)
    const D = g.doorTools, sam = g.player.char.pos, c = this.nearest(x => this.keyIs(x)); if (!c) return;   // (ownblow.ts: one his own hands set is not this key's, and does not stop the press here)
    if (D.set.some(x => D.keyIs(x) && flat(x.door.frameCentre, sam) < flat(wallPt(c.wall, 0, 0), sam))) return;
    this.blow(c);
    if (D.set.some(x => D.keyIs(x))) input.pressed.delete(key); else this.pressed = true;   // (one charge a press, the nearest first — but men waiting at a door for the word get it on this same press: the wall and the door go together)
  }
  /** game.ts, straight after the door tools' input: a press that blew a wall and was nobody's word besides is used up (never the drill's 'stack up' as well) */
  inputAfter(input: Input) { if (this.pressed) { this.pressed = false; input.pressed.delete(DOORTOOLS.blowKey); } }
  private pressed = false;
  tick() {
    if (!this.sync()) return; const g = this.g;
    this.samTick();
    for (const c of [...this.set]) { if (this.openAt(c.wall)) { this.set.splice(this.set.indexOf(c), 1); this.giveBack(c, 'the wall came open under it'); } else this.draw(c); }
    for (const op of [...this.ops]) this.step(op);
    if (this.done.length && g.time < this.done[this.done.length - 1].t0) this.done = [];   // (the clock went back: a load)
  }
  private step(op: WallOp) {
    const g = this.g, S = g.orders, K = WALLCHARGE, t = g.time, el = t - op.t0, W = op.wall;
    op.men = op.men.filter(gd => gd.state !== 'dead' && S.of(gd) === op.mine.get(gd));   // (down, or given another order: not this order's any more)
    if (!op.men.length) { this.end(op, 'nobody left on it'); return; }
    if (!op.men.includes(op.lead)) {   // (the setter is down, or given another order: the man nearest the charge's place has it — one not yet set starts over with him walking to it, as at a door)
      op.lead = [...op.men].sort((a, b) => flat(a.char.pos, op.spot) - flat(b.char.pos, op.spot))[0];
      if (op.phase === 'place') { op.setT = NaN; op.t0 = t; g.say(op.lead, WORDS.on ? "i've got the charge." : "I've got the charge.");
        this.assign(op, op.lead, { post: op.spot, face: yawTo(op.spot, wallPt(W, 0, 0)), watch: null, stance: 'none', upper: 'none', going: 'charge · the wall', there: 'setting the charge' }); this.beat(op, `setter now ${op.lead.callsign}`); } }
    const lead = op.lead;
    if (op.phase === 'standoff' || op.phase === 'armed') { this.repick(op); this.spareRear(op); }   // (set again every frame: an assignment re-made by a step keeps the job)
    switch (op.phase) {
      case 'place': {   // he is at the wall for setSecs, then it is on the wall and he walks off to the stand-off
        const A = op.mine.get(lead)!, near = flat(lead.char.pos, op.spot) < K.setNear;
        if (isNaN(op.setT)) { if (A.arrived && near) op.setT = t; else if (!this.waiting(op, el)) { g.say(lead, "can't get on that wall."); this.end(op, 'never made the wall'); } break; }
        if (!near) { op.setT = NaN; break; }   // (walked off it: not set)
        chargeHands(g, lead.char, wallPt(W, 0, 0, K.height), wallN(W), t - op.setT, DOORTOOLS.setSecs);   // (handwork.ts: his hands on it while it goes on)
        if (t - op.setT < DOORTOOLS.setSecs) break;
        if (this.openAt(W)) { g.say(lead, "it's open."); this.end(op, 'the wall opened'); break; }
        if (!this.chargeOn(W)) {
          const paid = this.take(); if (paid < 0) { g.say(lead, this.noneWords()); this.end(op, 'no charges'); break; }
          this.set.push({ wall: W, t, by: lead.callsign, paid, ...(this.freeSet ? { free: true } : {}) }); g.audio.play('lockPick', wallPt(W, 0, 0, K.height), 0.6); g.destr.furn.warm(); }
        if (WALLKILL.on) op.owes = true; else g.say(lead, 'charge set.');   // (WALLKILL: his word is what sends a thumb to the trigger, and at the wall the charge kills him — he says it once he is clear of it, below)
        this.beat(op, 'set');
        this.standOff(op, lead); op.phase = 'standoff'; op.t0 = t;
        break;
      }
      case 'standoff': {
        if (!this.chargeOn(W)) { this.end(op, 'the charge is gone'); break; }
        if (op.owes && flat(lead.char.pos, wallPt(W, 0, 0)) >= WALLKILL.nearM) { op.owes = false; g.say(lead, 'charge set.'); }   // (a man who cannot get that far says only the call below)
        if (!op.men.every(gd => op.mine.get(gd)!.arrived) && this.waiting(op, el)) break;
        // (WALLCHARGE.safe: said by the man who calls it, once, where the floor left them inside the radius)
        g.say(lead, (op.close || WALLCHARGE.safe) && op.men.some(m => this.blastShare(W, m.char.pos, undefined, false) > 0) ? "can't get clear of it. your call." : 'stood off. your call.'); g.msg(`charge set on the wall — ${DOORTOOLS.blowKey.replace('Key', '')} blows it`);
        op.phase = 'armed'; op.t0 = t; this.beat(op, 'armed');
        break;
      }
      case 'armed': if (!this.chargeOn(W)) this.end(op, 'the charge is gone'); break;   // (blow() moves the order on itself)
      case 'wait': if (el >= this.blowWait(op)) this.enter(op); break;
      case 'enter': {
        const T = thick(W), light = g.doorTools.lights ?? NIGHTBREACH.opLights, into = yawTo(wallPt(W, 0, 0), wallPt(W, 0, -1));
        for (let i = op.queue.length - 1; i >= 0; i--) { const q = op.queue[i]; if (t < q.at) continue; op.queue.splice(i, 1);
          if (op.men.includes(q.gd)) { op.pod.set(q.gd, q.pod); op.stage.set(q.gd, 'lane');
            this.assign(op, q.gd, { post: q.lane, face: into, watch: K.laneWatch > 0 ? wallPt(W, op.hole!.du, -(T + K.laneWatch), K.height) : null, pace: S.knobs.entry, stance: 'none', upper: 'aim', light, search: true, going: 'entering · the wall', there: 'entering · the wall' }); } }
        let settled = op.queue.length === 0;
        for (const gd of op.men) { const st = op.stage.get(gd), A = op.mine.get(gd)!; if (!st) { if (!op.pod.has(gd) && !op.queue.some(q => q.gd === gd)) continue; settled = false; continue; }
          const p = gd.char.pos; A.searchT = t; this.cross(op, gd, p);
          if (st === 'lane') { settled = false;
            if (wallOff(W, p) < -(T + 0.15) || A.arrived || (A.post !== null && flat(p, A.post) < 0.35)) { const pod = op.pod.get(gd)!; if (!op.crossed.has(gd)) op.crossed.set(gd, wallAlong(W, p)); op.stage.set(gd, 'pod');   // through the hole: on to his own point
              this.assign(op, gd, { post: pod.pos, face: pod.face, watch: pod.watch ?? null, pace: S.knobs.entry, stance: 'none', upper: 'aim', light, search: true, going: 'entering · the wall', there: pod.watch && !pod.door ? 'holding the hole' : 'holding the room' }); }
          } else if (!A.arrived && A.yieldT < 0) { if (!op.pod.get(gd)?.took) settled = false; }   // (a man the fight has is not waited for: he is in, and busy — nor one who has taken up his door: 'arrived' then means his gun is ON it, and a threat in the room may have it)
          else if (K.holdEach && A.arrived && A.yieldT < 0 && t - A.arrT >= K.holdSecs) this.takeHold(op, gd, light);   // (on his point, the room looked over: his door — or the hole — is his from here)
        }
        if (settled && isNaN(op.inT)) op.inT = t;
        if ((settled && t - op.inT >= K.sweepSecs) || el >= K.enterCap) {
          // (the room is theirs: from here each man's eyes are spare for its ways in — cover.ts deals them, the hole among what it finds; his sector stands where it deals nothing. The door entry's last act)
          for (const gd of op.men) if (op.stage.get(gd) === 'pod') this.takeHold(op, gd, light);
          if (COVER.inRoom) for (const gd of op.men) { const A = op.mine.get(gd); if (A && op.stage.get(gd) === 'pod') A.spare = true; }
          this.beat(op, settled ? 'in' : 'in (cap)'); this.stats.entries++; this.end(op, 'in'); }
        break;
      }
    }
  }
  /** a man on his point inside turns to what he was dealt to hold from it — one of the room's doors, or the hole (WALLCHARGE.doors / hole) — once */
  private takeHold(op: WallOp, gd: Guard, light: boolean | undefined) {
    const pod = op.pod.get(gd), h = pod?.hold; if (!pod || !h) return; pod.hold = undefined;
    // (one man always keeps the room — at the deal, and still now: with nobody left alive in it who has no door or hole of his own, this man's eyes stay on the room)
    const keeps = (o: Guard) => { const q = op.pod.get(o) ?? op.queue.find(x => x.gd === o)?.pod; return o !== gd && o.state !== 'dead' && !!q && !q.hold && !q.took && !q.watch; };   // (a man still on his way to the hole counts: he is coming)
    if (!op.men.some(keeps)) { this.beat(op, `keeps the room · ${gd.callsign}`); return; }
    // (from where he STANDS: a point with something on it is given up for his own feet — orders.ts — and the line to his door is tested again from there)
    const at = op.mine.get(gd)?.post ?? pod.pos, moved = flat(at, pod.pos) > 0.3;
    if (moved && h.door && this.g.col.shotBlocked([at[0], 1.2, at[2]], h.watch)) { this.beat(op, `no line to ${h.door} from where he stands · ${gd.callsign}`); return; }
    pod.took = true;
    this.assign(op, gd, { post: moved ? at : pod.pos, face: moved && h.door ? yawTo(at, h.watch) : h.face, watch: h.watch, pace: this.g.orders.knobs.entry, stance: 'none', upper: 'aim', light, search: true, going: 'entering · the wall', there: h.door ? 'holding the room' : 'holding the hole' });
    this.beat(op, `holds ${h.door ?? 'the hole'} · ${gd.callsign}`);
  }
  /** s the men stand after the blast before the order sends them in: `afterBlow`, less (WALLCHARGE.safeBack, under `safe`) the time the nearest of them needs to
   *  reach the hole at the team's pace — nobody is AT a hole inside afterBlow of its blast either way, and men stood off at the safe radii no longer stand it out
   *  on their marks first. */
  private blowWait(op: WallOp): number {
    const K = WALLCHARGE, now = this.g.time; if (!K.safe || !K.safeBack || !op.hole || op.men.some(m => m.dazzledUntil > now)) return K.afterBlow;   // (a man the blast caught: the beat as it was)
    const at = wallPt(op.wall, op.hole.du, 0); let near = Infinity; for (const gd of op.men) near = Math.min(near, flat(gd.char.pos, at));
    return Math.max(0, K.afterBlow - near / PACE.max);
  }
  /** behind the blast: the men nearest the hole first, DOORTOOLS.second apart, each through the hole's far mouth to a point of his own inside */
  private enter(op: WallOp) {
    const g = this.g, S = g.orders, nav = g.col.nav, K = WALLCHARGE, W = op.wall, H = op.hole!, T = thick(W), t = g.time;
    const mouth = wallPt(W, H.du, -(T + K.mouthIn)), free = (q: Vec3) => !nav.isBlocked(q[0], q[2]), seen = (q: Vec3) => !g.col.solidBlocked([mouth[0], 0.45, mouth[2]], [q[0], 0.45, q[2]]);
    const men = gunLast([...op.men].sort((a, b) => flat(a.char.pos, mouth) - flat(b.char.pos, mouth))), pods: Pod[] = [], into = yawTo(wallPt(W, 0, 0), wallPt(W, 0, -1));
    for (let i = 0; i < men.length; i++) { const [lat, deep] = K.pods[i % K.pods.length]; let got: Vec3 | null = null;
      for (const strict of [true, false]) { for (const k of [1, 0.6, 0.3, -1, -0.6, 0]) { for (const dd of [0, 0.6, -0.5, 1.2]) { const q = wallPt(W, H.du + lat * k, -(T + Math.max(0.8, deep + dd))); if (free(q) && seen(q) && !(strict && this.inFrame(q, K.offFramePod)) && !pods.some(o => flat(o.pos, q) < 0.7)) { got = q; break; } } if (got) break; } if (got) break; }   // (a point in one of the room's doorways only when the room has no other floor for him)
      if (got) pods.push({ pos: got, face: this.lookFrom(got, into, yawTo(mouth, got)) }); }
    if (!pods.length) { g.say(op.lead, 'no way in.'); this.end(op, 'no floor inside'); return; }
    const inMen = men.slice(0, pods.length), stay = men.slice(pods.length);
    if (stay.length) { op.men = op.men.filter(m => !stay.includes(m)); this.beat(op, `outside · ${stay.map(m => m.callsign).join(', ')}`); }   // (no floor for him inside: he keeps the stand-off, and is not this order's any more)
    const deal = new Map<Guard, Pod>();
    for (let k = 0; k < inMen.length; k += 2) { const m = inMen.slice(k, k + 2), sp = pods.slice(k, k + 2); for (const [gd, pos] of S.pair(m, sp.map(x => x.pos))) deal.set(gd, sp.find(x => x.pos === pos)!); }
    const half = Math.max(0, Math.min(K.lane, H.half - 0.4));
    op.queue = inMen.map((gd, i) => { const pod = deal.get(gd) ?? pods[0], sg = Math.sign(wallAlong(W, pod.pos) - H.du) || (i % 2 ? 1 : -1); let lane = wallPt(W, H.du + sg * half, -(T + K.mouthIn)); if (!free(lane)) lane = free(mouth) ? mouth : pod.pos;
      return { gd, at: t + i * DOORTOOLS.second, lane, pod }; });
    // (the door entry's last-out rule, DOORTOOLS.lastOut: three or more going in — the last man through with a line to the hole keeps his gun on the way they
    //  came in by, his watch point `lastOutM` on out through it: Sam in the hole is in that line, and the gun comes down for him)
    // (K.holdLate: both are taken up once the room is theirs — on the way in every gun is on the room ahead of it, where the men the blast left standing are)
    const hold = (pod: Pod, h: NonNullable<Pod['hold']>): Pod => K.holdLate ? { ...pod, hold: h } : { pos: pod.pos, ...h }, has = (pod: Pod) => !!(pod.watch || pod.hold);
    // (the room's own doors: each, nearest the hole first, is one man's to hold from his point — the nearest man with a line to it who has nothing yet. A man
    //  with no door keeps the room ahead of him, and one man always does. What the door entry gets from its points of domination and ENTRY.watch; the room model is the room fight's)
    if (K.doors) { const room = g.fight?.roomAt(mouth) ?? null, free2 = op.queue.filter(q => !has(q.pod));
      const ins = (room?.entries ?? []).map(e => ({ name: e.door.def.name, p: [e.at[0] - e.out[0] * 0.5, 1.2, e.at[2] - e.out[1] * 0.5] as Vec3, sq: Math.abs(W.alongX ? e.out[1] : e.out[0]) > 0.7 })).filter(e => wallOff(W, e.p) < -T).map(e => ({ ...e, back: e.sq && wallOff(W, e.p) > -(T + 1.2) })).sort((a, b) => (a.back ? 1 : 0) - (b.back ? 1 : 0) || flat(a.p, mouth) - flat(b.p, mouth));   // (`back`: a door in the blown wall's own line opens onto the side they came from — the room's other ways in are dealt first)
      for (const e of ins) { if (free2.filter(q => !has(q.pod)).length <= 1) break; let pick: typeof free2[number] | null = null, bd = Infinity;   // (the last man free keeps the room)
        for (const q of free2) { const p = q.pod.pos, d = flat(p, e.p); if (has(q.pod) || d < 0.8 || d >= bd || g.col.shotBlocked([p[0], 1.2, p[2]], e.p) || op.queue.some(o => o !== q && nearSeg(o.pod.pos, p, e.p) < K.mateLine)) continue; pick = q; bd = d; }   // (a line of FIRE: a pane between is no line, and a mate's point on it is a mate down his muzzle)
        if (pick) { pick.pod = hold(pick.pod, { face: yawTo(pick.pod.pos, e.p), watch: e.p, door: e.name }); this.beat(op, `${e.name} · ${pick.gd.callsign}`); } } }
    // (… and the hole, after the doors: the last man through whom no door took — while another is left for the room)
    if (K.hole && DOORTOOLS.lastOut && inMen.length >= 3 && op.queue.filter(q => !has(q.pod)).length >= 2) { const w = wallPt(W, H.du, -T / 2, 1.2);
      for (let i = op.queue.length - 1; i >= 0; i--) { const q = op.queue[i], p = q.pod.pos; if (has(q.pod) || g.col.segmentBlocked([p[0], 1.2, p[2]], w)) continue;
        const yaw = yawTo(p, w), far = flat(p, w) + DOORTOOLS.lastOutM; q.pod = hold(q.pod, { face: yaw, watch: [p[0] + Math.sin(yaw) * far, 1.2, p[2] + Math.cos(yaw) * far] }); this.beat(op, `hole · ${q.gd.callsign}`); break; } }
    op.phase = 'enter'; op.t0 = t; this.beat(op, 'go'); g.say(op.lead, 'going in.');
  }
  /** WHERE HE CROSSED THE WALL'S LINE (WallOp.crossed): the point on the wall's middle plane between his last two places, in metres along it from the charge.
   *  Read by the checks and their words only — nothing in the game steers by it. (Until he has crossed, the entry's own sample stands in: where he was when he
   *  was sent on to his point — 0.15 m past the far face, as it always was.) */
  private cross(op: WallOp, gd: Guard, p: Vec3) {
    const was = op.last.get(gd); if (was === null) return; const W = op.wall, mid = -thick(W) / 2, o1 = wallOff(W, p);
    if (!was) { op.last.set(gd, o1 < mid ? null : [p[0], p[1], p[2]]); return; }   // (first seen already past it — the fight carried him in: the entry's own sample is his)
    const o0 = wallOff(W, was); if (o1 < mid) { op.crossed.set(gd, lerp(wallAlong(W, was), wallAlong(W, p), (o0 - mid) / (o0 - o1))); op.last.set(gd, null); return; }
    was[0] = p[0]; was[1] = p[1]; was[2] = p[2];
  }
  /** the way a man on his point inside faces: the way he came (`want`) unless that is a wall within two metres of his chest — then the longest open line within a quarter turn of straight in */
  private lookFrom(p: Vec3, into: number, want: number): number {
    const col = this.g.col, open = (yaw: number) => { let d = 0; while (d < 6 && !col.solidBlocked([p[0], 1.2, p[2]], [p[0] + Math.sin(yaw) * (d + 1), 1.2, p[2] + Math.cos(yaw) * (d + 1)])) d++; return d; };
    if (open(want) >= 2) return want;
    let best = want, score = -Infinity;
    for (let a = -90; a <= 90; a += 15) { const yaw = into + a * Math.PI / 180, sc = open(yaw) - 0.4 * Math.abs(Math.atan2(Math.sin(yaw - want), Math.cos(yaw - want))); if (sc > score) { score = sc; best = yaw; } }
    return best;
  }

  // ------------------------------------------------------------ the blast
  /** Sam's trigger on one charge (F, the menu's 'blow the charge', a probe): the wall opened through the engine's blast entry point, the stun charge's report
   *  and flash with nobody on its list, the door charge's rule for the men near it — and the squad that set it goes in behind it */
  blow(c: SetWallCharge | null = this.nearest(), pressed = true): { hole: boolean; knocked: number; stunned: number; backblast: number; lost: number } | null {
    if (!c) return null; const g = this.g, K = DOORTOOLS, W = c.wall, i = this.set.indexOf(c); if (i < 0) return null; this.set.splice(i, 1);
    holdFireOrder(g, 'wallCharge', { blown: true });   // (holdfire.ts: a charge starts the fight when it GOES, not when it is set)
    const T = thick(W), at = chargeAt(W);
    const breach = W.outer && WALLCHARGE.outer && g.destr.walls.adopt(W.index) ? { breach: W.index } : null;   // (an outer wall: the engine takes it on now, and this blast alone opens it — WALLCHARGE.outer)
    const hung = WALLCHARGE.hung ? { hung: { wall: W.index, r: WALLCHARGE.hungM } } : null;   // (what hangs on the wall under the charge — a notice board — is the charge's too: WALLCHARGE.hung)
    if (WALLSHOT.on) g.cleared.roomAt(at);   // (WALLSHOT names the room beyond by the room map: built, if nobody has asked it yet, on the floor as it is BEFORE this hole joins two of its rooms)
    g.destr.blast(at, { who: PLAYER_ID, chaos: false, ...breach, ...hung });   // (the walls, the cover by it, the doors' and the glass's own lists; its dust and clutter are the stun charge's call below — once)
    const hole = this.holeAt(W);
    g.destr.pallWall(wallPt(W, hole ? hole.du : 0, 0, 0), wallN(W), W.alongX ? [1, 0, 0] : [0, 0, 1], T, !!hole, W.outer ? 'concrete' : 'drywall', WALLSHOT.on ? WALLSHOT.pall : 1);   // the charge's PALL (destruction.ts CHAOS.pall: nothing with the rule off)
    messWall(g, wallPt(W, hole ? hole.du : 0, 0, 0), wallN(W), T, !!hole);   // …and what it leaves on the floor (floormess.ts CHAOS.mess: nothing with the rule off)
    const it = g.items.spawn('flash', wallPt(W, 0, 0.15, 0.5), [0, 0, 0], { fuse: 99, who: PLAYER_ID }); it.fired = true;
    const all = g.guards, last = g.messages[g.messages.length - 1]; g.guards = []; try { detonateStun(g, it, true); } finally { g.guards = all; }
    const m = g.messages[g.messages.length - 1]; if (m && m !== last && /canister/.test(m.text)) g.messages.pop();   // ('stun canister went off': this was not one)
    const ii = g.items.items.indexOf(it); if (ii >= 0) g.items.items.splice(ii, 1);
    let knocked = 0, stunned = 0, backblast = 0;
    const R = safeRadius(g, W), nearSecs = (d: number) => WALLCHARGE.safe ? lerp(WALLCHARGE.safeSecs[0], WALLCHARGE.safeSecs[1], clamp(d / R.reach, 0, 1)) : K.backblastSecs;   // (the charge's own side: the safety radius — off, the door charge's two numbers)
    const xz = wallPt(W, 0, 0), out = wallPt(W, 0, 0.5, 1.1), inn = wallPt(W, hole ? hole.du : 0, -(T + 0.45), 1.1);
    const SH = WALLSHOT.on ? WALLSHOT : null, room = SH && hole ? roomBeyond(g, W, hole.du, T) : 0;   // (WALLSHOT: the room the hole opens into, 0 = none to name)
    const WK = WALLKILL.on && pressed ? WALLKILL : null, away = (p: Vec3) => v3.normalize([p[0] - xz[0], 0.15, p[2] - xz[2]]); let lost = 0, samDown = false;   // (WALLKILL: ours it killed · the player with them)
    for (const gd of [...g.guards]) {
      if (gd.state === 'dead' || (WK && gd.god)) continue;
      const p = gd.char.pos, far = wallOff(W, p) < -T / 2, dist = flat(p, xz), chest: Vec3 = [p[0], 1.1, p[2]], ours = gd.team === 'operative';
      const lined = dist <= K.stunM && !g.col.solidBlocked(far ? inn : out, chest), inRoom = !!room && far && gd.team !== 'operative' && dist <= SH!.roomM && g.cleared.roomAt(p) === room;
      if ((far && !hole) || (!lined && !inRoom)) continue;   // (a wall that held is still a wall to the men behind it)
      if (!far) {   // too near the charge on its own side (WALLKILL: at it, he is killed)
        if (WK && dist < WK.nearM) { killGuard(g, gd, away(p), false, 'shot', 'player', `${gd.callsign ?? 'a man'} down — at the charge when it went`); if (!ours) knocked++; else if (!g.rails?.isSpared(gd)) lost++; }
        else if (dist < R.reach) { this.dazzle(gd, nearSecs(dist), inn); if (ours) backblast++; else stunned++; }
        continue; }
      if (!lined) { this.shock(gd, SH!.staggerSecs, inn); stunned++; continue; }   // (WALLSHOT: in the room with no line to the hole — the shock, not the flash)
      if (ours && (WK ? dist >= K.knockM : g.orders.big)) { this.dazzle(gd, SH ? SH.oursSecs : K.backblastSecs, inn); backblast++; continue; }   // (one of ours past the wall: the order is refused while he is there — gone in since, he is dazzled, not felled; WALLKILL: inside knockM he is killed as anyone is, and past it he is dazzled as one of ours whatever the team's size)
      if (dist < K.knockM) { killGuard(g, gd, away(p), false, 'struck', 'player', `${gd.callsign ?? 'a man'} down — behind the wall when it went`); if (!(ours && WK)) knocked++; else if (!g.rails?.isSpared(gd)) lost++; }
      else { const ss = SH ? SH.stunSecs : K.stunSecs; this.dazzle(gd, lerp(ss[0], ss[1], clamp(dist / K.stunM, 0, 1)), inn); gd.staggerUntil = Math.max(gd.staggerUntil, g.time + (SH ? SH.staggerSecs : K.staggerSecs)); gd.weapon.burst = null; stunned++; }
    }
    // (WALLKILL: a civilian in the building is a man on the floor too — at the charge, or behind the wall inside knockM, with the same line; the rest of the
    //  blast was never hers and is not now)
    if (WK) for (const cv of [...civiliansShown(g)]) { if (cv.state === 'dead' || cv.god) continue; const p = cv.char.pos, far = wallOff(W, p) < -T / 2, dist = flat(p, xz);
      if ((far && !hole) || dist >= (far ? K.knockM : WK.nearM) || g.col.solidBlocked(far ? inn : out, [p[0], 1.1, p[2]])) continue;
      killGuard(g, cv, away(p), false, far ? 'struck' : 'shot', 'player', `${cv.callsign ?? 'a civilian'} down — ${far ? 'behind the wall' : 'at the charge'} when it went`); knocked++; }
    // (WALLKILL: the player at the charge, or behind the wall it opened inside knockM, with the line a man there needs — killed as a round kills him; the
    //  rocked hands and the blind seconds below are a living man's)
    if (WK && !g.player.down && !g.godMode && !g.puppet && !g.touring) { const pl = g.player, p = pl.char.pos, far = wallOff(W, p) < -T / 2, dist = flat(p, xz);
      if (!(far && !hole) && dist < (far ? K.knockM : WK.nearM) && !g.col.solidBlocked(far ? inn : out, [p[0], 1.1, p[2]])) { hitPlayer(g, away(p)); pl.hitFlash = 1; chronHit(g, 'the wall charge'); samDown = pl.down; } }
    const sam = WALLCHARGE.safe && !g.player.down ? this.blastShare(W, g.player.char.pos, R) : 0; if (sam > 0) this.samCaught(sam, xz);
    // (samstun.ts: the blast does to the player what it does to a teammate standing there — on the charge's own side inside the reach with a line to it, blind the
    //  seconds a teammate there gets; beyond a wall it opened, inside stunM with a line, dazzled and never felled, as one of ours beyond a blown door is)
    if (SAMSTUN.on && !g.player.down && !g.puppet && !g.touring) { const p = g.player.char.pos, far = wallOff(W, p) < -T / 2, dist = flat(p, xz);
      if (!(far && !hole) && dist < (far ? K.stunM : R.reach) && !g.col.solidBlocked(far ? inn : out, [p[0], 1.1, p[2]])) dazzlePlayer(g, far ? (SH ? SH.oursSecs : K.backblastSecs) : nearSecs(dist), inn); }
    this.lastBlow = { reach: R.reach, indoors: R.indoors, sam, lost, samDown };
    if (hole) moraleBlast(g, inn, PLAYER_ID);   // (morale.ts: the men past the wall it opened are shaken by it — a return on its first line with the switch off)
    this.stats.blown++; if (hole) this.stats.holes++; else this.stats.duds++; this.stats.knocked += knocked + lost; this.stats.stunned += stunned; this.stats.backblast += backblast;
    g.msg(`charge blown — the wall${hole ? '' : ' · it held'}${knocked ? ` · ${knocked} down` : ''}${stunned ? ` · ${stunned} stunned` : ''}${lost ? ` · ${lost} of yours down` : ''}${backblast ? ` · ${backblast} of yours too close` : ''}${sam > 0 ? ' · you were too close' : ''}`);
    this.note(`blow wall ${W.index}: ${hole ? `hole ${(hole.half * 2).toFixed(2)} m` : 'no hole'} knocked ${knocked} stunned ${stunned} backblast ${backblast}${WK ? ` lost ${lost}${samDown ? ' · the player down' : ''}` : ''}`);
    for (const op of [...this.ops]) if (sameWall(op.wall, W) && (op.phase === 'place' || op.phase === 'standoff' || op.phase === 'armed')) {   // the squad that set it goes in behind it
      if (!hole) { const up = op.lead.state !== 'dead' ? op.lead : op.men.find(m => m.state !== 'dead'); if (up) g.say(up, 'no way through.'); this.end(op, 'no hole'); continue; }   // (the lead, or — WALLKILL: the charge took him at the wall — whoever of his is left)
      op.hole = hole; op.phase = 'wait'; op.t0 = g.time;
      if (WALLCHARGE.brace) for (const gd of op.men) { if (gd.state === 'dead' || g.orders.of(gd) !== op.mine.get(gd)) continue; if (g.time >= gd.dazzledUntil) gd.char.anim.flinch(); if (!op.mine.get(gd)?.spare) this.standOff(op, gd); }   // (the start at the blast; then round to the wall)
      this.beat(op, `blow · hole ${(hole.half * 2).toFixed(2)} m · ${knocked} down ${stunned} stunned`);
    }
    return { hole: !!hole, knocked, stunned, backblast, lost };
  }
  /** the last charge blown: the reach it had on its own side, whether that side was indoors, and Sam's share of it (0: he was clear, or it killed him) — for the
   *  panel and the checks · WALLKILL: how many of ours it killed, and whether it killed the player */
  lastBlow: { reach: number; indoors: boolean; sam: number; lost: number; samDown: boolean } | null = null;
  /** SAM INSIDE THE REACH WHEN IT WENT (WALLCHARGE.safe; `k`: his share, 1 at the wall): what the game already has for a man rocked by something — he is
   *  knocked along the blast (the animator's hit), the frame flashes as on a hit, no round and no throw leaves his hands for samSecs (Player.fireCd: the beat
   *  every fire site already honours, kept by a checkpoint), and his aim is open by suppression's own scalar until it drains. The camera's kick and the ring
   *  in his ears are blastFeel.ts's, by distance, as ever. Never a hit: Player.hitsLeft is not touched. */
  private samCaught(k: number, from: Vec3) {
    const pl = this.g.player, c = pl.char, K = WALLCHARGE;
    c.anim.hitFrom(v3.sub(c.pos, from)); pl.hitFlash = Math.max(pl.hitFlash, k);
    pl.fireCd = Math.max(pl.fireCd, lerp(K.samSecs[1], K.samSecs[0], k)); pl.sup.v = Math.max(pl.sup.v, lerp(K.samSup, 1, k)); pl.sup.kick = Math.max(pl.sup.kick, k);
  }
  /** the gap a man fits through nearest the charge, read off the wall as it now stands (the sill gone, a man's width or more, floor in its far mouth): its
   *  centre along the wall from the charge and half its width — null: none. ONE GAP, NOT THE WHOLE OPENING: the blast often takes more of a partition than
   *  this (a second run of open wall further along, past a stud or a desk at the far face, is no part of the answer), so 'outside holeAt' does not mean 'wall' */
  holeAt(W: WallSpot): { du: number; half: number } | null {
    const g = this.g, T = thick(W), step = 0.125, R = 2.5; let best: { du: number; half: number } | null = null, run = NaN;
    const open = (du: number) => !g.col.solidBlocked(wallPt(W, du, FACE, 0.35), wallPt(W, du, -(T + FACE), 0.35)) && !g.col.solidBlocked(wallPt(W, du, FACE, 1.3), wallPt(W, du, -(T + FACE), 1.3));
    const through = (du: number) => !g.col.nav.isBlocked(...xz(wallPt(W, du, -(T + WALLCHARGE.mouthIn)))) && !g.col.nav.isBlocked(...xz(wallPt(W, du, 0.35)));
    // (a gap a man's width or more; the way through it is its middle, else — a desk against the far face there — the place nearest its middle with floor both sides and a man's half-width of gap each way)
    const shut = (to: number) => { if (isNaN(run)) return; const a = run - step / 2, b = to - step / 2, mid = (a + b) / 2; run = NaN; if (b - a < 0.7) return;
      for (let k = 0; mid - k >= a + 0.35 - 1e-6; k += step) for (const du of k ? [mid - k, mid + k] : [mid]) if (through(du)) { const h = { du, half: Math.min(du - a, b - du) }; if (!best || Math.abs(h.du) < Math.abs(best.du)) best = h; return; } };
    const b = W.box, c = W.alongX ? b.c[0] : b.c[2], L = W.alongX ? b.h[0] : b.h[2], lo = Math.max(-R, c - L - W.u), hi = Math.min(R, c + L - W.u);   // (the wall's own length: past its end is not a hole in it)
    let du = lo + step / 2; for (; du <= hi + 1e-6; du += step) { if (open(du)) { if (isNaN(run)) run = du; } else shut(du); }
    shut(du);
    return best;
  }
  /** flash-blind (doortools.ts dazzle, to the letter) */
  /** WALLSHOT: the shock with no flash — folded `secs` (rooted, gun down, no round) with his eyes his own, and he knows where it came from (what the frag's
   *  wound and the dazzle beside this do to a man's reaction, awareness and path) */
  private shock(gd: Guard, secs: number, at: Vec3) {
    const g = this.g;
    gd.staggerUntil = Math.max(gd.staggerUntil, g.time + secs); gd.reactT = Math.max(gd.reactT, secs); gd.weapon.burst = null;
    gd.awareness = Math.max(gd.awareness, 0.6); if (gd.state !== 'alert') gd.lastKnown = v3.copy(at);
    gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.char.anim.hit();
  }
  private dazzle(gd: Guard, secs: number, at: Vec3) {
    const g = this.g;
    gd.dazzledUntil = Math.max(gd.dazzledUntil, g.time + secs); gd.reactT = Math.max(gd.reactT, secs);
    gd.awareness = Math.max(gd.awareness, 0.6); if (gd.state !== 'alert') gd.lastKnown = v3.copy(at);
    if (g.aiEnabled) gd.witness.dazzled++;
    gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.char.anim.hit();
  }
  /** the charge on the wall: the door charge's dark slab and lit tell, chest high on the face it was set from (one-frame boxes) */
  private draw(c: SetWallCharge) {
    const W = c.wall, p = wallPt(W, 0, 0.022, WALLCHARGE.height), yaw = W.alongX ? 0 : Math.PI / 2, n = wallPt(W, 0, 1), o = wallPt(W, 0, 0);
    this.g.fx.push({ box: makeBox({ c: p, h: [0.07, 0.11, 0.02], yaw, albedo: [0.09, 0.1, 0.08], flags: BoxFlag.Dynamic }), ttl: 1e-3 });
    this.g.fx.push({ box: makeBox({ c: [p[0] + (n[0] - o[0]) * 0.022, p[1] + 0.07, p[2] + (n[2] - o[2]) * 0.022], h: [0.012, 0.012, 0.004], yaw, albedo: [0.9, 0.12, 0.08], emissive: [2.2, 0.2, 0.1], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: 1e-3 });
  }

  // ------------------------------------------------------------ Sam's own hands
  /** ownblow.ts: IS THIS SET CHARGE THE SQUAD'S KEY'S to blow — every one with the switch off; with it on, one the squad set, or his own while an order of
   *  theirs is on that wall. The key's press, the notes and the floor plan ask */
  keyIs(c: SetWallCharge): boolean { return !OWNBLOW.on || c.by !== SAM_BY || this.ops.some(o => sameWall(o.wall, c.wall)); }
  /** ownblow.ts: the nearest charge his own hands set — the one his own row 'blow the charge' is for (null: none); where it is; who stands inside its
   *  radius, in words (the row's line, asked every frame: the far side's rays are the menu's and the note's); is HE in its blast, either side (asked at a tap) */
  samSet(): SetWallCharge | null { return this.seated ? this.nearest(c => c.by === SAM_BY) : null; }
  samAt(c: SetWallCharge): Vec3 { return wallPt(c.wall, 0, 0, WALLCHARGE.height); }
  samWords(c: SetWallCharge): string { return this.closeWords(c); }
  samNear(c: SetWallCharge): boolean { return this.tooClose(c).includes('you') || this.behind(c).includes('you') || (WALLKILL.on && flat(this.g.player.char.pos, wallPt(c.wall, 0, 0)) < WALLKILL.nearM); }
  /** player.ts buildInteractables: with the cursor on a partition and Sam at its foot, the marker and its row */
  samRows(p: Vec3, busy: boolean, row: RowFn, offer: OfferFn) {
    this.offered = null; this.marker = null; if (!wallChargeOn(this.g) || !this.seated) return; const g = this.g, pl = g.player, K = WALLCHARGE, F = DOORTOOLS.blowKey.replace('Key', ''), key = blowKeyWord(!OWNBLOW.on, F);   // (ownblow.ts: what his own hands set is his own actions' to blow)
    const W = this.sam?.wall ?? (() => { const w = wallAt(g, g.aimPoint, p); return w ? this.settle(w) : null; })(); if (!W || !W.ok) return;   // (structure: nothing to offer — the squad's menu says why)
    const c = this.chargeOn(W), foot = wallPt(W, 0, K.setOff), d = flat(p, foot); if (d > K.samMarkerM || (!c && !this.sam && this.openAt(W))) return;
    if (!c && !this.sam && !this.affordable) return;   // (none left in the bag: a partition is not a thing to do anything with — no marker, no row; the squad's menu says 'no charges left.')
    const near = d < K.samReach && wallOff(W, p) > 0 && !g.col.solidBlocked([p[0], 0.9, p[2]], wallPt(W, 0, 0.1, 0.9)), free = !pl.sprinting && !pl.dragging && !pl.holding && !pl.takedown, reach = near && free;
    const it: Interactable = { kind: 'wall', pos: wallPt(W, 0, 0.05, K.height), line1: c ? 'wall · charge set' : W.outer ? 'wall · outer wall' : 'wall · partition', line2: reach ? '' : near ? 'hands full' : 'step closer', inReach: reach, off: false };
    if (this.sam) { it.inReach = true; this.marker = it; offer(it, []); return; }   // (the running row is runningRow's)
    if (c) { it.line2 = `${blowKeyWord(this.keyIs(c), F)}  blow the charge${this.closeWords(c)}`; offer(it, []); return; }
    const verbs: Interactable[] = [];
    if (reach && this.ops.some(o => o.phase === 'place' && sameWall(o.wall, W))) it.line2 = 'a charge is going on it';
    else if (reach && !busy) { verbs.push(row(it, 'charge', this.rowWords(), `${key}  blows it once set`)); this.offered = W; }
    offer(it, verbs);
  }
  /** the row performed (Game.act) starts it; he stands on it setSecs; a step, a sprint, full hands or another verb breaks it off with nothing spent */
  private samTick() {
    const g = this.g, pl = g.player, p = pl.char.pos, K = WALLCHARGE, act = g.act, mine = !!act && act.kind === 'wall' && act.verb === 'charge';
    if (mine && !this.sam && this.offered) { this.sam = { wall: this.offered, t0: g.time, at: [p[0], 0, p[2]] }; this.note(`the player sets one on wall ${this.offered.index}`); return; }
    const s = this.sam; if (!s) return;
    if (pl.down || pl.sprinting || !!pl.dragging || !!pl.holding || !!pl.takedown || flat(p, s.at) > K.samShift || (act && !mine)) { this.cancel(); return; }
    chargeHands(g, pl.char, wallPt(s.wall, 0, 0, K.height), wallN(s.wall), g.time - s.t0, DOORTOOLS.setSecs, pl.pistolUp ? 0 : undefined);   // (handwork.ts: his hands on it while it goes on)
    if (g.time - s.t0 < DOORTOOLS.setSecs) return;
    this.sam = null;
    if (this.openAt(s.wall) || this.chargeOn(s.wall)) return;
    const paid = this.take(); if (paid < 0) { g.msg(this.noneWords().replace(/\.$/, '')); return; }
    this.set.push({ wall: s.wall, t: g.time, by: SAM_BY, paid, ...(this.freeSet ? { free: true } : {}) }); this.stats.bySam++; g.audio.play('lockPick', wallPt(s.wall, 0, 0, K.height), 0.6); g.destr.furn.warm();
    g.msg(`charge set on the wall${blowTail(!OWNBLOW.on, DOORTOOLS.blowKey.replace('Key', ''), ' — ')}`); this.note(`set by the player on wall ${s.wall.index}`);
  }
  /** is Sam setting one right now — a sustained verb (interact.ts runningVerb / cancelSustained, savestate.ts playerBusy, player.ts's running row) */
  get setting(): boolean { return !!this.sam; }
  /** the charge Sam is setting by hand, for whoever stands him at it (handwork.ts): its place on the wall, the wall's normal on his side, and the spot he must not shift from (theirs to move with him) */
  get samJob(): { p: Vec3; n: Vec3; at: Vec3 } | null { const s = this.sam; return s ? { p: wallPt(s.wall, 0, 0, WALLCHARGE.height), n: wallN(s.wall), at: s.at } : null; }
  /** Space again, Esc or a step into it: broken off, nothing spent (true: there was one to break off) */
  cancel(): boolean { if (!this.sam) return false; this.sam = null; this.g.msg('charge not set'); return true; }
  /** player.ts buildInteractables: the one row while he is at it */
  runningRow(running: (base: Interactable, verb: Verb, text: string, progress: number) => Interactable): Interactable {
    const s = this.sam!, it: Interactable = this.marker ?? { kind: 'wall', pos: wallPt(s.wall, 0, 0.05, WALLCHARGE.height), line1: s.wall.outer ? 'wall · outer wall' : 'wall · partition', line2: '', inReach: true, off: false };
    return running(it, 'charge', 'setting the charge… — Space or a step breaks it off', (this.g.time - s.t0) / DOORTOOLS.setSecs);
  }
  private marker: Interactable | null = null;
}
const xz = (p: Vec3): [number, number] => [p[0], p[2]];
