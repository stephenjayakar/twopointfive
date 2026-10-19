// UNASKED COVER (Game.cover, __game.cover): what the teammates watch while they FOLLOW Sam or HOLD with nothing ordered to look at — the maintainer, 10-04, playing ?squad4:
// "as we're progressing through a room, the AI should handle watching all the breaches automatically". The pair and the four alike, in every scenario where an
// operative unit falls in (the room clear, the four, the rescue, the night breach): nothing here knows which one is up.
//
//   AN OPENING     a way a man could come at the squad. Found ONCE per level off what the level already is — no authored marks, so a new level file has them
//                  for nothing: every DOOR (open or shut, at its frame), and every GAP in the nav grid — a run of free floor at most COVER.gapCells wide between
//                  two blocked cells (a doorway with no leaf, the slot between two partitions, a narrow aisle). Short gaps (a hole in a wall) are one opening;
//                  a longer passage has a MOUTH at each end; a blind one deeper than COVER.alcoveRows has one. Plus, while men follow, THE REAR: the way they
//                  came, COVER.rearM back along Sam's own trail past the last man (orders.ts trailBack).
//   LIVE           an opening is somebody's to watch only while it is within COVER.reach of a free man who has a line to it (the collision's own sight test:
//                  glass passes, a wall does not) AND a clear lane (none of the squad within COVER.lane of the line from him to it — a man does not cover
//                  through a mate's back: orders.ts and guards.ts would bring his muzzle down and he would cover nothing), with nobody of the squad standing in
//                  it or either side of it (the file is going through it). A passage looked into from outside is ONE opening, its nearer mouth; with one of
//                  ours inside it, its two mouths are his front and his back. A shut door is as live as an open way.
//   THE DEAL       a few times a second: every live opening weighed (the nearer to the squad the heavier; a shut door a little less than an open one; one Sam's
//                  own gun is on, or a man Sam posted already has, counts for little — "the player's own facing counts as covered"), and the free men dealt one
//                  each so that the heaviest are taken first and NO TWO MEN TAKE THE SAME ONE (every dealing tried: there are four men). Who takes which: the man
//                  who has to turn least and is nearest; a man keeps a NEW one COVER.keepSecs whatever else comes up, and after that unless a re-deal is clearly better
//                  (COVER.sticky); a man with nothing takes the least thing going rather than nothing. With three or more in
//                  the file the LAST man's is the rear whatever else is open; with fewer the rear is weighed with the rest (two men: nearest and most dangerous
//                  first). On the move, what has fallen BEHIND a man who is not the last counts for little to him (COVER.behindK): it is the last
//                  man's before it is his. Re-dealt as the squad moves: an opening passed or walked through drops out, the next one comes in.
//   THE MAN        keeps the feet his order gives him (his place in the file, his spot on a hold) — only his gun, his light and his eyes go: stopped, he squares
//                  up to his opening with the gun on it; walking, the gun is on it over his shoulder while it is within a twist of the way he goes (COVER.twist),
//                  and past that — the rear, an opening the file has just come by — he walks backwards or sideways with it in front of him at a walk
//                  (COVER.backIn / backOut) and turns to run when Sam does (a man whose order has him running is dealt nothing behind him). The gun TRAVELS to a
//                  new opening, round his front (COVER.swing). What he then SEES is what his eyes see (guards.ts canSeeChar off his own chest and
//                  head): a man stepping out of a covered opening is in his cone, in his light, and on the line his gun is already held on (roomfight.ts: no
//                  surprise beat, the pre-aim).
//   SPARE EYES     two more men are dealt to, on their marks: a STACK's last man (COVER.stacked — orders.ts spareRear: the door is the others', his is the
//                  way a man could come at their backs) and the men an ENTRY has left holding a room (COVER.inRoom — doortools.ts: the room's other doors,
//                  not the wall across the floor they have just searched). Assignment.spare says so; with nothing dealt the order's own watch stands
//                  (not at once — REAR below: a gun the deal has just let go of stays on its opening three quarters of a second first).
//   AN ORDER WINS  only men under 'fall in', or under a 'hold' that names nothing to watch, are dealt to. Any other order of Sam's, a drill that owns the man
//                  (F), the rescue's flow sending him to a mark, the fight AI having him: he is not free and his job goes that deal — and he is dealt to again
//                  when he is handed back ('fall in'), with no word from Sam.
//
// The seam is in orders.ts tick() (poseFor: the watch point, the facing, whether he back-pedals) and one line in its hud() (the squad block says what each man is
// on: 'Red One · with you · on the server door'; statusOf itself is the base's). Off (COVER.on false, ?nocover): tick() returns on its first line, poseFor
// answers null and the men are the base's, frame for frame.
//   A STEP TO SEE  the one place the cover moves a man's FEET (COVER.step): stood still, dealt an open door he has no line through (its leaf is between him and
//                  the doorway) or nothing with such a door near him, he takes a step or two to where he sees through it, never into an opening, and the
//                  doorway is then his (stepDeal / stepSpot; orders.ts walks him).
// NOT DONE: nobody steps off his place to get a LANE, or a line to anything but an open door (a man in the middle of a straight file can be boxed in by the men
// ahead and behind and take nothing — `live` says what went uncovered), a room known clear does not lower its doors' weight, the men's lights stay as their order has them (dark under
// 'fall in' in the room clear), nobody calls what he takes aloud (the rescue flow's own men still do).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3, wrapAngle, damp } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import { doorWords, type Assignment } from './orders';
import { WORDS } from './words';
import { watchedPlace } from './dialogue';
import { DOORMANNERS } from './doorway';
import { rearPinOf, rearSees, roomKept } from './rearwatch';
import { gunLane } from './gunroles';   // (called inside tick only)
import { watchablesAt, type Watchable } from './roomfit';

/** The knobs (__game.cover.knobs). */
export const COVER = {
  /** off = nothing here runs: followers and holders look where the order alone has them look */
  on: true,
  /** a STACK's last man (the last two of four) is dealt an opening too — the way a man could come at the stack while it walks up and waits, the others' guns
   *  on the door (orders.ts spareRear; off: every man of a stack faces the door) · the men an ENTRY has left holding a room are dealt its openings (off: each
   *  stays on the sector his point of domination gave him, across the room he has just searched). REAR SECURITY SHIPS ON, ROOM COVER OFF: over 24 seeds of six
   *  scenarios (tools/qa/playthrough.ts; the numbers are in rebuild/polish/log.md) the rear man halves the men shot from outside their arc and takes the
   *  rescues from 40 of 48 to 46 for a few rooms fewer of 96; turning the men in a taken room to its doors gained nothing and cost rooms */
  stacked: true, inRoom: false,
  /** THE REAR MAN AT A MARK WITH NO DOOR READS THE GROUND (a wall charge's stand-off, the mate covering a man at work): off, his rear is 'the way he
   *  came' — at a stand-off that is the spot he stood on when the order was given, two or three metres off, so both rear guns rested on bare ground or a
   *  yard wall (the maintainer, floodlit: "weird that these guys are covering a wall") and nobody had the open gate or the run along the building. On,
   *  once he is within `rearReadIn` of his mark he takes the heaviest thing roomfit.ts's read (`watchablesAt`, out to `rearReadM`) says a man there could
   *  watch — a way in, a long run of floor — that he has a line to with no mate in it, and that the other rear man has not got (the same thing, or one
   *  within `rearReadDeg` of his bearing); looked at again every `rearReadSecs`, changed only for something `rearReadSticky` × heavier; the gun is put at
   *  most `rearLook` m out along it. Nothing there to watch = the old rule. Off in the module (the frozen stand); on in the page. */
  rearRead: false, rearReadIn: 1.0, rearReadM: 14, rearReadDeg: 35, rearReadSecs: 1.0, rearReadSticky: 1.3, rearLook: 6,
  /** the rear man takes the rear only inside this many metres of his mark: further out on the walk to the stack he keeps up with the file, gun forward —
   *  or on a door standing open by his way (doorway.ts DOORMANNERS.watch: `walkOnly / walkDoor` below) — (a
   *  large number = the rear is his the whole walk: he came the whole way backwards, metres behind his mate, and the pair reached the door apart). 5, not
   *  the 3 it first shipped at: over 72 seeded runs the last three metres alone left 98 teammates of 192 standing where 5 m leaves 119, 8 m 121 and the
   *  whole walk 119 — the men who come at a stack come while it is still forming. At 8 the stack forms a second and three quarters later than at 3, and
   *  two pairs going on one word lost two men on a seed (pairs-go) */
  rearWalkM: 5,
  /** a door standing OPEN is a man's to watch only if he can see INTO its doorway: from the side its leaf has swung to, the leaf is between him and whoever
   *  steps through (off = as it was: a line to short of the frame was enough, and a man was dealt a doorway he was looking at the back of the door of) */
  leaf: true,
  /** … and where the leaf does hide the doorway from him, the leaf's FREE EDGE is his to watch instead, if he has a line to it: whoever comes through that door
   *  comes into his view there — but only when he has nothing else to watch, and the doorway stays live for a man with a line into it: a man standing IN the
   *  doorway is hidden from the edge's watcher (false: he watches nothing, as it was) */
  edge: true,
  /** an opening further than this from a man is not his; the deal is redone this often (game seconds) */
  reach: 9, dealSecs: 0.25,
  /** a free run of nav cells (half a metre each) this wide or less between two blocked cells is a gap · a passage up to this many cells long is ONE opening,
   *  longer has a mouth at each end · a blind passage this deep or deeper has a mouth worth a gun · a passage runs on past this many rows where it widens */
  gapCells: 3, throughRows: 3, alcoveRows: 3, bridge: 3,
  /** the squad's own men this near an opening are IN it (it is being walked through, not watched) */
  inM: 0.9,
  /** one of the squad's own within this of the line from a man to an opening: it is not his to take (m; `laneKeep` for the one he already has — taken clear
   *  of where orders.ts's own muzzle lane lets a gun back up, laneOut 0.7, and kept clear of where it brings one down, laneIn 0.45) · a man STOOD on his opening
   *  keeps it this long with a mate crossing his line (s: his muzzle dips and comes back; he does not turn away and back) */
  lane: 0.7, laneKeep: 0.5, laneSecs: 0.6,
  /** a WALKING man keeps his opening through a mate crossing his line for `laneSecs` too (false = only a man stood still did: in a file on the move every
   *  crossing dropped the job and the next deal handed it back, the gun going to and fro) */
  laneWalk: true,
  /** Sam's gun within this of an opening he has a line to: his · what such an opening, and one a posted man has, still weighs (a spare man doubles up on it) */
  samDeg: 35, samK: 0.2, heldK: 0.1,
  /** the weights: a shut door against an open way · the rear · how fast nearness tells (m) */
  shutK: 0.7, rearK: 0.8, nearM: 3,
  /** a man who had a living enemy in sight this recently is the contact's, not an opening's (s) */
  contactSecs: 4,
  /** the rear: this far back along the trail past the last man · the file this long gives its last man the rear outright */
  rearM: 4, rearFrom: 3, rearDeg: 60,
  /** what a man already on an opening has over a rival for it · he KEEPS a new one this long whatever else comes up, while it stays live and his to take (s) ·
   *  the last man keeps the rear thing he has unless another behind him is this much heavier */
  sticky: 1.2, keepSecs: 1.5, rearKeep: 1.25,
  /** on the move, an opening behind a man who is not the file's last weighs this much of itself to him */
  behindK: 0.2,
  /** walking: the gun goes over his shoulder to an opening within this of the way he goes (rad); past it he walks backwards / sideways while his pace is under
   *  backIn (m/s; he turns and runs over backOut): set over a walking Sam's file closing a gap, under a running Sam's — the men cover while Sam walks and run
   *  when he runs. (Entering the back-pedal mid-rush, backIn 2.3‥2.6, is what tipped orders-edges' lean-out check: see cover.md) */
  twist: 1.45, backIn: 3.0, backOut: 3.4,
  /** a man ALREADY walking backwards on his opening does not turn to walk forward while his body still faces away from the way he is going (its cosine
   *  to that way under `backBody`: 0 = more than a quarter turn off it). The frame he walks forward he walks along his BODY (the path follower's rule while a man turns), so with his body to the rear he
   *  went backwards, which read as 'going the other way' and put him back in the back-pedal — and that read as going forward again: a change of mind every
   *  frame, the two turns cancelling, two seconds on the spot beside a door. He keeps back-pedalling the fraction of a second his body takes to come round to
   *  his opening (which is within `twist` of his way, so inside that), then walks forward. Off = as it was. KEEP `backBody` UNDER cos(twist) (0.12 at twist 1.45) OR THE HOLD NEED
   *  NOT END: a body squared to an opening that far round from his way would still read as facing away. (At −0.3 the walk is the same but for the
   *  moment he lets go; a number, no Tab row.) */
  backKeep: true, backBody: 0,
  /** …and a man walking backwards whose opening the deal LETS GO OF (nobody of ours has taken him, nothing else re-poses him) comes out of it on his feet: the
   *  order's own pose is 'walk forward', which a man walks along his BODY — still turned to the rear, so he went a quarter of a metre back the way he came and
   *  hooked round, three quarters of a second gone, every time (48 times on the registry level's walk with four behind Sam). His feet keep the path he is on
   *  (the runner's strafe) while his body comes round to the way he goes, his gun in front of it: until it is within `backTurnBody` (a cosine: 0.7 = an eighth
   *  of a turn) of that way, or `backTurnSecs` are up; stood, run on or dealt a new opening he is that rule's again (a new job meets him as a man walking
   *  backwards, so backKeep holds him the same way). Off = as it was. (The man run on over backOut still turns as he did: a number, no row.) */
  backTurn: false, backTurnBody: 0.7, backTurnSecs: 1,
  /** how fast the muzzle travels to a newly dealt opening (1/s: it travels, it does not snap) */
  swing: 9,
  /** STEP TO SEE: a door standing open by the squad that NOBODY has a line into (every free man is behind its leaf or off its line; the leaf's edge is the
   *  best the deal can hand out) gets one man: stood still, with nothing or only that edge to watch — else on something that weighs less than the door — he
   *  takes the step or two to a spot he does see through it from, and is then dealt the doorway itself. His FEET are the order's everywhere else in this
   *  file; here alone the cover moves them: a follower only while Sam stands (he falls back in when Sam walks), a plain holder by walking to the spot
   *  while his mark stays where the order put it (orders.ts asks stepOf; the next order takes him off it). Never into an opening: the spot is on his own side of that door, `stepOffM` clear of every opening's width, off a mate's lane,
   *  reached in a straight walk that crosses none. (off = he stands where his order put him, with the leaf's edge or something further off: as it was)
   *  · no further than `stepM` from the place his order gave him, however many steps · only once he has stood `stepAfter` s · a door further than `stepReach`
   *  from him is not his to step for · a step not made in `stepSecs` is given up where he stands
   *  · a FOLLOWER steps only from his place: stood within `stepPlaceM` of where 'fall in' has him (0 = from wherever he stands still, as it was — a man stopped
   *  metres short of his place was dealt a step there and kept it for as long as Sam stood)
   *  MEASURED (10-06; rebuild/away-build/polish-items/open-door.md): `probes.ts cover-step` — a pair behind the leaf of every office door that can stand open:
   *  off, 0 of 8 see through and nobody moves; on, 7 of 8 are dealt the doorway, median 2.8 s after the order. The scripted play-throughs hardly meet it (their
   *  commander does not stand by open doors: 3 steps begun in 168 runs) and are the same within a run or two — 106 of 168 won either way, 263 / 264 of 432 up —
   *  so they show no harm, not a gain. Every number on this line is a first guess that passed the probe. */
  step: true, stepM: 1.8, stepAfter: 0.8, stepOffM: 0.7, stepReach: 6, stepSecs: 5, stepPlaceM: 0.6,
};

/** ONE JOB AT A TIME (the knobs: Team feel ▸ 'rear ▸ …'). The deal is redone four times a second and an opening is 'live' for a man only while a dozen things
 *  hold that frame (a line to it, nobody of ours in it, the file not going through it, nobody better placed) — so a job was handed out, taken back a quarter
 *  of a second later and another handed out the deal after. Between the two the man's gun went back to what his ORDER has him watch: for a stack's rear man the
 *  door, for a follower the way the file is going. Rear, door, rear, door: the play-through watcher's 'twitch' (four reversals in 2 s).
 *  `settle`: a gun the deal has let go of STAYS on its opening for `secs` before the order's own watch has it back, the man carrying himself for it as he was
 *  (squared up to it stood, over his shoulder or still backing on the walk); a job dealt inside that takes the gun straight from the one opening to the other.
 *  The deal itself is not touched — who is dealt what, and when, is as it was (a first cut that kept the JOB a while cost the deal its freedom to re-deal).
 *  It ends at once when anything else has him (an order that leaves him no spare eyes, the entry, a fight, a contact: free() says so), when Sam or a mate is
 *  in the line of the gun or stood in the opening, when he is told to run with it behind him. settle false = the cover as it was, frame for frame
 *  (threshold-identity pins it off). `file`: the same for a follower / a holder, not a stack's rear men only — SHIPS OFF: it takes most of the file's own
 *  twitches too, but depot-four loses teammates with it on every seed set tried.
 *  Measured (tools/qa/playthrough.ts, the two four-man scenarios × 72 seeds, off → on): a stack's rear men's twitches 151 → 8, all twitches 397 → 214,
 *  won 113 → 116 of 144, teammates up 365 → 376 of 576 (inside the scatter). With `file` on as well: 10, 149, 117 and 335 (depot-four 207 → 180 of 288). */
export const REAR = { settle: true, secs: 0.75, file: false };

export type OpeningKind = 'door' | 'gap' | 'mouth' | 'rear';
/** One opening. `at`: its middle, chest high (a door: its frame's centre) · `n`: the unit line THROUGH it in plan (which way is beyond depends on who asks) ·
 *  `half`: half its width · `door`: its leaf, when it has one · `pass` / `far`: a mouth of a passage with two — the passage's name and its other mouth. */
export interface Opening { id: string; kind: OpeningKind; at: Vec3; n: [number, number]; half: number; door: Door | null; pass: string | null; far: Vec3 | null }
/** What a man was dealt: the opening, the point his gun is on (this object is his script's aimAt), the bearing and range that point is held at from him (THEY
 *  ease onto the opening: the muzzle sweeps round him, it never cuts through him), since when, whether he is walking backwards on it,
 *  when his lane to it was last clear, `off`: his order has him running with it behind him — he is not on it this frame (the next deal takes it off him), and
 *  the pose his order had for him (put back when an order or a drill takes him without re-posing him). */
export interface CoverJob { o: Opening; to: Vec3; aim: Vec3; yaw: number; r: number; t0: number; aimT: number; back: boolean; laneT: number; off: boolean; pace: number; A: Assignment }
/** A step to see through an open door (COVER.step): `q` where he is going / stands · `from` the place his order gave him (every step of his is within COVER.stepM
 *  of it) · `o` the door · `A` the order it was taken under (another order: it is void) · `t` when it was begun (done: when he got there, or gave it up) · `saw`: he has since
 *  been dealt that doorway itself */
export interface CoverStep { q: Vec3; from: Vec3; o: Opening; A: Assignment; t: number; done: boolean; saw: boolean }
/** One live opening as the last deal saw it: its weight, the free men with a line to it, who has it, and whether Sam's own gun / a posted man was on it. */
export interface LiveOpening { o: Opening; w: number; can: Guard[]; edge: Guard[]; at: Map<Guard, Vec3>; by: Guard | null; edgeBy: Guard | null; sam: boolean; held: boolean }

const EYE = 1.55, CHEST = 1.1;
const flat = v3.distXZ, yawTo = v3.yawTo;
const COMPASS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];   // yaw 0 = +z = south (orders.ts)

/** The gaps of a nav grid (pure: the grid's blocked cells and its cell size in, openings out — tools/qa/cover-probes.ts draws them). `alongX`: the runs are laid
 *  along x and the passages they stack into run along z; the caller asks both ways. A passage is not ended by a row or two where it WIDENS (COVER.bridge: a side
 *  doorway off a corridor is its own opening, found the other way round — the corridor is still one passage past it). `solid(a, b)`: is the line a → b shut to
 *  SIGHT (the collision's own test) — with it, a run counts only between two things a man cannot be seen over: the slot between a desk and a table is no opening. */
export function gapsOf(nav: { W: number; H: number; cell: number; blocked: Uint8Array }, alongX: boolean, K = COVER, solid?: (a: Vec3, b: Vec3) => boolean): Opening[] {
  const W = alongX ? nav.W : nav.H, H = alongX ? nav.H : nav.W, c = nav.cell;
  const blk = (u: number, v: number) => u < 0 || v < 0 || u >= W || v >= H || nav.blocked[alongX ? v * nav.W + u : u * nav.W + v] === 1;
  interface Run { a: number; b: number; v: number }
  const chains: Run[][] = [];
  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W;) {
      if (blk(u, v)) { u++; continue; }
      const a = u; while (u < W && !blk(u, v)) u++; const b = u - 1;
      if (b - a + 1 > K.gapCells || a === 0 || b === W - 1) continue;   // (a run that reaches the grid's edge is open ground, not a gap)
      const link = chains.find(ch => { const l = ch[ch.length - 1]; if (l.v >= v || l.v < v - 1 - K.bridge || l.a > b || l.b < a) return false;
        for (let w = l.v + 1; w < v; w++) for (let x = Math.max(a, l.a); x <= Math.min(b, l.b); x++) if (blk(x, w)) return false;   // (bridged rows: wider there, not walled)
        return true; });
      if (link) link.push({ a, b, v }); else chains.push([{ a, b, v }]);
    }
  }
  const out: Opening[] = [];
  const pt = (u: number, v: number): Vec3 => alongX ? [u, CHEST, v] : [v, CHEST, u];
  const at = (r: Run): Vec3 => pt((r.a + r.b + 1) * 0.5 * c, (r.v + 0.5) * c);
  const open = (r: Run, v: number) => { for (let u = r.a; u <= r.b; u++) if (!blk(u, v)) return true; return false; };
  // (a wall can stand anywhere across the cells it blocks: the line is tried down the middle of the run's row and along both its edges, each side on its own)
  const side = (ch: Run[], lo: boolean) => !solid || ch.some(r => [0.5, 0.02, 0.98].some(k => { const v = (r.v + k) * c, u = (r.a + r.b + 1) * 0.5 * c;
    return solid(pt(u, v), pt(lo ? (r.a - 0.5) * c - 0.45 : (r.b + 1.5) * c + 0.45, v)); }));
  const n: [number, number] = alongX ? [0, 1] : [1, 0];
  chains.forEach((ch, ci) => {
    const first = ch[0], last = ch[ch.length - 1], L = last.v - first.v + 1;
    const lo = open(first, first.v - 1), hi = open(last, last.v + 1);
    if (!side(ch, true) || !side(ch, false)) return;
    const mk = (kind: OpeningKind, r: Run, other: Run | null): Opening => { const p = at(r);
      return { id: `${kind}@${p[0].toFixed(2)},${p[2].toFixed(2)}`, kind, at: p, n, half: (r.b - r.a + 1) * c * 0.5 + 0.34, door: null, pass: other ? `${alongX ? 'z' : 'x'}${ci}` : null, far: other ? at(other) : null }; };
    if (lo && hi) {
      if (L <= K.throughRows) out.push(mk('gap', ch[ch.length >> 1], null));
      else { out.push(mk('mouth', first, last)); out.push(mk('mouth', last, first)); }
    } else if ((lo || hi) && L >= K.alcoveRows) out.push(mk('mouth', lo ? first : last, null));
  });
  return out;
}

export class Cover {
  readonly knobs = COVER;
  /** every opening of the level (built on the first tick; rebuilt when the level's nav grid is another object) */
  openings: Opening[] = [];
  /** who is on what */
  jobs = new Map<Guard, CoverJob>();
  /** the last deal's picture: every live opening, heaviest first */
  live: LiveOpening[] = [];
  /** the free men of the last deal, in file order (the holders after) */
  men: Guard[] = [];
  /** … `blind`: man-deals (one a man a deal, COVER.dealSecs apart) spent dealt an open door he has no line through — the leaf's edge · `unseen`: door-deals an
   *  open door within COVER.stepReach of a free man had NOBODY with a line into it (not Sam's gun, not a posted man's) · `steps`: steps begun · `stepped`:
   *  made · `stepSaw`: … and the doorway itself then dealt him */
  stats = { deals: 0, takes: 0, swaps: 0, rear: 0, uncovered: 0, kept: 0, blind: 0, unseen: 0, steps: 0, stepped: 0, stepSaw: 0, rearRead: 0, turned: 0 };
  /** who has stepped (or is stepping) to see through which open door */
  steps = new Map<Guard, CoverStep>();
  /** since when each man has stood · no step for him before · no step tried for this door before (game seconds: all three go with a restart — reset()) */
  private stood = new SideMap<Guard, number>(); private noStep = new SideMap<Guard, number>(); private doorTry = new SideMap<Opening, number>();
  /** every change of hands: when, who, onto what (null: let go) — the probes' record (the newest 400) */
  log: { t: number; who: string; id: string | null }[] = [];
  private nav: object | null = null; private dealAt = 0;
  /** the way each man is going (baulked to a stop by the man ahead: the way he WAS going) */
  private heading = new SideMap<Guard, number>();
  private rear: Opening = { id: 'rear', kind: 'rear', at: [0, CHEST, 0], n: [0, 1], half: 1, door: null, pass: null, far: null };
  /** … and one per man whose eyes are spare on a mark (a stack's last man): the way HE came to it */
  private rears = new Map<Guard, Opening>();
  /** COVER.rearRead: what each such man's read last gave him (per order: a new Assignment reads afresh), when, and where he stood */
  private reads = new SideMap<Assignment, { t: number; at: Vec3; pick: Watchable | null }>();
  /** REAR.settle: the job the deal last took off each man, and when — his gun stays on it REAR.secs (poseFor) unless something else has him first */
  private kept = new Map<Guard, { J: CoverJob; t: number }>();
  /** COVER.backTurn: the men coming out of a back-pedal the deal let go of — the gun point carried in front of the body, when it began and the last frame it posed him */
  private outs = new Map<Guard, { J: CoverJob; aim: Vec3; t0: number; t: number; on: boolean }>();
  constructor(private g: Game) { }

  /** nothing dealt, nothing known (a restart: Game.resetGuards) */
  reset() { this.jobs.clear(); this.steps.clear(); this.stood = new SideMap(); this.noStep = new SideMap(); this.doorTry = new SideMap(); this.rears.clear(); this.reads = new SideMap(); this.kept.clear(); this.outs.clear(); this.live = []; this.men = []; this.dealAt = 0; for (const k of Object.keys(this.stats) as (keyof Cover['stats'])[]) this.stats[k] = 0; this.log.length = 0; }
  of(gd: Guard): CoverJob | null { return this.jobs.get(gd) ?? null; }
  /** the opening his gun has been left on (REAR.settle), if it is */
  keptJob(gd: Guard): CoverJob | null { return this.kept.get(gd)?.J ?? null; }

  /** the level's openings, built if they are not yet (entrypoints.ts asks before anybody has fallen in: the list is the statics' alone, the same whenever it is made) */
  ready(): Opening[] { if (this.nav !== this.g.col.nav) this.build(); return this.openings; }
  /** the level's openings: its doors, and the gaps of its nav grid that are not a door's own doorway */
  build() {
    const g = this.g, nav = g.col.nav; this.nav = nav;
    const doors: Opening[] = g.doors.list.map(d => { const th = d.def.closedDir, fc = d.frameCentre;
      return { id: `door:${d.def.name}`, kind: 'door' as const, at: [fc[0], CHEST, fc[2]] as Vec3, n: [-Math.sin(th), Math.cos(th)] as [number, number], half: d.def.width * 0.5, door: d, pass: null, far: null }; });
    const gaps: Opening[] = [];
    const solid = (a: Vec3, b: Vec3) => g.col.segmentBlocked(a, b);
    // (the STATICS' sight alone decides what a gap is: with the leaves in, a door standing open beside a slot the first time anybody fell in would make an opening
    //  of it for the rest of the level)
    const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = [];
    try {
      for (const o of [...gapsOf(nav, true, COVER, solid), ...gapsOf(nav, false, COVER, solid)]) {
        if (doors.some(d => flat(d.at, o.at) < 1.0) || gaps.some(x => flat(x.at, o.at) < 0.6)) continue;   // (a door's own doorway · the same hole found both ways)
        gaps.push(o);
      }
    } finally { g.col.dynamicBoxes = leaves; }
    this.openings = [...doors, ...gaps];
  }

  /** is this man free to be dealt an opening: alive, under 'fall in' or a 'hold' that names nothing to watch, on his order's own script (not the fight AI's),
   *  not in a fight, not blind */
  /** his order leaves his eyes spare NOW: a stack's rear man (`from`: the way he came) while the switch is on and a living mate's gun is still on that door —
   *  one man alone on a door keeps his eyes on it — or a man an entry left holding the room */
  private spare(gd: Guard, A: Assignment): boolean {
    if (!A.spare || !A.post) return false;
    if (!A.from) return COVER.inRoom;
    // (on the walk he keeps up with the file, gun forward: his rear is his for the last steps and on the mark — but a door standing open by the way is his the whole walk: walkOnly)
    if (flat(gd.char.pos, A.post) > COVER.rearWalkM && !(DOORMANNERS.on && DOORMANNERS.stand && DOORMANNERS.watch)) return false;
    // (rearwatch.ts: the man an entry left outside on the way behind is not 'alone on a door' — his mates went through it, and their backs are what he keeps)
    return COVER.stacked && (!!rearPinOf(this.g, gd)?.out || this.g.orders.men().some(o => { if (o === gd) return false; const B = this.g.orders.of(o); return !!B && !!B.post && !B.spare && B.door === A.door; }));
  }
  private free(gd: Guard): Assignment | null {
    const g = this.g; if (gd.state === 'dead' || !gd.script || g.time < gd.dazzledUntil || gd.held) return null;
    const A = g.orders.of(gd); if (!A) return null;
    if (!(A.order === 'fallIn' || (A.order === 'hold' && !A.watch) || this.spare(gd, A))) return null;   // (… or his order leaves his eyes spare: on its mark, and on the walk to it)
    if (g.fight.engaged(gd)) return null;
    // a contact still warm is his before any opening is: a man who had a living enemy in his eyes inside COVER.contactSecs keeps looking where his order and the
    // fight leave him looking (down the corridor at the man who ducked back), never turned off it to a door behind him
    const O = g.fight.opOf(gd);
    if (O) for (const [h, M] of O.meters) if (h.state !== 'dead' && g.time - M.seenT < COVER.contactSecs) return null;
    return A;
  }
  /** COVER.rearRead: what a rear man on a door-less mark watches — the heaviest thing the ground round him offers that the other rear men have not got,
   *  kept `rearReadSecs` and through anything not `rearReadSticky` × heavier. null: nothing there (the old rule has him). */
  private readRear(gd: Guard, A: Assignment, list: readonly [Guard, Assignment][], bodies: readonly Vec3[]): Watchable | null {
    const g = this.g, K = COVER, p = gd.char.pos, now = g.time, C = this.reads.get(A);
    if (C && now >= C.t && now - C.t < K.rearReadSecs && flat(p, C.at) <= 0.5) return C.pick;
    const front = A.watch ? yawTo(A.watch, p) : A.face ?? gd.char.bodyYaw, deg = K.rearReadDeg * Math.PI / 180;
    // (a mate's thing and one of mine are 'the same' by where the MATE'S lies from where I stand: his bearing to it is from his own feet, metres off)
    const same = (o: Watchable, t: Watchable) => o.key === t.key || Math.abs(wrapAngle(yawTo(p, o.at) - t.yaw)) < (o.way && t.way ? 0.15 : deg);
    // (… what he watches NOW: a read he has not had looked at again since — he left his mark, the fight has him — holds nothing back from me)
    const theirs: Watchable[] = []; for (const [m, B] of list) { if (m === gd || !B.spare) continue; const R = this.reads.get(B); if (R?.pick && now >= R.t && now - R.t <= K.rearReadSecs + 0.5) theirs.push(R.pick); }
    // what a rear mate already watches is left to him; with nothing else in sight two guns on his way in beat one on a wall
    const all = watchablesAt(g, p, front, K.rearReadM, bodies), free = all.filter(t => !theirs.some(o => same(o, t))), W = free.length ? free : all;
    const was = C?.pick ? W.find(t => t.key === C.pick!.key || (!t.way && !C.pick!.way && Math.abs(wrapAngle(t.yaw - C.pick!.yaw)) < 0.3)) ?? null : null;
    const pick = was && W[0].w <= was.w * K.rearReadSticky ? was : W[0] ?? null;
    this.reads.set(A, { t: now, at: [p[0], 0, p[2]], pick }); if (pick && pick !== was) this.stats.rearRead++;
    return pick;
  }
  /** (doorway.ts DOORMANNERS.watch) a stack's rear man still on the WALK to his mark, further out than the last steps on which the rear is his: all that is
   *  his to watch out here is a door standing open by the way, other than the one he is going to — whoever comes at a file on the move comes through one */
  private walkOnly(gd: Guard, A: Assignment): boolean { return DOORMANNERS.on && DOORMANNERS.stand && DOORMANNERS.watch && !!A.spare && !!A.post && !!A.from && flat(gd.char.pos, A.post) > COVER.rearWalkM; }
  /** … such a door: its leaf `laneAjar` open or off its hinges, with floor beyond it the team has not been on (cleared.ts: a room nobody of ours has stood in, or open ground) */
  private walkDoor(o: Opening, A: Assignment): boolean {
    const d = o.door; if (!d || d === A.door || !(d.off || (!d.latched && Math.abs(d.angle) >= DOORMANNERS.laneAjar))) return false;
    const C = this.g.cleared, a = C.roomBy(d, 1), b = C.roomBy(d, -1);
    return !(a && b && C.isKnown(a) && C.isKnown(b));
  }
  private eyeOf(p: Vec3): Vec3 { return [p[0], EYE, p[2]]; }
  /** (rearwatch.ts) the point of this opening a man stood at `p` can watch — sight()'s answer from there */
  sightFrom(p: Vec3, o: Opening): Vec3 | null { return this.sight(this.eyeOf(p), o); }
  /** a line from this eye to the opening itself (a door: to just short of its frame, as orders.ts holdArcs asks it) */
  private line(eye: Vec3, o: Opening): boolean { return this.sight(eye, o) === o.at; }
  /** the point of this opening a man at `eye` can watch: the opening itself — or, an open door whose leaf stands between him and its doorway, a point just
   *  past the leaf's free edge (COVER.edge) · null: no line to either */
  private sight(eye: Vec3, o: Opening): Vec3 | null {
    const d = flat(eye, o.at); if (d > COVER.reach) return null; if (d < 0.3) return o.at;
    const k = o.door ? Math.max(0, 1 - 0.7 / d) : 1;
    if (this.g.col.segmentBlocked(eye, [eye[0] + (o.at[0] - eye[0]) * k, CHEST, eye[2] + (o.at[2] - eye[2]) * k])) return null;
    if (!(COVER.leaf && o.door && !o.door.off && Math.abs(o.door.angle) >= 0.5 && this.g.col.segmentBlocked(eye, [o.at[0], CHEST, o.at[2]]))) return o.at;   // (shut, its own leaf stands IN the frame: hence the line to short of it)
    if (!COVER.edge) return null;
    const D = o.door, u = D.dir(), r = D.def.width + 0.35, T: Vec3 = [D.def.hinge[0] + u[0] * r, CHEST, D.def.hinge[1] + u[1] * r];
    return flat(eye, T) > COVER.inM && !this.g.col.segmentBlocked(eye, T) ? T : null;
  }

  /** Once a frame from Game.update, before the orders pose the men. */
  tick() {
    const g = this.g, K = COVER;
    if (!K.on || !g.orders.active) { if (this.jobs.size || this.kept.size || this.outs.size) this.dropAll(); this.steps.clear(); this.live = []; this.men = []; return; }
    for (const [gd] of [...this.jobs]) if (!this.free(gd)) this.drop(gd, true);   // (an order, a drill, a fight: his job goes the frame it has him)
    for (const [gd, k] of [...this.kept]) {   // (… and so does a gun left on an opening the deal has let go of; its time up, the order's own watch has it back)
      if (!REAR.settle || !this.free(gd)) this.unkeep(gd, true); else if (Math.abs(g.time - k.t) >= REAR.secs) this.unkeep(gd); }
    for (const [gd] of [...this.outs]) if (!K.backTurn || !this.free(gd)) this.unturn(gd);   // (… and the man coming out of a back-pedal: taken, his feet and gun are given back as a job's are)
    for (const gd of g.orders.men()) { const v = gd.char.vel; if (Math.hypot(v[0], v[2]) > 0.3) this.heading.set(gd, Math.atan2(v[0], v[2])); }
    if (g.time < this.dealAt) return;
    this.dealAt = g.time + K.dealSecs;
    if (this.nav !== g.col.nav) this.build();
    this.deal();
  }

  private deal() {
    const g = this.g, K = COVER, sam = g.player.char, samUp = !g.player.down;
    const squad = g.orders.men(), list: [Guard, Assignment][] = [];
    for (const gd of squad) { const A = this.free(gd); if (A) list.push([gd, A]); }
    list.sort((a, b) => (a[1].post === null ? a[1].follow : 100) - (b[1].post === null ? b[1].follow : 100));
    const men = this.men = list.map(x => x[0]), asgOf = new Map(list); this.stats.deals++;
    if (!men.length) { this.live = []; this.pruneSteps(); return; }   // (nobody free — a contact has them all: a step taken stands through it, as stepDeal says)
    const file = list.filter(x => x[1].post === null).map(x => x[0]);
    const bodies: Vec3[] = squad.map(gd => gd.char.pos); if (samUp) bodies.push(sam.pos);
    const samEye = this.eyeOf(sam.pos);
    const near = (p: Vec3) => { let d = Infinity; for (const b of bodies) d = Math.min(d, flat(b, p)); return d; };
    // (nobody is dealt an opening he would have to cover THROUGH one of his own: Sam or a mate within COVER.lane of the line from him to it — the game's own
    //  muzzle discipline would only bring his gun down. The man already on it keeps it to a narrower lane: a mate brushing the line does not cost him the job.)
    const clear = (gd: Guard, o: Opening, at: Vec3) => {
      const J = this.jobs.get(gd), mine = J && J.o === o ? J : null;
      const p = gd.char.pos, dx = at[0] - p[0], dz = at[2] - p[2], len = Math.hypot(dx, dz) || 1, fx = dx / len, fz = dz / len, lane = mine ? K.laneKeep : K.lane;
      for (const b of bodies) { if (b === p) continue; const sx = b[0] - p[0], sz = b[2] - p[2], along = sx * fx + sz * fz;
        if (along > 0.15 && along < len && Math.abs(sx * fz - sz * fx) < lane) return !!mine && (K.laneWalk || spd.get(gd)! < 0.3) && g.time - mine.laneT < K.laneSecs; }
      if (mine) mine.laneT = g.time;
      return true;
    };
    // (which way each man is going, and whether he is RUNNING: a running man cannot carry a gun on what is behind him — it is not his to take)
    const spd = new Map(men.map(gd => [gd, Math.hypot(gd.char.vel[0], gd.char.vel[2])]));
    const ways = new Map(men.map(gd => [gd, spd.get(gd)! > 0.4 ? Math.atan2(gd.char.vel[0], gd.char.vel[2]) : null]));
    const behindOf = (gd: Guard, at: Vec3) => { const way = ways.get(gd) ?? null; return way !== null && Math.abs(wrapAngle(yawTo(gd.char.pos, at) - way)) > K.twist; };
    // (poseFor's own rule, on his pace: over backIn he does not START walking backwards, over backOut he stops)
    const fast = (gd: Guard) => { const J = this.jobs.get(gd); return Math.max(spd.get(gd)!, J?.pace ?? 0) > (J?.back ? K.backOut : K.backIn); };
    const runs = (gd: Guard, at: Vec3) => fast(gd) && behindOf(gd, at);
    const samOn = (o: Opening) => samUp && o.kind !== 'rear' && Math.abs(wrapAngle(yawTo(sam.pos, o.at) - sam.aimYaw)) < K.samDeg * Math.PI / 180 && this.line(samEye, o);
    const heldBy = (o: Opening) => o.kind !== 'rear' && squad.some(gd => { if (men.includes(gd)) return false; const A = g.orders.of(gd); if (!A || !A.post || flat(gd.char.pos, A.post) > 1.5) return false;
      return (!!o.door && A.door === o.door) || (!!A.watch && flat(A.watch, o.at) < 1.5); });
    // ---- the live openings
    let live: LiveOpening[] = []; const openDoors: Opening[] = [];   // (… and every door standing open that the squad is neither in nor going through and that is neither on Sam's gun nor a posted man's, seen or not: stepDeal)
    const add = (o: Opening, kindK: number) => {
      const at = new Map<Guard, Vec3>();
      const sees = men.filter(gd => { if (flat(gd.char.pos, o.at) <= K.inM || runs(gd, o.at)) return false;
        const A = asgOf.get(gd)!; if (this.walkOnly(gd, A) && !this.walkDoor(o, A)) return false;
        const to = this.sight(this.eyeOf(gd.char.pos), o); if (!to || !clear(gd, o, to)) return false; at.set(gd, to); return true; });
      // (a man who sees only the free EDGE of its open leaf — COVER.edge — is not one who can take it: a man standing IN the doorway is hidden from him. It stays
      //  live for the men with a line into it; the edge is his only when he has nothing else, below)
      const can = sees.filter(gd => at.get(gd) === o.at), edge = sees.filter(gd => at.get(gd) !== o.at); if (!can.length && !edge.length) return null;
      const onSam = samOn(o), held = heldBy(o);
      const L: LiveOpening = { o, w: kindK / (1 + near(o.at) / K.nearM) * (onSam ? K.samK : 1) * (held ? K.heldK : 1), can, edge, at, by: null, edgeBy: null, sam: onSam, held };
      live.push(L); return L;
    };
    for (const o of this.openings) {
      if (near(o.at) > K.reach) continue;
      if (bodies.some(b => flat(b, o.at) < K.inM)) continue;   // one of ours is standing in it
      let pos = false, neg = false; for (const b of bodies) { if (flat(b, o.at) > 2.5) continue; if ((b[0] - o.at[0]) * o.n[0] + (b[2] - o.at[2]) * o.n[1] >= 0) pos = true; else neg = true; }
      if (pos && neg) continue;   // … or the file is going through it
      const shut = !!o.door && Math.abs(o.door.angle) < 0.5, L = add(o, shut ? K.shutK : 1);
      if (o.door && !shut && !(L ? L.sam || L.held : samOn(o) || heldBy(o))) openDoors.push(o);
    }
    // a passage looked INTO from outside is one opening — its nearer mouth; with one of ours inside it, its two mouths are his front and his back
    live = live.filter(L => { const o = L.o; if (!o.pass || !o.far) return true;
      const twin = live.find(M => M !== L && M.o.pass === o.pass); if (!twin || twin.w < L.w || (twin.w === L.w && twin.o.id > o.id)) return true;
      const ax = o.far[0] - o.at[0], az = o.far[2] - o.at[2], l2 = ax * ax + az * az || 1;
      return bodies.some(b => { const t = ((b[0] - o.at[0]) * ax + (b[2] - o.at[2]) * az) / l2; return t > 0 && t < 1 && Math.abs((b[0] - o.at[0]) * az - (b[2] - o.at[2]) * ax) / Math.sqrt(l2) < o.half + 0.3; }); });
    // ---- the rear: the way they came, back along Sam's trail past the last man (the furthest point of it he still has a line to)
    let rearL: LiveOpening | null = null; const last = file[file.length - 1];
    if (last) {
      const lp = last.char.pos; let back: Vec3 | null = null;
      // (… and BEHIND him: a man still running up from far back has that point ahead of him, on the way to his place — no rear until he is in the file)
      const lway = ways.get(last) ?? null;
      for (const k of [1, 0.6, 0.35]) { const q = g.orders.trailBack(last, K.rearM * k); if (!q || flat(q, lp) <= 1.2) continue;
        if (lway !== null && Math.abs(wrapAngle(yawTo(lp, q) - lway)) < Math.PI / 2) continue;
        if (!g.col.segmentBlocked(this.eyeOf(lp), [q[0], CHEST, q[2]])) { back = q; break; } }
      if (fast(last)) back = null;
      if (back) {
        const brg = yawTo(lp, back), off = (L: LiveOpening) => Math.abs(wrapAngle(yawTo(lp, L.o.at) - brg));
        // (an opening that lies that way already IS the rear: no second point beside it)
        if (!live.some(L => L.can.includes(last) && off(L) < 0.35)) { const R = this.rear; R.at[0] = back[0]; R.at[2] = back[2]; const l = flat(back, lp); R.n = [(back[0] - lp[0]) / l, (back[2] - lp[2]) / l]; add(R, K.rearK); }
        // a file of three or more: its last man has the rear — the heaviest thing behind him
        // (… and he stays on the one he has unless another is clearly heavier: the rear man's gun does not hunt)
        const mine = this.jobs.get(last)?.o, wOf = (L: LiveOpening) => L.w * (L.o === mine ? K.rearKeep : 1);
        if (file.length >= K.rearFrom) for (const L of live) if (L.can.includes(last) && off(L) < K.rearDeg * Math.PI / 180 && (!rearL || wOf(L) > wOf(rearL))) rearL = L;
      }
    }
    // ---- a man whose eyes are spare on a mark (a stack's last man): HIS rear is the way he came to it — as far back along that line as he can see, and
    // only where no opening he could take already lies that way; with no way come (he was ordered where he stood): straight out from the door. On the WALK
    // to his mark it is his too: he goes to the stack with his gun on the way they came, backwards when it is behind him (poseFor), as a file's last man does
    for (const [gd, A] of list) {
      if (!A.spare || !A.post || !A.from || this.walkOnly(gd, A)) continue;
      const p = gd.char.pos;
      // the point his gun rests on along (dx, dz): the furthest of three his eye has a line to (`far`: up to l itself, a read's thing; else inside rearM)
      const along = (dx: number, dz: number, l: number, far: boolean): Vec3 | null => { const h = Math.hypot(dx, dz); if (!(h > 1e-6)) return null;
        for (const k of [1, 0.6, 0.35]) { const r = far ? l * k : Math.min(l, K.rearM * k); if (r < 1.2) break; const q: Vec3 = [p[0] + dx / h * r, 0, p[2] + dz / h * r];
          if (!g.col.segmentBlocked(this.eyeOf(p), [q[0], CHEST, q[2]])) return q; }
        return null; };
      let back: Vec3 | null = null;
      // (the read is his from `rearReadIn` of the mark, and kept half a metre further out once he has one: a shove on the mark's edge does not flip his gun)
      const read = K.rearRead && !A.door && flat(p, A.post) <= K.rearReadIn + (this.reads.get(A)?.pick ? 0.5 : 0) ? this.readRear(gd, A, list, bodies) : null;
      if (read) { const dx = read.at[0] - p[0], dz = read.at[2] - p[2]; back = along(dx, dz, Math.min(Math.hypot(dx, dz) - (read.way ? 0.7 : 0), K.rearLook), true); }
      if (!back) {   // nothing read, or nothing of it his eye can rest on (too near, no line): the old rule
        let dx = A.from[0] - p[0], dz = A.from[2] - p[2], l = Math.hypot(dx, dz);
        if (l < 1.5) { const d = A.door; if (!d || flat(p, A.post) > 0.6) continue;   // (… and that only once he is on his mark: a step into the walk he has no rear yet)
          dx = p[0] - d.frameCentre[0]; dz = p[2] - d.frameCentre[2];
          const nx = -Math.sin(d.def.closedDir), nz = Math.cos(d.def.closedDir), s = dx * nx + dz * nz >= 0 ? 1 : -1; dx = nx * s; dz = nz * s; l = K.rearM; }
        back = along(dx, dz, l, false); }
      if (!back) continue;
      const brg = yawTo(p, back); if (live.some(L => L.can.includes(gd) && Math.abs(wrapAngle(yawTo(p, L.o.at) - brg)) < 0.35)) continue;
      let R = this.rears.get(gd); if (!R) this.rears.set(gd, R = { id: `rear:${gd.callsign}`, kind: 'rear', at: [0, CHEST, 0], n: [0, 1], half: 1, door: null, pass: null, far: null });
      R.at[0] = back[0]; R.at[2] = back[2]; const bl = flat(back, p) || 1; R.n = [(back[0] - p[0]) / bl, (back[2] - p[2]) / bl];
      const L = add(R, K.rearK); if (L) { L.can = L.can.filter(m => m === gd); if (!L.can.length) live.splice(live.indexOf(L), 1); }
    }
    // ---- THE REAR MAN OF A STACK with an open way at its back (rearwatch.ts): that way is HIS, ahead of every dealing below and whatever kept it out of the
    // list above (a mate by its frame, a mate brushing his lane, the walk's narrower list) — while he has a line to it from where he is
    const pins: [Guard, LiveOpening][] = [];
    for (const [gd] of list) { const P = rearPinOf(g, gd); if (!P) continue;
      // (his line cut for a moment and the pin kept — REARWATCH.grace: the point he had; a step short of a mark the door tool has just moved: the point that
      //  mark sees, so he does not turn to something else for the half second the step takes)
      const o = P.o, J0 = this.jobs.get(gd), post = P.A.post, to = rearSees(g, gd.char.pos, o, P.front) ?? (J0 && !J0.off && J0.o === o ? J0.to : null)
        ?? (post && Math.hypot(gd.char.pos[0] - post[0], gd.char.pos[2] - post[2]) < 1 ? rearSees(g, post, o, P.front) : null) ?? P.to ?? null; if (!to) continue;   // (… a taken room's other door kept over 'fall in', REARWATCH.room: the point he had)
      let L = live.find(x => x.o === o);
      if (!L) live.push(L = { o, w: 1 / (1 + near(o.at) / K.nearM), can: [], edge: [], at: new Map(), by: null, edgeBy: null, sam: samOn(o), held: false });
      if (!L.can.includes(gd)) L.can.push(gd); L.edge = L.edge.filter(m => m !== gd); L.at.set(gd, to); pins.push([gd, L]); }
    live.sort((a, b) => b.w - a.w);
    // ---- the deal: the rest (everybody, in a short file) are dealt the heaviest openings, one each, every dealing tried
    const got = new Map<Guard, LiveOpening>();
    // (a file's last man who is KEEPING a taken room's other door — rearwatch.ts REARWATCH.room — has that door, not the file's rear: with two keepers in a room
    //  the 'rear' handed to one was the other's door, and neither had his own)
    if (rearL && !(roomKept(g, last) && pins.some(x => x[0] === last))) { got.set(last, rearL); rearL.by = last; }   // (roomKept is false with the switch off: the line as it was)
    for (const [gd, L] of pins) if (!L.by && !got.has(gd)) { got.set(gd, L); L.by = gd; }
    // (a man keeps what he was just dealt: COVER.keepSecs of it, while it is still live and his to take)
    for (const gd of men) { const J = this.jobs.get(gd); if (got.has(gd) || !J || g.time - J.t0 >= K.keepSecs) continue;
      const L = live.find(x => x.o === J.o && !x.by && x.can.includes(gd)); if (L) { got.set(gd, L); L.by = gd; } }
    const hands = men.filter(gd => !got.has(gd)), pool = live.filter(L => !L.by && L.can.length).slice(0, 8);   // (an opening seen only by its leaf's edge is nobody's to be dealt)
    // (on the move, what has fallen behind a man is the last man's before it is his: he looks back for it only with nothing ahead or abeam)
    const score = hands.map(gd => { const p = gd.char.pos, J = this.jobs.get(gd);
      return pool.map(L => { if (!L.can.includes(gd)) return 0;
        const turn = Math.abs(wrapAngle(yawTo(p, L.o.at) - gd.char.aimYaw)), behind = gd !== last && behindOf(gd, L.o.at);
        // (never nothing: the least thing he can take beats standing with his gun down beside an opening nobody has)
        return Math.max(0.05, 10 * L.w * (behind ? K.behindK : 1) - 0.25 * flat(p, L.o.at) / K.reach - 0.35 * turn / Math.PI + (J && J.o === L.o ? K.sticky : 0) + gunLane(gd, flat(p, L.o.at), K.reach)); }); });   // (gunroles.ts: the far opening is a long gun's before it is a pistol's — 0 with its switch off, and for a rifle)
    const used = pool.map(() => false), cur: number[] = []; let best: number[] = hands.map(() => -1), bs = -Infinity;
    const rec = (i: number, s: number) => {
      if (i === hands.length) { if (s > bs + 1e-9) { bs = s; best = [...cur]; } return; }
      cur[i] = -1; rec(i + 1, s);
      for (let j = 0; j < pool.length; j++) { const v = score[i][j]; if (used[j] || v <= 0) continue; used[j] = true; cur[i] = j; rec(i + 1, s + v); used[j] = false; }
    };
    rec(0, 0);
    hands.forEach((gd, i) => { const j = best[i]; if (j >= 0) { got.set(gd, pool[j]); pool[j].by = gd; } });
    for (const gd of men) { if (got.has(gd)) continue; const L = live.find(x => !x.by && !x.edgeBy && x.edge.includes(gd)); if (L) { got.set(gd, L); L.edgeBy = gd; } }   // (a man left with nothing: the leaf's edge of the heaviest open door he sees no further into — a second-class watch, the doorway itself still nobody's)
    // ---- hand the jobs out
    for (const gd of men) {
      const L = got.get(gd), J = this.jobs.get(gd);
      if (!L) { if (J) this.drop(gd); continue; }
      if (J && J.o === L.o) { J.to = L.at.get(gd) ?? L.o.at; continue; }
      const P = J ?? this.keptOf(gd); if (!P) this.unkeep(gd); this.kept.delete(gd);   // (a gun still on the opening he was last dealt: it goes from there, as on a swap)
      const c = gd.char, r = Math.max(1.5, flat(c.pos, L.o.at));
      const yaw = P ? P.yaw : c.aimYaw, rr = P ? P.r : r;   // (from where the muzzle is: it travels to the opening)
      const aim: Vec3 = P ? P.aim : [c.pos[0] + Math.sin(yaw) * rr, CHEST, c.pos[2] + Math.cos(yaw) * rr];
      this.jobs.set(gd, { o: L.o, to: L.at.get(gd) ?? L.o.at, aim, yaw, r: rr, t0: g.time, aimT: g.time, back: P?.back ?? false, laneT: g.time, off: false, pace: 0, A: asgOf.get(gd)! });
      if (J) this.stats.swaps++; else this.stats.takes++; if (L.o.kind === 'rear') this.stats.rear++;
      this.note(gd, L.o.id);
    }
    this.live = live.filter(L => L.can.length); this.stats.uncovered += this.live.filter(L => !L.by && !L.sam && !L.held).length;
    this.stepDeal(list, asgOf, got, live, openDoors, bodies, spd, o => 1 / (1 + near(o.at) / K.nearM), rearL ? last : null);
  }
  /** STEP TO SEE (COVER.step; the head comment): after the deal, every door standing open by the squad that NOBODY HAS A LINE INTO — every free man is behind
   *  its leaf or off its line: the deal could hand out its leaf's edge at best — gets one man: of the men stood still whose order lets their feet go, first one
   *  with nothing (or only that edge) to watch, else one on something that weighs less than this door does, whoever has the shortest step to a spot he sees
   *  through it from (stepSpot). A door some man does see into but that went undealt is stepped for only by a man with nothing. The walk is his order's
   *  (orders.ts asks stepOf: a follower's goal while Sam stands, a plain holder's mark moved); the next deal finds him with a line and weighs the door as any
   *  other. The counts are kept whatever the switch says: they are the before and after. */
  private stepDeal(list: [Guard, Assignment][], asgOf: Map<Guard, Assignment>, got: Map<Guard, LiveOpening>, live: LiveOpening[], open: Opening[], bodies: Vec3[], spd: Map<Guard, number>, wOf: (o: Opening) => number, rearMan: Guard | null) {
    const g = this.g, K = COVER, t = g.time, samStill = g.orders.samStopped;
    // (a step stands while the order it was taken under does — through a contact, a fight, a blinding: he does not walk back to his place and out again —
    //  and, for a follower, while Sam stands)
    this.pruneSteps();
    const ready: Guard[] = [];   // the men who could step this deal
    for (const [gd, A] of list) {
      const p = gd.char.pos, L = got.get(gd) ?? null, still = spd.get(gd)! < 0.3;
      if (!still || !this.stood.has(gd)) this.stood.set(gd, t);
      if (L && L.edgeBy === gd && L.o.door) this.stats.blind++;
      const S = this.steps.get(gd);
      if (S && !S.done) {
        if (flat(p, S.q) < 0.35) { S.done = true; S.t = t; this.stats.stepped++; this.noStep.set(gd, t + 2); }
        else if (t - S.t > K.stepSecs) { S.q = [p[0], 0, p[2]]; S.done = true; S.t = t; this.noStep.set(gd, t + 4); }   // (a mate in the way, a chair: where he got to is his place)
        continue;
      }
      if (S && !S.saw && L && L.o === S.o && L.by === gd) { S.saw = true; this.stats.stepSaw++; }
      // (his order lets his feet go: under 'fall in' while Sam stands, or holding a spot with nothing named — never a stack's rear man, a man an entry left on
      //  his point, or the last man of a file whose rear is his outright)
      const mayStep = A.post === null ? samStill : A.order === 'hold' && !A.watch && !A.spare && !A.via.length;
      const placed = A.post !== null || !(K.stepPlaceM > 0) || flat(p, A.goal) <= K.stepPlaceM;
      if (mayStep && still && placed && gd !== rearMan && t - Math.max(this.stood.get(gd)!, A.t0) >= K.stepAfter && t >= (this.noStep.get(gd) ?? 0)) ready.push(gd);   // (… nor in the first moments of an order: 'fall in' given on the walk reads as Sam standing for a frame)
    }
    for (const o of [...open].sort((a, b) => wOf(b) - wOf(a))) {
      const X = live.find(l => l.o === o) ?? null; if (X && X.by) continue;
      const seen = X ? X.can : [], inReach = (gd: Guard) => flat(gd.char.pos, o.at) <= K.stepReach;
      if (!seen.length && list.some(([gd]) => inReach(gd))) this.stats.unseen++;
      if (!K.step || t < (this.doorTry.get(o) ?? 0)) continue;
      let theirs = false; for (const S of this.steps.values()) if (S.o === o && (!S.done || S.saw || t - S.t < 3)) theirs = true;
      if (theirs) continue;   // (one man a door: his who is stepping for it, or has stepped and has it — a step that did not get him the doorway frees it for another)
      const idle = ready.filter(gd => inReach(gd) && !seen.includes(gd) && (!got.has(gd) || got.get(gd)!.edgeBy === gd));
      // (… by enough that the next deal moves him onto it: what a man is on has COVER.sticky over a rival, on the deal's scale of ten weights)
      const busy = seen.length ? [] : ready.filter(gd => inReach(gd) && got.get(gd)?.by === gd && 10 * (wOf(o) - got.get(gd)!.w) > K.sticky + 0.3);
      let pick: { gd: Guard; q: Vec3; c: number; from: Vec3 } | null = null;
      for (const tier of [idle, busy]) { if (pick) break;
        for (const gd of tier) { const A = asgOf.get(gd)!, p = gd.char.pos, S = this.steps.get(gd);
          const from: Vec3 = A.post ? [A.post[0], 0, A.post[2]] : S ? S.from : [p[0], 0, p[2]];   // (a holder's mark is the order's still: orders.ts walks him off it and leaves it where it is)
          const r = this.stepSpot(gd, from, o, bodies); if (r && (!pick || r.c < pick.c)) pick = { gd, q: r.q, c: r.c, from }; } }
      if (!pick) { if (idle.length || busy.length) this.doorTry.set(o, t + 2.5); continue; }   // (men who could go, and no spot for any of them: not asked again every deal)
      this.steps.set(pick.gd, { q: pick.q, from: pick.from, o, A: asgOf.get(pick.gd)!, t, done: false, saw: false }); this.stats.steps++;
      ready.splice(ready.indexOf(pick.gd), 1);
    }
  }
  /** the steps that no longer stand: the switch off, the man down, his order another one, a follower whose Sam walks again */
  private pruneSteps() {
    const g = this.g, samStill = g.orders.samStopped;
    for (const [gd, S] of [...this.steps]) { const A = g.orders.of(gd); if (!COVER.step || gd.state === 'dead' || A !== S.A || (A.post === null && !samStill)) this.steps.delete(gd); }
  }
  /** the spot a man steps to to see through open door `o`: within COVER.stepM of `from` (the place his order gave him), on his own side of the door, free floor
   *  reached in a straight walk, in no opening (COVER.stepOffM clear of every one's width), not on a mate nor on a mate's step, with a line from his eye INTO
   *  the doorway and on through it, no mate in that line and himself in nobody's (a mate's line to his opening, Sam's own gun) — the shortest step of those, the less square-on to the doorway (what comes out of a door comes
   *  out down its middle) and the less toward it the better · null: there is none */
  private stepSpot(gd: Guard, from: Vec3, o: Opening, bodies: Vec3[]): { q: Vec3; c: number } | null {
    const g = this.g, K = COVER, col = g.col, p = gd.char.pos;
    const side = (x: Vec3) => (x[0] - o.at[0]) * o.n[0] + (x[2] - o.at[2]) * o.n[1];
    const s = side(p) >= 0 ? 1 : -1, d0 = flat(p, o.at);
    const beyond: Vec3 = [o.at[0] - o.n[0] * s * 0.8, CHEST, o.at[2] - o.n[1] * s * 0.8];
    // (the guns already up: every mate's line to what he was dealt, and Sam's own — nobody steps into one)
    const sam = g.player.char, guns: [Vec3, Vec3][] = g.player.down ? [] : [[sam.pos, [sam.pos[0] + Math.sin(sam.aimYaw) * 8, 0, sam.pos[2] + Math.cos(sam.aimYaw) * 8]]];
    for (const [m, J] of this.jobs) if (m !== gd && !J.off) guns.push([m.char.pos, J.to]);
    const inLane = (x: Vec3, a: Vec3, b: Vec3) => { const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1, sx = x[0] - a[0], sz = x[2] - a[2], along = (sx * dx + sz * dz) / len; return along > 0.15 && along < len && Math.abs(sx * dz - sz * dx) / len < K.lane; };
    let best: Vec3 | null = null, bc = Infinity;
    for (const r of [0.5, 0.9, 1.3, 1.7, 2.1, 2.5]) { if (r > K.stepM + 1e-6) break;
      for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, q: Vec3 = [from[0] + Math.sin(a) * r, 0, from[2] + Math.cos(a) * r];
        const step = flat(p, q); if (step < 0.4) continue;
        if (side(q) * s < 0.5 || col.nav.isBlocked(q[0], q[2])) continue;
        if (this.openings.some(x => flat(q, x.at) < x.half + K.stepOffM)) continue;
        if (bodies.some(b => b !== p && flat(b, q) < 0.8)) continue;
        let taken = false; for (const [m, M] of this.steps) if (m !== gd && flat(M.q, q) < 0.8) taken = true; if (taken) continue;
        if (col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]]) || col.solidBlocked([p[0], CHEST, p[2]], [q[0], CHEST, q[2]])) continue;
        if ([0.35, 0.7].some(k => { const mx = p[0] + (q[0] - p[0]) * k, mz = p[2] + (q[2] - p[2]) * k; return this.openings.some(x => Math.hypot(mx - x.at[0], mz - x.at[2]) < x.half + 0.3); })) continue;   // (… nor does the walk there cut across one)
        const eye = this.eyeOf(q); if (this.sight(eye, o) !== o.at || col.segmentBlocked(eye, beyond)) continue;
        if (bodies.some(b => b !== p && inLane(b, q, o.at)) || guns.some(([a, b]) => inLane(q, a, b))) continue;
        const len = flat(q, o.at) || 1, c = step + 0.6 * Math.abs(side(q)) / len + 0.5 * Math.max(0, d0 - len);
        if (c < bc) { bc = c; best = q; } } }
    return best ? { q: best, c: bc } : null;
  }
  /** orders.ts tick(): where the cover has this man step to (COVER.step) under the order he has now · null: nowhere, his feet are the order's */
  stepOf(gd: Guard, A: Assignment): Vec3 | null { const S = this.steps.get(gd); return S && S.A === A ? S.q : null; }
  /** orders.ts: he cannot get to it (its own stuck rule) — where he stands is where the step ends */
  stepHalt(gd: Guard) {
    const S = this.steps.get(gd); if (!S) return; const p = gd.char.pos; S.q = [p[0], 0, p[2]];   // (a step already made that he was pushed off and cannot get back onto ends where he stands too: he does not grind at it)
    if (!S.done) { S.done = true; S.t = this.g.time; this.noStep.set(gd, this.g.time + 4); }
  }
  private note(gd: Guard, id: string | null) { this.log.push({ t: this.g.time, who: gd.callsign, id }); if (this.log.length > 400) this.log.splice(0, this.log.length - 400); }
  /** `taken`: something else has him now (an order, a drill, the knob going off) and may not re-pose him — what the cover wrote into his script goes with the job:
   *  the back-pedal, the aim point if it is still ours, and the gun-up carriage if nobody has changed it since (orders.ts re-poses a man who is merely re-dealt) */
  private drop(gd: Guard, taken = false) {
    const J = this.jobs.get(gd); if (!J) return; this.jobs.delete(gd); this.note(gd, null);
    // (REAR.settle: the deal has let go of him and nothing else has taken him — his gun stays where it is a moment longer; see keptOf)
    if (!taken && REAR.settle && !J.off && gd.script?.aimAt === J.aim) {
      const A = this.g.orders.of(gd) ?? J.A;   // (the order he is under NOW: a job outlives a re-order that leaves him free, J.A is the one it was dealt under)
      if (REAR.file || (!!A.spare && !!A.post && !!A.from)) { J.to = [J.to[0], J.to[1], J.to[2]]; this.kept.set(gd, { J, t: this.g.time }); this.stats.kept++; return; }   // (its own copy of the point: the file's rear is one object the next deal moves for whoever is last by then)
    }
    if (!taken) this.turnFrom(gd, J);
    if (taken) this.release(gd, J);
  }
  private release(gd: Guard, J: CoverJob) {
    const s = gd.script; if (!s || gd.state === 'dead') return;
    if (J.back && s.strafe) s.strafe = false;
    if (s.aimAt === J.aim) { s.aimAt = J.A.watch; if (s.upper === 'aim' && s.stance === 'none') { s.upper = J.A.upper; s.stance = J.A.stance; } }
  }
  /** COVER.backTurn — the deal has let go of a man who was walking backwards on his opening (dropped, or a kept gun's time up): from here his feet are turnOut()'s until his body has come round */
  private turnFrom(gd: Guard, J: CoverJob) { if (COVER.backTurn && J.back && gd.script?.strafe && gd.state !== 'dead') this.outs.set(gd, { J, aim: [J.aim[0], J.aim[1], J.aim[2]], t0: this.g.time, t: this.g.time, on: false }); }
  /** …the way he goes: at the corner of his path he is walking to (the runner's strafe steers straight at it), else the way he is moving */
  private wayOf(gd: Guard): number { const p = gd.char.pos, wp = gd.path[gd.pathI]; return wp && flat(p, wp) > 0.3 ? yawTo(p, wp) : this.heading.get(gd) ?? gd.char.bodyYaw; }
  /** …is he still that man: posed by us last frame, inside the seconds, walking (not stood, not run on), his body still turned from the way he goes */
  private turning(gd: Guard, still: boolean, pace: number): boolean {
    const o = this.outs.get(gd), K = COVER, t = this.g.time; if (!o) return false;
    return K.backTurn && !still && pace <= K.backOut && Math.abs(t - o.t) <= 0.1 && Math.abs(t - o.t0) < K.backTurnSecs && Math.cos(gd.char.bodyYaw - this.wayOf(gd)) < K.backTurnBody;
  }
  /** …and his pose while he is: the path's own feet (strafe), the body turning to the way he goes, the gun carried round in front of it. null: the order's own pose stands */
  private turnOut(gd: Guard, still: boolean, pace: number): { at: Vec3; face: number | null; strafe: boolean } | null {
    const o = this.outs.get(gd); if (!o) return null;
    if (!this.turning(gd, still, pace)) { this.outs.delete(gd); return null; }   // (the order poses him this same frame: its own strafe, face and watch are written over ours)
    const c = gd.char; if (!o.on) { o.on = true; this.stats.turned++; } o.t = this.g.time;
    o.aim[0] = c.pos[0] + Math.sin(c.bodyYaw) * 3; o.aim[2] = c.pos[2] + Math.cos(c.bodyYaw) * 3;
    return { at: o.aim, face: this.wayOf(gd), strafe: true };
  }
  /** …something else has him (an order that does not leave him free, a drill, a daze, the knob going off) and may not re-pose him: what the turn-out wrote into his script goes, as release() does it for a job */
  private unturn(gd: Guard) {
    const o = this.outs.get(gd); if (!o) return; this.outs.delete(gd);
    const s = gd.script; if (!s || gd.state === 'dead') return;
    if (s.strafe) s.strafe = false;
    if (s.aimAt === o.aim) { s.aimAt = o.J.A.watch; if (s.upper === 'aim' && s.stance === 'none') { s.upper = o.J.A.upper; s.stance = o.J.A.stance; } }
  }
  /** the gun comes off an opening the deal let go of: `taken` as for drop() */
  private unkeep(gd: Guard, taken = false) { const k = this.kept.get(gd); if (!k) return; this.kept.delete(gd); if (taken) this.release(gd, k.J); else this.turnFrom(gd, k.J); }
  /** REAR.settle — the opening the deal last took off this man, while his gun is still on it: inside REAR.secs, the gun still the cover's, he still
   *  under one that leaves him free (tick() has looked), and nobody of ours in its line or stood in it (the deal's own muzzle rule, to the keeper's narrower
   *  lane). It is NOT asked whether he still has a line to it: losing that on the walk is the commonest reason the deal let go, and the gun going back and
   *  forth over exactly that is what this is for */
  private keptOf(gd: Guard): CoverJob | null {
    const k = this.kept.get(gd); if (!k) return null;
    const g = this.g, J = k.J, p = gd.char.pos;
    if (Math.abs(g.time - k.t) >= REAR.secs || gd.script?.aimAt !== J.aim) return null;
    const A = g.orders.of(gd); if (!A) return null; J.A = A;   // (told to stack meanwhile, his eyes still spare: the gun does not start for the door and come back)
    const dx = J.to[0] - p[0], dz = J.to[2] - p[2], len = Math.hypot(dx, dz) || 1, fx = dx / len, fz = dz / len;
    if (len < COVER.inM) return null;
    // (… in the line as far as the opening and a step beyond it, or standing in the opening: the deal takes a job for either, and so does this)
    const ours = (b: Vec3) => { const sx = b[0] - p[0], sz = b[2] - p[2], along = sx * fx + sz * fz; return (along > 0.15 && along < len + COVER.inM && Math.abs(sx * fz - sz * fx) < COVER.laneKeep) || flat(b, J.to) < COVER.inM; };
    if (!g.player.down && ours(g.player.char.pos)) return null;
    for (const m of g.orders.men()) if (m !== gd && m.state !== 'dead' && ours(m.char.pos)) return null;
    return J;
  }
  private dropAll() { for (const gd of [...this.jobs.keys()]) this.drop(gd, true); for (const gd of [...this.kept.keys()]) this.unkeep(gd, true); for (const gd of [...this.outs.keys()]) this.unturn(gd); }

  /** orders.ts tick(), for a man it is about to pose: where his gun goes and how he carries himself for the opening he was dealt — null: he has none (or is
   *  running to catch up with one behind him) and the order's own pose stands. `still`: his order has him stood (a holder; a follower closed up on a stopped
   *  Sam) · `pace`: the speed his order is about to walk him at. */
  poseFor(gd: Guard, still: boolean, pace: number): { at: Vec3; face: number | null; strafe: boolean } | null {
    const J = this.jobs.get(gd) ?? this.keptOf(gd);
    if (!J) { this.unkeep(gd); return this.turnOut(gd, still, pace); }
    const g = this.g, K = COVER, c = gd.char, p = c.pos, to = J.to;
    // (backTurn: dealt an opening while he is still coming out of the last one's back-pedal — he is a man walking backwards to this one too, or it would walk him forward along a body turned to the rear)
    if (this.outs.has(gd)) { if (this.turning(gd, still, pace)) J.back = true; this.outs.delete(gd); }
    const dt = Math.min(0.1, Math.max(0, g.time - J.aimT)); J.aimT = g.time;
    // (the point is carried round him at a bearing and a range that ease onto the opening: eased as a point in the world it cut through him on a front-to-rear
    //  swing — the muzzle snapped half a turn in a frame and dipped at the floor)
    const brg = yawTo(p, to), k = 1 - Math.exp(-K.swing * dt);
    if (gd.script?.aimAt !== J.aim) J.yaw = c.aimYaw;   // (his gun was not ours last frame — the order ran him on, Sam stood in his line: it starts from where it is)
    J.pace = pace;
    // (… and round his FRONT: the runner holds a gun within 1.5 rad of the body, so a bearing eased the short way across his back would flip from one shoulder
    //  to the other in a frame — eased against the body's own yaw it comes through the front as the body turns under it)
    const rel = wrapAngle(J.yaw - c.bodyYaw), want = wrapAngle(brg - c.bodyYaw);
    J.yaw = wrapAngle(c.bodyYaw + rel + (want - rel) * k); J.r += (Math.max(1.5, flat(p, to)) - J.r) * k;
    J.aim[0] = p[0] + Math.sin(J.yaw) * J.r; J.aim[1] = damp(J.aim[1], to[1], K.swing, dt); J.aim[2] = p[2] + Math.cos(J.yaw) * J.r;
    J.off = false;
    if (still) { J.back = false; return { at: J.aim, face: brg, strafe: false }; }
    // (the way he is going: his velocity — and, baulked to a stop by the man ahead, the way he WAS going: a back-pedalling man's body already faces his opening)
    const way = this.heading.get(gd) ?? c.bodyYaw;
    // (backKeep: not while a back-pedalling man's body still faces away from the way he goes — he would walk along it, the wrong way)
    if (Math.abs(wrapAngle(brg - way)) <= K.twist && !(K.backKeep && J.back && pace <= K.backOut && Math.cos(c.bodyYaw - way) < K.backBody)) { J.back = false; return { at: J.aim, face: null, strafe: false }; }
    J.back = pace <= (J.back ? K.backOut : K.backIn);
    if (J.back) return { at: J.aim, face: brg, strafe: true };
    J.off = true; this.kept.delete(gd); return null;   // (a gun merely left on an opening does not outlast being run on from it)
  }

  /** an opening in a few words, as this man would say it */
  nameOf(o: Opening, from?: Vec3): string {
    if (o.kind === 'rear') return 'the rear';
    if (o.door) return `the ${doorWords(o.door)}`;
    if (!from) return `${o.kind} (${o.at[0].toFixed(1)}, ${o.at[2].toFixed(1)})`;
    const what = o.kind === 'mouth' ? 'aisle' : 'gap', yaw = yawTo(from, o.at);
    if (WORDS.on) { const p = watchedPlace(this.g.level, from, [o.at[0] + Math.sin(yaw), 0, o.at[2] + Math.cos(yaw)]); return p ? `the ${what} to ${p}` : `the ${what}`; }   // (words.ts: the place it leads to by the level's own name — never a bearing, the HUD has no compass)
    return `the ${what} ${COMPASS[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8]}`;
  }
  /** has he an opening dealt (and is on it, not running with it behind him) */
  has(gd: Guard): boolean { const J = this.onOf(gd); return !!J && !J.off; }
  /** the opening his gun is on: dealt, or let go of and still his for the moment (REAR.settle) */
  private onOf(gd: Guard): CoverJob | undefined { return this.jobs.get(gd) ?? this.kept.get(gd)?.J; }
  /** what he is on, in words ('' with nothing dealt) · the same as the tail of his row in the squad block (orders.ts: 'Red One · with you · on the server door') */
  words(gd: Guard): string { const J = this.onOf(gd); return J && !J.off ? `on ${this.nameOf(J.o, gd.char.pos)}` : ''; }
  tail(gd: Guard): string { const w = this.words(gd); return w ? ` · ${w}` : ''; }
  /** is he FACING what he was dealt: his gun within `deg` of it */
  facing(gd: Guard, deg = 15): boolean { const J = this.onOf(gd); return !!J && !J.off && Math.abs(wrapAngle(yawTo(gd.char.pos, J.to) - gd.char.aimYaw)) < deg * Math.PI / 180; }
  /** one line for the console */
  summary(): string {
    if (!COVER.on) return 'cover: off';
    if (!this.men.length) return `cover: nobody free · ${this.openings.length} openings on the level`;
    const on = this.men.map(gd => `${gd.callsign} ${this.jobs.has(gd) ? this.nameOf(this.jobs.get(gd)!.o) : '—'}`).join(' · ');
    const open = this.live.filter(L => !L.by).map(L => `${this.nameOf(L.o)}${L.sam ? ' (player)' : L.held ? ' (posted)' : ''}`).join(', ');
    return `cover: ${on} · ${this.live.length} live${open ? ` · nobody on: ${open}` : ''} · ${this.stats.takes} takes, ${this.stats.swaps} swaps`;
  }
}
