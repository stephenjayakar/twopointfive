// A LANE THAT COST THEM (the maintainer, 10-11: "enemies do seem to run into held corridors a bit too eagerly, especially when they've already taken fire. was
// pretty easy to just hold a hallway and pick them off").
//
// What made them walk in: every way a defender is SENT somewhere in a room fight (the stock rally, Hard's press and its flankers, a squad's errand, the fight
// AI's own chase) is the shortest walk, and the only memory of a place that cost them was tactics.ts's kill-zone DOORWAY — one door frame, 25 s, never asked by
// a man on a scripted leg. A hallway the team holds from one end is neither. So five men in turn took the same hall past the same bodies.
//
// A LANE = a stretch of floor one gun covers: the wedge from where the fire came FROM, along the line to where it LANDED, as far as that gun has a line of fire
// (the level's own geometry and the door leaves as they stand) — and, within `fieldM` of that gun, everything else it has a line of fire to: men who know
// where a gun is know what it looks at, so the second and third ways in to the same guns do not each cost a man. One is opened by what a side has SUFFERED there: a man of theirs dropped by a round, or rounds
// passing a living man (`roundK` each: two near misses are a man's worth). ONE MODEL: the lane is nothing to anybody until a fit man of that side KNOWS of
// it — the man the rounds passed, or a mate with a line to where it happened, or (later) a man who comes on the bodies — and has had `callSecs` to say so on
// their net. Cut down before he could: nobody knows, and the next man walks in as before.
//
// WHAT THEY DO INSTEAD, once it is known and for `secs` after it last cost them (longer for every man lost in it):
//   · COME ANOTHER WAY: its floor is `dear` in every walk a man of that side plans (guards.ts goTo — the fight AI's hunters and the scripted legs of a press,
//     a flank or a squad's errand alike), so a way round is taken wherever the level has one.
//   · HOLD BACK: a man whose way still lies down it stops at the last floor out of its line and holds there with his gun on its mouth (followPath's gate →
//     RoomFight.laneStop), and while he is held no press and no noise AT THOSE GUNS takes him off it (`laneHolds`: they would send him at the same guns by
//     the same way; a fight somewhere else may have him). Nobody who knows of the lane walks over to a fight at its guns BY HIMSELF, held or not (`laneWarns`
//     in the stock rally — the one-at-a-time feed); a press may still take a man who is not held: together, by its own way. A man caught standing in it off his own post while rounds are still coming down it gets out of the line, to floor the guns do not see even
//     shifted a stride. A doorway drill (tactics.ts) is not stacked on a jamb the guns see through the opening (`laneCovers`), nor run through a
//     doorway whose far side is in their line — unless the charge that goes in first will burst on those guns (`laneDoor`).
//   · GO ROUND: with two or more held at its mouths, after a breath one (two of four) is sent at where the fire comes from by a way that never shows him to
//     that gun — if the level has one; the rest keep the mouths.
//   · HOLD IT AT TWO ANGLES, WITH FIRE (`pin`): a way round that would show its man to the guns too long is taken as far as where they would first see him; he
//     sets there, and the men held on the lane take turns putting a snap burst down it from their corners at where the fire came from (`flankTick`, `pinStep`).
//   · USE WHAT THEY CARRY: a man at a mouth with a stun charge on him (Hard's kit) and the guns in a throw's reach puts it down the lane, and the men on its
//     mouths go in behind the bang while it lasts — behind any stun charge OF THEIRS that bursts on those guns with nothing solid between, the doorway
//     drill's too (`bangs`: a side knows its own cans; the holders' own sends nobody). And a man held on a lane with a FRAGMENTATION GRENADE on him (`frag`,
//     10-13) throws it at the middle of where the lane's fire came from, his arm round the corner he is held at (`fragOut`, `fragStep`): his own throw —
//     frag.ts — wants a fresh fix of his own and a line his rifle has lost, and a man held short of a lane has neither. Nobody goes in behind that one.
//
// HOW LONG: `secs` after it last cost them — or `movedSecs` after every gun that made it has cost them from somewhere well away (`movedM`), or is down: the
// guns have moved. Its floor is read again against the doors and walls as they stand, a wedge each half second (a door shut across it, a wall blown open).
// WHAT THEY KNOW OF THE GUNS is where rounds that cost them left the muzzle (the shot events' own start points, as tactics.ts reads them) — exact, where a man
// would have a rough idea; nothing is known of a gun that has not cost them.
//
// What it is NOT: no man added, no hit point, no better aim, no dice of its own (the one roll is the round's own spread, drawn by fireWeapon for a burst from a corner), nothing an enemy could not have seen or been told. Only defenders in
// a room fight (team 'hostile' units while the fight is live); never the night game, a show, or a teammate (he is under orders). `LANES.on` off = nothing here
// runs = the build by run digest; the frozen harness stand holds it off (TPS_LANES=1).
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard, GameEvent } from './game';
import type { Item } from './throwables';
import { fightLive, ROOMFIGHT } from './roomfight';
import { goTo, roundPastColleague, startReloadBeat, tickReloadBeat } from './guards';
import { order } from './squad';
import { fireWeapon } from './combat';
import { shotEnergy } from './glasspen';
import { isHostile, teamOfId } from './teams';
import { run as legTo, loose } from './pressure';
import { giveStuns, stunsOf } from './tactics';
import { FRAG, fragFlee, fragReady, fragThrowAt, fragWinding, fragAway, armRound } from './frag';
import { placeName } from './dialogue';
import { CUES } from './cues';
import { doorwayInWay } from './doorway';
import { gunKeepsPost } from './gunroles';   // (called inside laneHolds only)

export const LANES = {
  /** the whole rule. Module default OFF (the frozen stand); the page raises it (src/host/profile.ts pageSwitches; `?nolanes` holds it off) */
  on: false,
  /** how long a lane is remembered after it last cost them — × the men lost in it, up to three */
  secs: 150,
  /** how far down its line a gun's lane runs, m · the half angle of the wedge about that line · floor this near the line is in it whatever the angle, m */
  reachM: 32, halfDeg: 22, widthM: 1.1,
  /** …and everything that gun has a line of fire to within this of it, whichever way: men who know where a gun is know what it looks at (0 = the line alone), m */
  fieldM: 12,
  /** floor this near the gun itself is not part of its lane (he is on top of it: that is a fight), m */
  ownM: 1,
  /** fire that landed nearer its gun than this opens no lane, m */
  minM: 2,
  /** a round passing within `nearM` of a living man is worth this much of a man dropped (1 = a lane) */
  roundK: 0.5, nearM: 1.5,
  /** the beat before a man who saw it acts on it himself · the beat he needs to get it said · how far a mate sees it happen, m · how near a man coming on the bodies knows what they mean, m */
  reactSecs: 0.35, callSecs: 0.9, seeM: 30, bodyM: 12,
  /** the price of a lane's floor in a walk (× plain floor) */
  dear: 14,
  /** how far along his way a walking man looks for a lane, m */
  aheadM: 3.5,
  /** an enemy he has seen this close inside the last second is a fight already: no gate, no backing out, m (never less than the distance the room fight itself
   *  breaks a walk off at for a man in sight) */
  closeM: 4.5,
  /** rounds down it inside this many seconds: a man standing in it off his post gets out of the line */
  hotSecs: 8,
  /** GO ROUND: on · how many of the men held at its mouths at most · the breath before anybody is sent · the longest way round, m · no sooner again, s */
  round: true, roundMen: 2, thinkSecs: 2.5, roundMaxM: 80, roundGap: 25,
  /** …and he may first show himself to the guns only this far round from the lane's own line, deg, and only for the last this much of his way, m */
  roundSideDeg: 55, roundShowM: 8,
  /** a place to stop is out of sight of the guns as they stood AND of a gun a stride to either side of each (they shift about), m */
  shiftM: 0.9,
  /** THE CHARGE: on · a throw's reach to the guns, m · a bang this near the guns has them blind, m · how long the lane is theirs to push down behind the bang, s · who goes (this near the guns), m · how much faster than a chase they go, m/s · no sooner again, s */
  stun: true, stunM: 12, bangM: 5, pushSecs: 6, pushM: 12, pushFast: 0.8, stunGap: 20,
  /** THE GUNS HAVE MOVED: once every gun that made a lane has cost them from further than `movedM` from it (or is down), it is forgotten `movedSecs` later, m · s */
  movedM: 15, movedSecs: 20,
  /** A LOOK ROUND THE CORNER (what they know of a lane is only as good as the last time it cost them): on · a lane quiet this long gets one, s · no sooner
   *  again — doubled for each look that found them still there, up to `peekMax`, s · after a look that cost the man, s · only a man held this near the lane's
   *  mouth goes, m · one of them in sight within this of where the fire came from = still held, m · how long he looks down an empty lane before he calls it
   *  clear, s · a look that showed the spots but not all the floor round them clears it only the second time running and only once it has been quiet this
   *  long, s · a lane seen still held is remembered at least this much longer, s */
  peek: true, peekQuiet: 10, peekGap: 15, peekMax: 60, peekLost: 45, peekReachM: 5, peekNearM: 10, peekLook: 0.8, peekSure: 45, peekKeep: 60,
  /** …he comes up to the corner at this pace, m/s, and looks round it with his head this far out past his feet, m (so the guns never get his chest for it) */
  peekPace: 1.3, peekLean: 0.35,
  /** HELD AT TWO ANGLES, WITH FIRE (off = a way round must hide its man to its last `roundShowM`, and the men at a lane's mouth only keep their guns on it):
   *  on · a way that comes at the guns from another side but would show its man for longer than that (up to `pinShowM`) is taken as far as where the guns
   *  would first see him: he STOPS there and says so — one more man held on the lane, from its other side. While a man is set there, the men held on the lane, either side, take turns stepping
   *  to their corners — gun already on where the fire came from — to put `pinRounds` down it at that place, one every `pinEvery` s, from where the muzzle first clears the corner, and get back within `pinSnap` s of that first line (no longer in the guns' sight than a look is — a man who stayed out a second and a half to fire was lost on 5 of 14 bursts): a burst no
   *  sooner than `pinGap` s after the last, `pinMax` of them, then `pinRest` s of quiet · a round goes wide by this (the round's own spread number: 0.24 = up
   *  to 1.2 m off the place at 10 m on each axis, on top of where his bore sits inside `pinAimDeg` — fire AT A PLACE to keep heads down, far wider than any aimed round of his; it can still hit a man who stands on it) ·
   *  his gun must be within this of the place before a round leaves, deg · his pace out, m/s */
  pin: true, pinRounds: 3, pinEvery: 0.12, pinSnap: 0.6, pinGap: 4, pinMax: 4, pinRest: 20, pinSpread: 0.24, pinAimDeg: 9, pinPace: 2,
  /** the longest end of a way round the guns may see, with this on, m · nobody fires from a corner nearer the guns than this, m */
  pinShowM: 12, pinMinM: 7,
  /** …AND GO IN UNDER IT (off: measured — over six holds on The block the run-in cost the defenders 7 more men and the team none): on the first round of a
   *  mate's burst the men set on the lane's other side run in at its guns */
  pinGo: false,
  /** THROUGH GLASS (off = every line of a lane asked at the sidearm's energy, as it was): a lane remembers the heaviest gun that made it, and its floor and
   *  'has one of their guns a line to this spot' are asked at that gun's energy — a rifle's lane goes through a pane a 9 mm's does not */
  glass: true,
  /** WHERE HE STOPS (off = planted where the gate caught him, as it was): never in a door's opening or sweep, never where a gun of the lane a stride to either
   *  side of where it fired from has him — he backs to cover first, and a held man since moved onto such floor backs out again; the point he watches is never
   *  nearer than `lookM`; a man whose own look cleared the lane is not planted on it afterwards */
  stopClear: true, lookM: 1.5,
  /** ROUNDS HE NOTICED (off = any round passing within `nearM` on the plan counts, as it was): a round past a LIVING man counts only once his own senses
   *  have it, inside `reactSecs` — it rattled him, he heard gunfire, or he was roused already; a quiet round over a calm man's head tells him nothing */
  roused: true,
  /** A GRENADE DOWN THE LANE THAT PINS HIM (the maintainer, 10-13, asked whether a defender pinned by a hallway hold should throw a frag down the corridor
   *  that pins him: "yeah, that makes sense". Off = he never does: his own throw — frag.ts — wants a fresh fix of his own and a line his rifle has lost, and a
   *  man held short of a lane has a watch point at his feet and no line at all): on · the breath after a lane is known before anybody thinks of it, s · no
   *  sooner again on a lane, s · nobody steps to a corner on it for a look or a burst, and no stun charge goes down it, until this long after it has gone
   *  off, s · how far he may walk while he gets it out (the wind-up's second, at a look's pace), m. Only a man who CARRIES one (frag.ts deals them: FRAG.defenders, one man in three, three a floor) and is held on the lane by this rule, at one of
   *  the places its fire came from, with everything frag.ts asks of any throw of his (the reach, the floor's gap between grenades, none of his own in it, no
   *  hostage by it, the shout and the second it takes him — shot in it, the grenade stays on his belt). He throws from behind the corner he is held at, his
   *  arm round it; with no arc from there he steps toward where the lane opens, no further than the first place his arm has one and never onto the
   *  lane's own floor (his arm goes into the guns' line, he does not), and goes back. */
  frag: true, fragThink: 4, fragGap: 30, fragLook: 1.5, fragStepM: 0.9,
  /** FROM HIS SHOUT TO THE THROW HE IS THIS RULE'S (10-15: on that day's build 2 of 14 men who shouted for a lane were taken by dig-in inside the wind-up's
   *  second — the room fight plants a man who has arrived, dig-in adopts a planted man and walks him to its cover — and said 'no — holding it!' a metre off
   *  their arc; that place is then never asked again by him). On = roomfight.ts keeps dig-in's hands off him until the grenade has left his hand or stayed in
   *  it (`laneThrows`: a second and a half at most; that file's once-a-frame bookkeeping for HIM waits that long too). Off = the build before it. */
  fragOwn: true,
  /** THE DOORWAY DRILL IS ASKED AGAIN (10-18: with every level's defenders in squads the men come to a hit room together, on the fight's own chase, and
   *  the doorway drill takes them at the door a mate has just dropped in — in the second before anybody has called the lane. The drill asked this rule once,
   *  as it took a man, and never again: on the maintainer's own hold of the records office two more men then sliced the same door into a lane their side had
   *  called six seconds before, one after the other). On = a man the drill has, who has not yet committed, is asked again each frame: his jamb, the
   *  station he is slicing to, or the floor past the doorway in a lane his side knows of, and the drill lets him go — this rule's gate then has him like any
   *  man whose way lies down it. A charge about to go in on those guns still goes (`laneDoor`'s own clause). Off = asked once, as it was. */
  drill: true,
  /** lanes a side keeps at once */
  max: 6,
};
export const LANES_DEFAULTS: typeof LANES = JSON.parse(JSON.stringify(LANES));

interface Lane {
  id: number;
  /** where the fire comes from · where it landed (the first cost) · the unit line between, on the plan */
  from: Vec3; at: Vec3; dx: number; dz: number;
  t0: number; lastT: number; until: number;
  /** what it has cost: men's worth (a near miss counts `roundK`) · men dropped in it */
  weight: number; downs: number;
  /** their side knows of it (said on their net) since */
  known: boolean; knownAt: number; lookAt: number;
  /** the muzzles that have fired down it (≤ 4, a stride or more apart): what a place to stop must be out of sight of */
  guns: Vec3[];
  /** who of the side saw it cost them, and when: a fit one acts on it himself `reactSecs` later and has it said on the net `callSecs` later · who knows it himself */
  saw: Map<Guard, number>; knowers: Set<Guard>;
  /** its floor: nav cell indices (made when it has cost a man's worth) · the wedges it was made of */
  cells: Set<number> | null; wedges: Vec3[];
  /** its floor being read again against the doors and walls as they stand now (one wedge each half second, swapped in when the last is read) */
  re: { set: Set<number>; i: number } | null;
  /** whose guns made it (character ids) · which of them have since cost the side from somewhere else */
  who: Set<number>; moved: Set<number>;
  roundAt: number; stunAt: number; pushUntil: number; can: { who: number; t: number; land: Vec3 } | null;
  /** the next look round the corner is due · looks taken that found it still held (each doubles the wait) */
  peekAt: number; peekN: number; peekPart: number;
  /** fire from its angles: the next burst is due · bursts of this volley · the id of the man who fired last (−1 none) */
  pinAt: number; pinN: number; pinBy: number;
  /** no grenade down it before this (LANES.frag; 0 with that off) */
  fragAt: number;
  /** the heaviest gun that made it, as glasspen.ts's energy (0 = not known: asked at the sidearm's, as every line was) */
  e: number;
}
/** a man out for a look: the lane · on his way to its mouth, or back · since · where he was held, what he watched from there, where he looks from · when he first had a line down it */
/** a man sent round to a lane's other side: on his way to where the guns would first see him · set there, holding it from that side · going in (`pinGo` only) · legs re-issued */
interface Flank { lane: number; phase: 'walk' | 'set' | 'go'; at: Vec3; t: number; n: number }
interface Peek { lane: number; phase: 'out' | 'back'; t: number; home: Vec3; look: Vec3; to: Vec3; lineT: number; eye?: Vec3;
  /** out to FIRE down it from his corner: rounds left of his burst · since his muzzle first had a line · the next round no sooner than · he has seen them still on it · when it last had a line */
  fire?: { n: number; t: number; next: number; saw: boolean; lineT: number };
  /** out to put a GRENADE down it: the place it is meant for, once he has shouted (null = still looking for an arc) · places asked so far · the next no sooner than · he could step to where the lane opens · he is on his way there · no floor of his own left toward it · a place had an arc but one of his own in its reach · when it should be out of his hand · how many had left his hand before */
  frag?: { at: Vec3 | null; k: number; next: number; walk: boolean; going: boolean; edge: boolean; own: boolean; until: number; had: number } }
interface State {
  lanes: Lane[]; serial: number;
  /** the floor of every lane the SIDE knows that is not being pushed down, 1 per nav cell (null = none) · bumped whenever any man's floor changes · a man's own
   *  floor where he knows a lane the net does not yet */
  mask: Uint8Array | null; ver: number; own: WeakMap<Guard, { ver: number; m: Uint8Array }>;
  seen: WeakSet<GameEvent>; banged: WeakSet<GameEvent>;
  /** per man: the lane he is held short of, a gate's last look, his post as first met, lines said */
  push: Map<Guard, number>; flank: Map<Guard, number>; flankOf: Map<Guard, Flank>; dropped: WeakSet<Guard>; failT: WeakMap<Guard, number>; skip: boolean; held: Map<Guard, { lane: number; t: number; look: Vec3; aimed: boolean; at: Vec3 }>; cans: Item[]; roll: number; due: { gd: Guard; lane: number; look: Vec3 }[]; look: WeakMap<Guard, number>; post: WeakMap<Guard, Vec3>; backT: WeakMap<Guard, number>; saidT: number; t: number; tickT: number;
  stats: { lanes: number; known: number; unknown: number; held: number; rerouted: number; backedOut: number; round: number; stuns: number; pushes: number; lapsed: number; peeks: number; peekThere: number; peekClear: number; peekLost: number; pins: number; pinRounds: number; pinLost: number; sets: number; goes: number; frags: number; fragLost: number; fragKept: number };
  /** the men out for a look round the corner (not kept across a load: he is planted where he stood, like the held) */
  peek: Map<Guard, Peek>;
  /** men whose magazine change a burst from a corner started: counted down here while they have nobody to shoot (not kept across a load) */
  reloads: Map<Guard, number>;   // (the man → his reload clock as this rule last left it: lanesTick)
  /** a man who looked for an arc for his grenade and found none: the lane, and the place it was meant for (LANES.frag; not kept across a load) */
  fragNo: WeakMap<Guard, { lane: number; at: Vec3 }>;
  /** rounds that passed a living man who had not noticed them yet (LANES.roused): counted if his senses have them inside `reactSecs`, else forgotten. Not saved */
  near: { gd: Guard; from: Vec3; at: Vec3; who: number; t: number }[];
}
const states = new SideMap<Game, State>('lanes.states');
const fresh = (): State => ({ lanes: [], serial: 0, mask: null, ver: 0, own: new SideMap(), seen: new SideSet(), banged: new SideSet(), push: new Map(), flank: new Map(), flankOf: new Map(), dropped: new SideSet(), failT: new SideMap(), skip: false, held: new Map(), cans: [], roll: 0, due: [], look: new SideMap(), post: new SideMap(), backT: new SideMap(), saidT: -100, t: -1, tickT: 0,
  stats: { lanes: 0, known: 0, unknown: 0, held: 0, rerouted: 0, backedOut: 0, round: 0, stuns: 0, pushes: 0, lapsed: 0, peeks: 0, peekThere: 0, peekClear: 0, peekLost: 0, pins: 0, pinRounds: 0, pinLost: 0, sets: 0, goes: 0, frags: 0, fragLost: 0, fragKept: 0 }, peek: new Map(), reloads: new Map(), fragNo: new SideMap(), near: [] });
const S = (g: Game): State => { let st = states.get(g); if (!st) { st = fresh(); states.set(g, st); } return st; };

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const SIDE = 'hostile' as const;
/** a man the rule is for: a defender of a live room fight, on his feet */
const mine = (g: Game, gd: Guard) => gd.team === SIDE && !!gd.unit && gd.state !== 'dead' && !gd.held;
const fit = (g: Game, gd: Guard) => mine(g, gd) && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil;
const live = (g: Game) => LANES.on && fightLive(g) && g.aiEnabled && !g.touring;
const eyeOf = (gd: Guard): Vec3 => gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.65, 0]);
const cellAt = (g: Game, p: Vec3) => { const n = g.col.nav; const x = Math.floor(p[0] / n.cell), z = Math.floor(p[2] / n.cell); return x < 0 || z < 0 || x >= n.W || z >= n.H ? -1 : z * n.W + x; };
const inMask = (g: Game, m: Uint8Array | null, p: Vec3) => { if (!m) return false; const i = cellAt(g, p); return i >= 0 && m[i] === 1; };
const knows = (L: Lane, gd: Guard) => L.known || L.knowers.has(gd);
const closeFight = (g: Game, gd: Guard) => { if (g.time - gd.lastSeenT >= 1) return false; const fc = gd.foe === 'player' ? g.player.char : gd.foe ? gd.foe.char : null; return !!fc && flat(gd.char.pos, fc.pos) < Math.max(LANES.closeM, ROOMFIGHT.moveEngageM); };
const pushing = (g: Game, st: State, gd: Guard) => { const t = st.push.get(gd); if (t === undefined) return false; if (g.time < t && gd.state !== 'dead') return true; st.push.delete(gd); return false; };
/** sent round at the guns (GO ROUND): his way is still priced, but the gate and the back-out leave him to it — he is meant to come out on them */
/** the energy a lane's lines of fire are asked at: its heaviest gun's, or nothing (collision.ts then asks at the sidearm's) */
const laneE = (L: Lane): number | undefined => LANES.glass && L.e > 0 ? L.e : undefined;
/** his own senses have the fire: roused already, a round since `t` rattled him (suppression.ts files it), a man of the team in his sight, gunfire in his ears */
const roused = (g: Game, gd: Guard, t: number) => gd.state === 'alert' || gd.state === 'search' || gd.awareness >= 0.3 || gd.sup.srcT >= t - 1e-6 || gd.lastSeenT >= t - 1 || (gd.witness.heard.lastShotT >= 0 && gd.witness.heard.lastShotT >= t - 2.5);
const flanking = (g: Game, st: State, gd: Guard) => { const t = st.flank.get(gd); if (t === undefined) return false; if (g.time < t && gd.state !== 'dead') return true; st.flank.delete(gd); if (st.flankOf.get(gd)?.phase !== 'set') st.flankOf.delete(gd); return false; };
const upId = (g: Game, id: number) => id === g.player.char.id ? g.player.char.alive : g.guards.some(o => o.char.id === id && o.state !== 'dead');
const defOf = (g: Game, gd: Guard) => g.fight.defs.find(d => d.gd === gd) ?? null;
const note = (g: Game, gd: Guard | null, what: string) => { const F = g.fight; F.log.push({ t: g.time, who: gd ? gd.callsign : '-', what: `[lanes] ${what}` }); if (F.log.length > 600) F.log.splice(0, 200); };

/** the floor one gun at `from` covers along the line to `at`: nav cells in the wedge with a line of fire from the gun */
function wedge(g: Game, into: Set<number>, from: Vec3, at: Vec3, e?: number) {
  const L = LANES, n = g.col.nav, c = n.cell; let dx = at[0] - from[0], dz = at[2] - from[2]; const len = Math.hypot(dx, dz); if (len < 0.5) return; dx /= len; dz /= len;
  const reach = Math.max(L.reachM, len + 2), cosH = Math.cos(L.halfDeg * Math.PI / 180), field = L.fieldM;
  const x0 = Math.max(0, Math.floor((from[0] - reach) / c)), x1 = Math.min(n.W - 1, Math.floor((from[0] + reach) / c)), z0 = Math.max(0, Math.floor((from[2] - reach) / c)), z1 = Math.min(n.H - 1, Math.floor((from[2] + reach) / c));
  const muzzle: Vec3 = [from[0], 1.4, from[2]], p: Vec3 = [0, 1.0, 0];
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = z * n.W + x; if (n.blocked[i] || into.has(i)) continue;
    const px = (x + 0.5) * c - from[0], pz = (z + 0.5) * c - from[2], d = Math.hypot(px, pz); if (d < L.ownM || d > reach) continue;
    if (d > field) { const along = px * dx + pz * dz; if (along <= 0) continue;
      if (along / d < cosH && Math.abs(px * dz - pz * dx) > L.widthM) continue; }
    p[0] = px + from[0]; p[2] = pz + from[2];
    if (!g.col.shotBlocked(muzzle, p, undefined, e)) into.add(i);
  }
}
function remask(g: Game, st: State) {
  const n = g.col.nav; let m: Uint8Array | null = null;
  for (const L of st.lanes) { if (!L.known || !L.cells) continue; m ??= new Uint8Array(n.W * n.H); for (const i of L.cells) m[i] = 1; }
  st.mask = m; st.ver++;
}
/** the floor of every lane THIS man knows of (the net's, and what he has seen for himself and not yet had said) */
function maskOf(g: Game, st: State, gd: Guard): Uint8Array | null {
  let own = false; for (const L of st.lanes) if (!L.known && L.cells && L.knowers.has(gd)) { own = true; break; }
  if (!own) return st.mask;
  const c = st.own.get(gd); if (c && c.ver === st.ver) return c.m;
  const m = st.mask ? st.mask.slice() : new Uint8Array(g.col.nav.W * g.col.nav.H);
  for (const L of st.lanes) if (!L.known && L.cells && L.knowers.has(gd)) for (const i of L.cells) m[i] = 1;
  st.own.set(gd, { ver: st.ver, m }); return m;
}
/** one of a lane's guns has a line of fire to a man standing at `p` */
function gunOn(g: Game, L: Lane, p: Vec3, wide = 0): boolean {
  const q: Vec3 = [p[0], 1.1, p[2]], n = g.col.nav, e = laneE(L);
  for (const m of L.guns) {
    const d = flat(m, p); if (d > LANES.reachM || d < 0.3) continue; if (!g.col.shotBlocked([m[0], 1.4, m[2]], q, undefined, e)) return true;
    if (wide > 0) { const sx = -(p[2] - m[2]) / d * wide, sz = (p[0] - m[0]) / d * wide;   // (the same gun a stride to either side, where there is floor to stand on)
      for (const k of [1, -1]) { const a: Vec3 = [m[0] + sx * k, 1.4, m[2] + sz * k], i = cellAt(g, a); if (i < 0 || n.blocked[i] || g.col.shotBlocked([m[0], 1.4, m[2]], a)) continue; if (!g.col.shotBlocked(a, q, undefined, e)) return true; } }
  }
  return false;
}
/** the lane this man knows of that a point of floor lies in (null = none) */
function laneAt(g: Game, st: State, p: Vec3, gd: Guard): Lane | null { const i = cellAt(g, p); if (i < 0) return null; for (const L of st.lanes) if (knows(L, gd) && L.cells?.has(i)) return L; return null; }
/** …or whose guns have a line to it (the floor beside the wedge is no cover) */
function laneOn(g: Game, st: State, p: Vec3, gd: Guard): Lane | null { const L = laneAt(g, st, p, gd); if (L) return L; for (const x of st.lanes) if (knows(x, gd) && x.cells && gunOn(g, x, p)) return x; return null; }

/** what a side has just suffered: fire from `from` landed at `at` — on a man dropped (`down`) or past a living one */
function cost(g: Game, st: State, from: Vec3, at: Vec3, man: Guard, down: boolean, who: number) {
  const K = LANES, len = flat(from, at); if (len < K.minM) return;   // (shot at arm's length is a fight, not a lane)
  const dx = (at[0] - from[0]) / len, dz = (at[2] - from[2]) / len, cosM = Math.cos((K.halfDeg + 12) * Math.PI / 180);
  let L = st.lanes.find(x => x.dx * dx + x.dz * dz > cosM && x.guns.some(m => flat(m, from) <= 5)) ?? null;
  if (!L) {
    L = { id: ++st.serial, from: [from[0], 0, from[2]], at: [at[0], 0, at[2]], dx, dz, t0: g.time, lastT: g.time, until: 0, weight: 0, downs: 0, known: false, knownAt: -1, lookAt: 0, guns: [], saw: new Map(), knowers: new Set(), cells: null, wedges: [], re: null, who: new Set(), moved: new Set(), roundAt: 0, stunAt: 0, pushUntil: -1, can: null, peekAt: 0, peekN: 0, peekPart: 0, pinAt: 0, pinN: 0, pinBy: -1, fragAt: 0, e: 0 };
    st.lanes.push(L); st.stats.lanes++;
  }
  // its guns, least lately fired first (≤ 4: the stalest is forgotten); where the fire comes FROM is the one that fired last — the holders shift about
  const gi = L.guns.findIndex(m => flat(m, from) < 1.5); let gun = false;
  if (gi < 0) { L.guns.push([from[0], 0, from[2]]); if (L.guns.length > 4) L.guns.shift(); gun = true; } else if (gi < L.guns.length - 1) L.guns.push(L.guns.splice(gi, 1)[0]);
  L.from = v3.copy(L.guns[L.guns.length - 1]);
  L.weight += down ? 1 : K.roundK; if (down) L.downs++; L.lastT = g.time;
  L.who.add(who); L.moved.delete(who);
  if (K.glass) { const c = who === g.player.char.id ? g.player.char : g.guards.find(o => o.char.id === who)?.char, e = c ? shotEnergy(g, c) : undefined; if (e !== undefined && e > L.e) L.e = e; }   // (the gun in his hands as the round left: what a pane is to this lane)
  // THE GUNS HAVE MOVED: a gun that made another lane has now cost them from well away from it — once all of that lane's have, it is not held for long
  for (const X of st.lanes) if (X !== L && X.who.has(who) && X.guns.every(m => flat(m, from) > K.movedM)) { X.moved.add(who); if (X.moved.size >= X.who.size) X.until = Math.min(X.until, g.time + K.movedSecs); }
  if (down && L.known) note(g, man, `lane ${L.id}: another down in it (${L.downs})`);
  L.until = g.time + K.secs * Math.min(3, Math.max(1, L.downs));
  if (st.lanes.length > K.max) {   // (one too many: the one that matters least goes — a few stray rounds before a lane, an unsaid one before one on the net, then the one longest quiet; the newcomer itself if that is it)
    const rank = (x: Lane) => (x.known ? 2 : 0) + (x.weight >= 1 ? 1 : 0); let o = 0;
    for (let i = 1; i < st.lanes.length; i++) { const a = st.lanes[i], b = st.lanes[o]; if (rank(a) < rank(b) || (rank(a) === rank(b) && a.lastT < b.lastT)) o = i; }
    const gone = st.lanes.splice(o, 1)[0]; st.stats.lapsed++; if (gone.known) note(g, null, `lane ${gone.id}: dropped for a newer one`); if (gone.cells) remask(g, st);
    if (gone === L) return;
  }
  if (L.weight < 1) return;
  if (!L.cells) {   // (the gun that fired now; what its other guns cover is read in by the roll, a wedge each half second — never four on one frame)
    L.cells = new Set(); L.wedges.push([from[0], 0, from[2]], [at[0], 0, at[2]]); wedge(g, L.cells, from, at, laneE(L));
    for (const m of L.guns) if (flat(m, from) >= 1.5) L.wedges.push(v3.copy(m), [at[0], 0, at[2]]);
    if (L.wedges.length > 2) L.re = { set: new Set(L.cells), i: 2 };
    if (L.known) remask(g, st); else st.ver++; }
  else if (L.wedges.length < 16 && (gun || !L.cells.has(cellAt(g, at)))) { L.wedges.push([from[0], 0, from[2]], [at[0], 0, at[2]]); wedge(g, L.cells, from, at, laneE(L)); if (L.known) remask(g, st); else st.ver++; }   // (it reaches further, or wider, or from another gun, than they knew)
  // who of them saw it: the man the rounds passed, and every fit mate with a line to where it happened
  if (!L.known) for (const o of g.guards) { if (!fit(g, o) || L.saw.has(o)) continue; if (o === man || sees(g, o, at, K.seeM)) L.saw.set(o, g.time); }
}
/** a fit man of the side has a line to what happened at `at`, inside `reach` and not behind his back */
function sees(g: Game, o: Guard, at: Vec3, reach: number): boolean {
  const d = flat(o.char.pos, at); if (d >= reach) return false;
  if (d > 4) { const f = o.char.forward(); if (((at[0] - o.char.pos[0]) * f[0] + (at[2] - o.char.pos[2]) * f[2]) / d < -0.35) return false; }
  return !g.col.segmentBlocked(eyeOf(o), [at[0], 0.9, at[2]]);
}
function becomeKnown(g: Game, st: State, L: Lane, who: Guard) {
  L.known = true; L.knownAt = g.time; L.saw.clear(); L.cells ??= new Set();
  L.roundAt = g.time + LANES.thinkSecs; L.stunAt = g.time + LANES.thinkSecs; if (LANES.frag) L.fragAt = g.time + LANES.fragThink;
  remask(g, st); st.stats.known++;
  const where = CUES.on ? placeName(g.level, L.at) : null;
  g.say(who, where ? `they've got it covered — ${where}! stay out of their line!` : 'they\'ve got that way covered — stay out of their line!', true); st.saidT = g.time;
  note(g, who, `lane ${L.id}: called — fire from (${L.from[0].toFixed(1)}, ${L.from[2].toFixed(1)}) down to (${L.at[0].toFixed(1)}, ${L.at[2].toFixed(1)}), ${L.cells.size} cells, ${L.downs} down`);
}

/** this frame's rounds (the shot events' own muzzle → impact segments, as tactics.ts reads them): who of the side they dropped, whom they passed */
function readRounds(g: Game, st: State) {
  for (const e of g.events) {
    if (st.seen.has(e)) continue; st.seen.add(e);
    if ((e.kind !== 'shot' && e.kind !== 'guardShot') || !e.from || !e.to || e.who === undefined) continue;
    if (!isHostile(SIDE, teamOfId(g, e.who))) continue;
    const a = e.from, b = e.to, sx = b[0] - a[0], sz = b[2] - a[2], L2 = sx * sx + sz * sz; if (L2 < 4) continue;
    for (const gd of g.guards) {
      if (gd.team !== SIDE || !gd.unit || gd.held) continue;
      const dead = gd.state === 'dead'; if (dead && (st.dropped.has(gd) || !(gd.diedAt >= e.time - 1e-6 && gd.diedAt <= g.time))) continue;   // (dropped by this very round — counted once, however many rounds were in the air — or standing)
      const p = dead ? (gd.char.bones.hips ?? gd.char.pos) : gd.char.pos;
      const len = Math.sqrt(L2), t = ((p[0] - a[0]) * sx + (p[2] - a[2]) * sz) / L2; if (t * len < 1 || t * len > len + (dead ? 1.2 : 0.4)) continue;   // (a round that stopped in him ends at his chest: his hips lie a little past it)
      const d = Math.hypot(a[0] + sx * t - p[0], a[2] + sz * t - p[2]); if (d > (dead ? 1.0 : LANES.nearM)) continue;
      if (dead) st.dropped.add(gd);
      else { const u = Math.min(1, Math.max(0, t)); if (g.col.shotBlocked([a[0] + sx * u, 1.2, a[2] + sz * u], [p[0], 1.2, p[2]])) continue; }   // (a round that passed on the far side of a wall passed nobody)
      if (!dead && LANES.roused && !roused(g, gd, e.time)) { st.near.push({ gd, from: v3.copy(a), at: v3.copy(p), who: e.who, t: e.time }); continue; }   // (not his yet: his senses get `reactSecs` to have it)
      cost(g, st, a, p, gd, dead, e.who);
    }
  }
}

/** once a frame, after the room fight's own tick and before anybody walks */
export function lanesTick(g: Game, dt: number) {
  if (!live(g)) { const st = states.get(g); if (st && (st.lanes.length || st.held.size || st.peek.size || st.reloads.size || st.near.length)) lanesReset(g); return; }
  const K = LANES; let st = S(g);
  if (g.time < st.t) { lanesReset(g); st = S(g); }   // (the clock has gone back: a load — nothing kept across it but what a restore puts back)
  st.t = g.time;
  if (st.skip) { st.skip = false; for (const e of g.events) { st.seen.add(e); st.banged.add(e); } }   // (the events a load put back were read before the file was made)
  // the men the gate stopped last frame: planted where they stand, gun on the lane's mouth (done here, between frames of walking — never inside a man's own step)
  if (st.due.length) { const due = st.due; st.due = []; for (const d of due) plantShort(g, st, d.gd, d.lane, d.look); }
  for (const it of g.items.items) if (it.kind === 'flash' && !it.fired && it.who !== undefined && !st.cans.includes(it) && teamOfId(g, it.who) === SIDE) st.cans.push(it);   // (their own charges in the air: a side knows whose can it was that burst)
  readRounds(g, st); bangs(g, st);
  if (st.near.length) st.near = st.near.filter(n => {   // rounds that passed a man who had not noticed them: his once his senses have them, nobody's after a beat
    if (!mine(g, n.gd)) return false;   // (dropped since: the round that dropped him is the one that counts)
    if (roused(g, n.gd, n.t)) { cost(g, st, n.from, n.at, n.gd, false, n.who); return false; }
    return g.time - n.t < K.reactSecs;
  });
  if (st.cans.length) st.cans = st.cans.filter(it => !it.fired && g.items.items.includes(it));   // (a spent can lies on the floor a minute: it is nobody's bang any more)
  let changed = false;
  for (const L of st.lanes) {
    if (!L.known) for (const [o, t] of L.saw) {
      if (!mine(g, o)) { L.saw.delete(o); continue; }   // (cut down before he could act on it or say it)
      if (!fit(g, o)) continue;
      if (!L.knowers.has(o) && g.time >= t + K.reactSecs) { L.knowers.add(o); st.ver++; }
      if (g.time >= t + K.callSecs) { becomeKnown(g, st, L, o); break; }
    }
    // a lane that cost a man nobody lived to tell of: a fit man who comes on the place (the bodies) knows what it means
    if (!L.known && L.weight >= 1) for (const o of g.guards) if (fit(g, o) && !L.saw.has(o) && sees(g, o, L.at, K.bodyM)) L.saw.set(o, g.time);
    if (L.pushUntil >= 0 && g.time >= L.pushUntil) L.pushUntil = -1;
    if (L.can && g.time - L.can.t > 5) L.can = null;
  }
  const n0 = st.lanes.length; st.lanes = st.lanes.filter(L => { const keep = L.weight >= 1 ? g.time < L.until : g.time - L.lastT < 10; if (!keep && !L.known && L.weight >= 1) st.stats.unknown++; if (!keep && L.known) note(g, null, `lane ${L.id}: forgotten (${L.downs} down, last round ${(g.time - L.lastT).toFixed(0)} s ago)`); return keep; });   // (a few rounds past a man and no more: forgotten in ten seconds)
  if (st.lanes.length !== n0) { st.stats.lapsed += n0 - st.lanes.length; changed = true; }
  if (changed) remask(g, st);
  if (st.peek.size) for (const [gd, p] of [...st.peek]) peekStep(g, st, gd, p);
  // a magazine change this rule started behind his corner: the guard code counts a reload down only for a man with somebody to shoot — a man held on a lane has nobody, so it is counted here.
  // ONE COUNT A FRAME: the guard code also counts one for a man with his head down under fire or putting rounds into cover, whatever he sees — a clock that has moved since
  // this rule last left it is being counted by somebody else, and is theirs for as long as it keeps moving (it was counted here as well: a magazine changed in half the time).
  // The hand-over is a frame out either way: the frame they start is counted by both (this tick runs before a man's own update), the frame after they stop by neither
  if (st.reloads.size) for (const [gd, left] of [...st.reloads]) {
    if (gd.state === 'dead' || gd.held || gd.reloadT < 0) { st.reloads.delete(gd); continue; }   // (in somebody's arm his hands are not on a magazine)
    if (gd.reloadT === left && g.time - gd.lastSeenT > 0.5) tickReloadBeat(g, gd, dt);
    if (gd.reloadT < 0) st.reloads.delete(gd); else st.reloads.set(gd, gd.reloadT);
  }
  st.tickT -= dt; if (st.tickT > 0) return; st.tickT = 0.5;
  for (const [gd, h] of st.held) {
    const D = defOf(g, gd);
    if (!D || !mine(g, gd) || !st.lanes.some(L => L.id === h.lane) || D.mode === 'free') { st.held.delete(gd); continue; }
    if (h.aimed) {
      if (D.mode !== 'hold' || flat(gd.char.pos, h.at) > 2.5) { st.held.delete(gd); continue; }   // (somebody else has moved him since: no longer this rule's man)
      // …moved a step all the same (the doorway's manners, a shove) onto floor a gun of the lane has, or left in a doorway: out of it again
      if (K.stopClear && fit(g, gd) && !closeFight(g, gd) && !pushing(g, st, gd) && !flanking(g, st, gd) && !st.flankOf.has(gd) && !st.peek.has(gd) && g.time - gd.lastSeenT > 1 && g.time - (st.backT.get(gd) ?? -100) > 6) {   // (never a man set on the lane's other side: his place a step short of their line is the errand's own)
        const L = st.lanes.find(x => x.id === h.lane); if (L && knows(L, gd) && (doorwayInWay(g, gd.char.pos) || gunOn(g, L, gd.char.pos, K.shiftM)) && !backOut(g, st, gd, L)) st.backT.set(gd, g.time);   // (no cover found: asked again in six seconds, not every tick)
      }
      continue;
    }
    if (D.mode === 'move') { const sg = gd.script?.goal; if (!sg || flat(sg, h.at) > 0.8) st.held.delete(gd); continue; }   // (on his way to cover — or sent elsewhere meanwhile: then the gate has him again like anybody)
    h.aimed = true; h.at = v3.copy(gd.char.pos);
    if (fit(g, gd) && g.time - gd.lastSeenT > 1) { g.fight.laneStop(gd, h.look); st.stats.held++; }   // (backed out to cover and arrived: his gun on the lane's mouth — unless he has a man in his sights, which is the fight's)
  }
  // a lane's floor is kept true to the doors and walls as they stand: one wedge read again each half second, its floor swapped when the last is in
  { const Ls = st.lanes.filter(L => L.cells && L.wedges.length >= 2);
    if (Ls.length) { const L = Ls[st.roll++ % Ls.length], r = L.re ??= { set: new Set(), i: 0 };
      if (r.i + 1 < L.wedges.length) { wedge(g, r.set, L.wedges[r.i], L.wedges[r.i + 1], laneE(L)); r.i += 2; }
      if (r.i + 1 >= L.wedges.length) { L.cells = r.set; L.re = null; if (L.known) remask(g, st); else st.ver++; } } }
  // a gun that made a lane and is down has moved for good
  for (const L of st.lanes) { let cut = false; for (const id of L.who) if (!upId(g, id)) { L.who.delete(id); L.moved.delete(id); cut = true; } if (cut && L.moved.size >= L.who.size) L.until = Math.min(L.until, g.time + K.movedSecs); }
  for (const D of g.fight.defs) if (!st.post.has(D.gd)) st.post.set(D.gd, v3.copy(D.station));
  if (st.flankOf.size) for (const [gd, f] of [...st.flankOf]) if (!st.lanes.some(L => L.id === f.lane && L.known)) st.flankOf.delete(gd);   // (the lane forgotten under them)
  for (const L of st.lanes) {
    if (!L.known || g.time < L.pushUntil) continue;
    const at = heldAt(g, st, L);
    if (K.stun && g.time >= L.stunAt && at.length) stun(g, st, L, at);
    if (K.round && g.time >= L.roundAt && !L.can) { const free = st.flankOf.size ? at.filter(x => !st.flankOf.has(x)) : at; if (free.length >= 2) round(g, st, L, free); }
    if (K.frag && L.fragAt > 0 && g.time >= L.fragAt && !L.can) fragOut(g, st, L, at);
    if (st.flankOf.size) flankTick(g, st, L);
    if (K.peek && g.time >= L.peekAt && !L.can && g.time - L.lastT > K.peekQuiet && g.time - L.knownAt > K.peekQuiet) peekStart(g, st, L);
  }
  // a man standing where a lane's guns have him — rounds still coming down it, or the guns in his own sight — and not on his own post: out of the line
  for (const D of g.fight.defs) {
    const gd = D.gd; if (D.mode === 'move' || !fit(g, gd) || closeFight(g, gd) || pushing(g, st, gd) || flanking(g, st, gd) || st.peek.has(gd) || g.time - (st.backT.get(gd) ?? -100) < 6) continue;
    if (D.mode === 'hold' && flat(gd.char.pos, st.post.get(gd) ?? gd.char.pos) < 3) continue;   // (his own post: the room fight's to defend, not this rule's to move)
    const L = laneOn(g, st, gd.char.pos, gd); if (!L) continue;
    if (g.time - L.lastT > K.hotSecs && g.time - gd.lastSeenT > 1) continue;
    backOut(g, st, gd, L);
  }
}
/** the men held at a lane's mouths, on their feet and with nobody on them */
function heldAt(g: Game, st: State, L: Lane): Guard[] { const out: Guard[] = []; for (const [gd, h] of st.held) if (h.lane === L.id && fit(g, gd) && g.time - gd.lastSeenT > 1.5 && g.time - h.t > 1) out.push(gd); return out; }

function backOut(g: Game, st: State, gd: Guard, L: Lane): boolean {
  const D = defOf(g, gd); if (!D || g.time - (st.failT.get(gd) ?? -100) < 2) return false;
  const n = g.col.nav, W = n.W, m = maskOf(g, st, gd) ?? new Uint8Array(0); const s = cellAt(g, gd.char.pos); if (s < 0) return false;
  const memo = new Map<number, boolean>();
  const cover = (i: number) => { let v = memo.get(i); if (v === undefined) { const c: Vec3 = [(i % W + 0.5) * n.cell, 0, (((i / W) | 0) + 0.5) * n.cell]; v = !m[i] && !gunOn(g, L, c, LANES.shiftM) && !(LANES.stopClear && doorwayInWay(g, c)); memo.set(i, v); } return v; };
  // the nearest floor out of every lane he knows and out of this one's guns' sight, by walking (breadth first, no corner cut, ≤ 10 m)
  const deep = (i: number) => { const cx = i % W, cz = (i / W) | 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= n.H) continue; const j = z * W + x; if (!n.blocked[j] && !cover(j)) return false; } return true; };
  const seen = new Set<number>([s]); let q = [s], found = -1, first = -1, firstD = 0;
  for (let depth = 0; depth < 20 && found < 0 && q.length; depth++) {
    const nx: number[] = [];
    for (const c of q) { const cx = c % W, cz = (c / W) | 0;
      for (let dz = -1; dz <= 1 && found < 0; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= n.H) continue;
        const i = z * W + x; if (n.blocked[i] || seen.has(i)) continue; if (dx && dz && (n.blocked[cz * W + x] || n.blocked[z * W + cx])) continue;
        seen.add(i); if (cover(i)) { if (first < 0) { first = i; firstD = depth; } if (deep(i)) { found = i; break; } } nx.push(i);
      } }
    q = nx; if (first >= 0 && depth - firstD >= 6) break;   // (no deeper cover within three metres of its edge: the edge it is)
  }
  if (found < 0) found = first; if (found < 0) { st.failT.set(gd, g.time); return false; }   // (no cover in reach: asked again in two seconds, not every step)
  const spot: Vec3 = [(found % W + 0.5) * n.cell, 0, (((found / W) | 0) + 0.5) * n.cell];
  // (a step further from the lane than its very edge, where the floor allows: the same direction once more)
  { const ex = spot[0] - gd.char.pos[0], ez = spot[2] - gd.char.pos[2], el = Math.hypot(ex, ez) || 1; const far: Vec3 = [spot[0] + ex / el * 0.6, 0, spot[2] + ez / el * 0.6]; const fi = cellAt(g, far); if (fi >= 0 && !n.blocked[fi] && cover(fi)) { spot[0] = far[0]; spot[2] = far[2]; } }
  st.backT.set(gd, g.time); st.held.set(gd, { lane: L.id, t: g.time, look: mouthOf(g, L, spot), aimed: false, at: v3.copy(spot) }); st.stats.backedOut++;
  gd.path = []; gd.pathGoal = null; legTo(g, D, spot, null, 0.3);
  if (g.time - st.saidT > 4) { st.saidT = g.time; g.say(gd, 'get back — out of their line!', true); }
  note(g, gd, `lane ${L.id}: in their line, backs out to (${spot[0].toFixed(1)}, ${spot[2].toFixed(1)})`);
  return true;
}

/** GO ROUND: of the men held at a lane's mouths, the one (two of four) with the shortest way to the guns that never shows him to them */
function round(g: Game, st: State, L: Lane, at: Guard[]) {
  const K = LANES; L.roundAt = g.time + 10;   // (asked again while there is no way — a path search a man, so not often; a real go waits `roundGap`)
  const pen = priceOf(g, st.mask, undefined); if (!pen) return;
  const ways: { gd: Guard; len: number; pin: boolean; stop: Vec3 | null }[] = []; let why = '';
  for (const gd of at) {
    if (st.flankOf.has(gd)) continue;   // (already round, set on the lane's other side: he holds it from there)
    const p = g.col.nav.findPath(gd.char.pos, L.from, 8000, pen); if (!p || !p.length) { why += ` ${gd.callsign}: no way;`; continue; }
    if (flat(p[p.length - 1], L.from) > 2.5) { why += ` ${gd.callsign}: no way to the guns;`; continue; }
    let len = 0, a = gd.char.pos, show: Vec3 | null = null, shown = 0, pin = false; const pts: Vec3[] = [];
    for (const b of p) { const d = flat(a, b), k = Math.max(1, Math.ceil(d / 0.4)); if (!show) for (let i = 1; i <= k; i++) { const q: Vec3 = [a[0] + (b[0] - a[0]) * i / k, 0, a[2] + (b[2] - a[2]) * i / k]; if (inMask(g, st.mask, q)) { show = q; shown = len + d * i / k; break; } pts.push(q); } len += d; a = b; }
    const stop = show && pts.length >= 4 ? pts[pts.length - 3] : null;   // (where he sets: a stride short of where the guns would first have him)
    if (len > K.roundMaxM) { why += ` ${gd.callsign}: ${len.toFixed(0)} m, too far;`; continue; }
    // where the guns first have him on that way: only the last stretch of it, and round from the lane's own line (a flank, not the same walk a stride to one side)
    if (show) { const sd = flat(show, L.from), ll = flat(L.from, L.at) || 1, lx = (L.at[0] - L.from[0]) / ll, lz = (L.at[2] - L.from[2]) / ll, cs = ((show[0] - L.from[0]) * lx + (show[2] - L.from[2]) * lz) / (sd || 1);
      pin = len - shown > K.roundShowM;   // (shown to the guns for longer than a man walks in their sight: a way only as far as where they would first see him)
      if (len - shown > (K.pin ? Math.max(K.roundShowM, K.pinShowM) : K.roundShowM) || sd > K.fieldM + 1 || cs > Math.cos(K.roundSideDeg * Math.PI / 180)) { why += ` ${gd.callsign}: ${len.toFixed(0)} m, shown the last ${(len - shown).toFixed(0)} m, ${(Math.acos(Math.max(-1, Math.min(1, cs))) * 180 / Math.PI).toFixed(0)}° round;`; continue; } }
    if (pin && !stop) { why += ` ${gd.callsign}: no floor to stop on short of their sight;`; continue; }
    ways.push({ gd, len, pin, stop });
  }
  if (!ways.length) { note(g, null, `lane ${L.id}: no way round —${why}`); return; }
  ways.sort((a, b) => a.len - b.len || a.gd.char.id - b.gd.char.id);
  let n = Math.min(K.roundMen, ways.length, Math.max(1, at.length - 1), at.length >= 4 ? 2 : 1);
  // a way that ends at a second angle is taken only if one of the men who stay can fire from the first (placed for his corner, rounds in his gun); else the ways that hide their man to the end
  if (ways.slice(0, n).some(w => w.pin) && !stepper(g, st, L, new Set(ways.slice(0, n).map(w => w.gd)), true, K.pinMinM)) {   // (no mate who stays is placed to fire from the first side)
    const bare = ways.filter(w => !w.pin); if (!bare.length) { note(g, null, `lane ${L.id}: a way to its other side, but nobody placed to fire from this one —${why}`); return; }
    ways.length = 0; ways.push(...bare); n = Math.min(n, ways.length);
  }
  for (let i = 0; i < n; i++) {
    const gd = ways[i].gd, D = defOf(g, gd), stop = ways[i].stop; if (!D) continue;
    st.held.delete(gd); st.flank.set(gd, g.time + Math.min(60, ways[i].len / 2 + 10));
    if (ways[i].pin && stop) {   // its end too long in their sight to walk: as far as where the guns would first see him, to hold the lane from that side
      st.flankOf.set(gd, { lane: L.id, phase: 'walk', at: stop, t: g.time, n: 0 }); gd.path = []; gd.pathGoal = null; legTo(g, D, stop, null, 0); gd.lastKnown = v3.copy(L.from); st.stats.round++;
      if (i === 0) { g.say(gd, 'going round — keep them looking your way!', true); st.saidT = g.time; }
      note(g, gd, `lane ${L.id}: goes round, ${ways[i].len.toFixed(0)} m, as far as (${stop[0].toFixed(1)}, ${stop[2].toFixed(1)}) on its other side`);
      continue;
    }
    loose(g, D, L.from); gd.lastKnown = v3.copy(L.from); st.stats.round++;   // (his way stays priced — the way round — but nothing here stops him short of the guns he was sent at)
    if (i === 0) { g.say(gd, 'going round — keep them looking your way!', true); st.saidT = g.time; }
    note(g, gd, `lane ${L.id}: goes round, ${ways[i].len.toFixed(0)} m`);
  }
  L.roundAt = g.time + K.roundGap;
}

/** THE CHARGE: a man at a mouth with a stun charge on him and the guns in a throw's reach puts it down the lane */
function stun(g: Game, st: State, L: Lane, at: Guard[]) {
  const K = LANES; L.stunAt = g.time + 2;
  for (const o of g.guards) if (o.team === SIDE && o.state !== 'dead' && flat(o.char.pos, L.from) < 6) return;   // (one of theirs is on the guns already: not on his head)
  let best: Guard | null = null, bd = K.stunM;
  for (const gd of at) { if (stunsOf(gd) <= 0) continue; const d = flat(gd.char.pos, L.from); if (d < bd && d > 4) { best = gd; bd = d; } }
  if (!best) return;
  const c = best.char, tx = L.from[0] - c.pos[0], tz = L.from[2] - c.pos[2], tl = Math.hypot(tx, tz);
  // his arm round the corner he holds: the can leaves his hand half a pace toward the lane's line, and is asked to land short of the guns, in their eyes
  const from = armRound(g, c.pos, mouthOf(g, L, c.pos));
  const land: Vec3 = [L.from[0] - tx / tl * 1.6, 0, L.from[2] - tz / tl * 1.6];
  const sol = g.items.solve(from, land, 11);
  if (flat(sol.land, land) > 3 || flat(sol.land, L.from) > 4.5) return;   // (no arc from here: a wall, a lintel, too far)
  giveStuns(best, stunsOf(best) - 1); c.anim.throwItem(flat(c.pos, sol.land), Math.hypot(sol.v0[0], sol.v0[2]));
  const it = g.items.spawn('flash', from, sol.v0, { fuse: 0.7, who: c.id, heading: v3.yawOf(sol.v0) });
  it.onBounce = (sp, p, g) => g.audio.play('canisterBounce', p, Math.min(1, sp / 4));
  g.audio.play('throw', from, 0.7);
  L.can = { who: c.id, t: g.time, land: v3.copy(sol.land) }; L.stunAt = g.time + K.stunGap; st.stats.stuns++;
  g.say(best, 'bang out — on me!', true); st.saidT = g.time;
  note(g, best, `lane ${L.id}: a charge down it toward (${land[0].toFixed(1)}, ${land[2].toFixed(1)})`);
}
/** a stun charge of THEIRS has gone off on a lane's guns (the 'bang' names nobody, but a side knows its own cans: the ones it had in the air are followed
 *  to where they burst), within `bangM` of where the fire comes from and with nothing solid between: the lane is theirs for `pushSecs`, and the men on its
 *  mouths near enough to get there go. The holders' own can, or one that burst behind a wall from them, sends nobody. */
function bangs(g: Game, st: State) {
  const K = LANES;
  for (const e of g.events) {
    if (e.kind !== 'bang' || e.frag || st.banged.has(e)) continue; st.banged.add(e);
    const ours = st.cans.some(it => flat(it.pos, e.pos) < 1.5), b: Vec3 = [e.pos[0], Math.max(0.5, e.pos[1]), e.pos[2]];
    for (const L of st.lanes) {
      if (!L.known || g.time < L.pushUntil) continue;
      const near = ours && L.guns.some(m => flat(e.pos, m) < K.bangM && !g.col.solidBlocked(b, [m[0], 1.5, m[2]]));
      if (!near) { if (L.can && g.time - L.can.t < 4 && flat(e.pos, L.can.land) < 3) { note(g, null, `lane ${L.id}: the charge fell short, nobody goes`); L.can = null; } continue; }
      L.can = null; L.pushUntil = g.time + K.pushSecs; L.roundAt = Math.max(L.roundAt, L.pushUntil + 2); st.stats.pushes++;
      const to: Vec3 = [e.pos[0], 0, e.pos[2]]; let first = true;
      for (const [gd, h] of [...st.held]) {
        if (h.lane !== L.id || !fit(g, gd) || flat(gd.char.pos, L.from) > K.pushM) continue; const D = defOf(g, gd); if (!D) continue;
        st.held.delete(gd); st.push.set(gd, L.pushUntil); gd.path = []; gd.pathGoal = null; gd.lastKnown = v3.copy(L.from); legTo(g, D, to, null, K.pushFast);   // (a straight run at where the charge went off: the room fight plants him on the first man he sees)
        if (first) { first = false; g.say(gd, 'they\'re blind — go, go!', true); st.saidT = g.time; }
        note(g, gd, `lane ${L.id}: pushes down it behind the charge`);
      }
    }
  }
}
/** one of the other side, on his feet, that a man looking from `eye` has a line to within `peekNearM` of where a lane's fire came from: where he stands (null =
 *  nobody). A LINE, not his eyes' own verdict: a man there in the dark counts as seen, so the dark never makes a lane 'clear' (cautious, and said so on the page). */
function gunsManned(g: Game, L: Lane, eye: Vec3): Vec3 | null {
  const K = LANES, pc = g.player.char;
  const at = (c: Guard['char']): Vec3 | null => {
    if (!L.guns.some(m => flat(m, c.pos) < K.peekNearM)) return null;
    return !g.col.segmentBlocked(eye, c.bones.head ?? v3.add(c.pos, [0, 1.65, 0])) || !g.col.segmentBlocked(eye, c.bones.chest ?? v3.add(c.pos, [0, 1.1, 0])) ? c.pos : null;
  };
  if (pc.alive && isHostile(SIDE, teamOfId(g, pc.id))) { const p = at(pc); if (p) return p; }
  for (const o of g.guards) if (o.state !== 'dead' && !o.held && isHostile(SIDE, o.team)) { const p = at(o.char); if (p) return p; }
  return null;
}
/** has he the PLACE round a gun's spot in view: the spot itself, and of a ring of six at `SPOT_RING` round it, chest high — the ones a man at the spot could
 *  stand on (nothing solid between the spot and them) — all but one at most */
const SPOT_RING = 0.7;
function spotSeen(g: Game, eye: Vec3, m: Vec3): boolean {
  const c: Vec3 = [m[0], 1.4, m[2]]; if (g.col.segmentBlocked(eye, c)) return false;
  let miss = 0;
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3, q: Vec3 = [m[0] + Math.cos(a) * SPOT_RING, 1.4, m[2] + Math.sin(a) * SPOT_RING];
    if (!g.col.solidBlocked(c, q) && g.col.segmentBlocked(eye, q) && ++miss > 1) return false;
  }
  return true;
}
/** another of his side, fit, has had one of them in sight within 3 s somewhere by the lane's guns */
function netSees(g: Game, L: Lane, but: Guard): boolean {
  for (const D of g.fight.defs) { const o = D.gd; if (o === but || !fit(g, o) || g.time - o.lastSeenT > 3 || !o.lastKnown) continue; const k = o.lastKnown; if (L.guns.some(m => flat(m, k) < LANES.peekNearM)) return true; }
  return false;
}
/** of the men this rule holds short of a lane's mouth, the nearest who can step to where it opens (a few steps, never across a covered lane's floor), and
 *  where he steps to. `skip`: not these · `armed`: only a man with a burst in his gun, not reloading · `minGun`: his corner no nearer the guns than this */
function stepper(g: Game, st: State, L: Lane, skip: Set<Guard> | null, armed: boolean, minGun = 0): { gd: Guard; to: Vec3 } | null {
  const K = LANES; let best: Guard | null = null, bd = Infinity, to: Vec3 | null = null;
  for (const D of g.fight.defs) {
    const gd = D.gd, h = st.held.get(gd);
    if (skip?.has(gd) || D.mode !== 'hold' || !fit(g, gd) || !knows(L, gd) || g.time - gd.lastSeenT < 1.5 || pushing(g, st, gd) || flanking(g, st, gd)) continue;
    if (!h || h.lane !== L.id || !h.aimed || g.time - h.t < 1) continue;   // (only a man this rule itself stopped short of THIS lane: a man on a post of his own — dug in on a door, a squad's keeper — is never walked off it for a look)
    if (armed && (gd.reloadT >= 0 || !gd.weapon.canFire() || gd.weapon.roundsReady < K.pinRounds)) continue;
    let m = mouthOf(g, L, gd.char.pos), d = flat(gd.char.pos, m), on: Vec3 | null = null; if (d > K.peekReachM || d < 0.3) continue;
    if (!K.stopClear) { if (d + gd.char.id * 1e-4 >= bd) continue; if (minGun > 0 && L.guns.some(q => flat(q, m) < minGun)) continue; }   // (with the mend the mouth may be another, nearer one: both asked of that one, below)
    { const mask = maskOf(g, st, gd), way = g.col.nav.findPath(gd.char.pos, m, 1500, priceOf(g, mask, undefined)); if (!way || !way.length || flat(way[way.length - 1], m) > 0.8) continue;   // (a few steps to it, not a walk round the building…
      let len = 0, q = gd.char.pos, crosses = false; for (const w of way) { len += flat(q, w); q = w; if (mask && flat(w, m) > 0.8 && inMask(g, mask, w)) crosses = true; }
      if (crosses && K.stopClear && mask) {   // the mouth he SEES (through a doorway, slantwise) lies beyond the lane's own first floor on his walk: that first floor is where it opens before his feet
        let run = 0, a = gd.char.pos, hit: Vec3 | null = null;
        walk: for (const w of way) { const sl = flat(a, w), n = Math.max(1, Math.ceil(sl / 0.2));
          for (let k = 1; k <= n; k++) { const x: Vec3 = [a[0] + (w[0] - a[0]) * k / n, 0, a[2] + (w[2] - a[2]) * k / n]; if (inMask(g, mask, x)) { hit = x; run += sl * k / n; on = sl > 1e-3 ? [(w[0] - a[0]) / sl, 0, (w[2] - a[2]) / sl] : null; break walk; } }
          run += sl; a = w; }
        const i = hit ? cellAt(g, hit) : -1;
        if (hit && i >= 0 && L.cells?.has(i) && run >= 0.3) { const n = g.col.nav; m = [(i % n.W + 0.5) * n.cell, 0, (((i / n.W) | 0) + 0.5) * n.cell]; d = Math.max(0.3, flat(gd.char.pos, m)); len = run; crosses = false; }   // (another lane's floor first: not his to cross)
      }
      if (len > K.peekReachM * 1.4 || crosses) continue; }   // (…and never one that crosses a covered lane's floor on the way to this one's mouth)
    if (minGun > 0 && L.guns.some(q => flat(q, m) < minGun)) continue;   // (a corner that near the guns is no place to stand and fire from)
    const score = d + gd.char.id * 1e-4; if (score >= bd) continue;
    best = gd; bd = score; to = on ? [m[0] + on[0] * 0.6, 0, m[2] + on[2] * 0.6] : [m[0] + (m[0] - gd.char.pos[0]) / d * 0.6, 0, m[2] + (m[2] - gd.char.pos[2]) / d * 0.6];   // (a stride on into it: he stops the moment he has a line down it)
    if (g.col.nav.isBlocked(to[0], to[2])) to = v3.copy(m);
  }
  return best && to ? { gd: best, to } : null;
}
/** the men sent round to a lane's other side, twice a second: on his way → SET where the guns would first see him (planted there, held on the lane from that
 *  side like any man this rule stops short — so a charge of his, or a look, comes from there too). While one is set, the lane is held at two angles and its
 *  men fire down it in turn (`pinStart`). */
function flankTick(g: Game, st: State, L: Lane) {
  const K = LANES; let set = 0, go = 0;
  for (const [gd, f] of [...st.flankOf]) {
    if (f.lane !== L.id) continue; const D = defOf(g, gd);
    if (!D || !fit(g, gd) || pushing(g, st, gd)) { st.flankOf.delete(gd); if (f.phase === 'walk') st.flank.delete(gd); continue; }   // (down, blind, or in behind a charge: no longer this errand's — and no longer let past the gate as a man going round)
    if (f.phase === 'walk') {
      if (!flanking(g, st, gd)) continue;   // (too long on the way: let go of, the entry gone with it)
      if (g.time - gd.lastSeenT < 1) { st.flankOf.delete(gd); st.flank.delete(gd); continue; }   // (met one of them on the way: the fight's)
      if (flat(gd.char.pos, f.at) > 0.8) {   // not there yet
        const sg = gd.script?.goal;
        if (D.mode === 'move') { if (sg && flat(sg, f.at) < 0.8) continue; st.flankOf.delete(gd); st.flank.delete(gd); continue; }   // (still walking it — or sent elsewhere meanwhile: no longer this errand's)
        if (g.time - f.t < 2) continue;
        if (++f.n > 4) { st.flankOf.delete(gd); st.flank.delete(gd); continue; }   // (the room fight plants a leg that runs long, and a long way round is several: walked on, a few times, then let go)
        f.t = g.time; gd.path = []; gd.pathGoal = null; legTo(g, D, f.at, null, 0); continue;
      }
      st.flank.delete(gd); f.phase = 'set'; f.t = g.time; f.at = v3.copy(gd.char.pos); st.stats.sets++;
      const look = mouthOf(g, L, gd.char.pos); gd.path = []; gd.pathGoal = null;
      if (g.fight.laneStop(gd, look)) st.held.set(gd, { lane: L.id, t: g.time, look: v3.copy(look), aimed: true, at: v3.copy(gd.char.pos) });
      if (g.time - st.saidT > 2) { st.saidT = g.time; g.say(gd, 'set — I\'ve got an angle on them!', true); }
      note(g, gd, `lane ${L.id}: round and set at (${gd.char.pos[0].toFixed(1)}, ${gd.char.pos[2].toFixed(1)}), ${flat(gd.char.pos, L.from).toFixed(0)} m from its guns: holds it from this side`);
      L.pinAt = Math.max(L.pinAt, g.time + 1.5);
    }
    if (f.phase === 'set') {
      const h = st.held.get(gd);
      if (!(h && h.lane === L.id && D.mode === 'hold') && st.peek.get(gd)?.lane !== L.id) { st.flankOf.delete(gd); continue; }   // (taken by the fight or another errand)
      set++;
    } else if (f.phase === 'go') { if (!flanking(g, st, gd)) continue; if (flat(gd.char.pos, L.from) > 6 && g.time - gd.lastSeenT > 0.5) go++; }
  }
  if (!K.pin || L.can || g.time < L.pinAt || !(set || go)) return;
  if (L.pinN >= K.pinMax) { L.pinN = 0; L.pinAt = g.time + K.pinRest; return; }   // (the volley fired: quiet a while)
  pinStart(g, st, L);
}
/** the fire has started: every man set on this lane's other side goes in at its guns, at a run */
function flankGo(g: Game, st: State, L: Lane) {
  const K = LANES; let first = true;
  for (const [gd, f] of st.flankOf) {
    if (f.lane !== L.id || f.phase !== 'set') continue; const D = defOf(g, gd); if (!D || !fit(g, gd)) continue;
    f.phase = 'go'; f.t = g.time; st.held.delete(gd); st.flank.set(gd, g.time + 12); gd.path = []; gd.pathGoal = null; gd.lastKnown = v3.copy(L.from); legTo(g, D, L.from, null, K.pushFast); st.stats.goes++;
    if (first) { first = false; g.say(gd, 'moving!', true); }
    note(g, gd, `lane ${L.id}: goes in under the fire, ${flat(gd.char.pos, L.from).toFixed(0)} m to its guns`);
  }
  L.roundAt = Math.max(L.roundAt, g.time + K.roundGap);
}
/** FIRE FROM AN ANGLE: of the men held on the lane, on either side, with a burst in his gun and a corner no nearer the guns than `pinMinM` — in turn — one
 *  steps to it to put the burst down the lane at where the fire came from */
function pinStart(g: Game, st: State, L: Lane) {
  const K = LANES; L.pinAt = g.time + 1;   // (asked again soon while nobody is placed for it)
  for (const p of st.peek.values()) if (p.lane === L.id) return;
  const last = L.pinBy >= 0 ? new Set(g.fight.defs.filter(x => x.gd.char.id === L.pinBy).map(x => x.gd)) : null;   // (in turn: not the man who fired last, if another is placed)
  const pick = (last && stepper(g, st, L, last, true, K.pinMinM)) || stepper(g, st, L, null, true, K.pinMinM); if (!pick) return; const gd = pick.gd, D = defOf(g, gd); if (!D) return;
  const look = st.held.get(gd)?.look ?? mouthOf(g, L, gd.char.pos); L.pinAt = g.time + K.pinGap; L.pinN++; L.peekAt = Math.max(L.peekAt, g.time + K.peekGap);   // (he looks as he fires: no look for news on top of it)
  st.held.delete(gd); st.peek.set(gd, { lane: L.id, phase: 'out', t: g.time, home: v3.copy(gd.char.pos), look: v3.copy(look), to: pick.to, lineT: -1, fire: { n: K.pinRounds, t: -1, next: 0, saw: false, lineT: -1 } });
  gd.path = []; gd.pathGoal = null; legTo(g, D, pick.to, null, K.pinPace - g.tune.guardChase);
  { let m = L.guns[0] ?? L.from, md = Infinity; for (const q of L.guns) { const d = flat(q, pick.to); if (d < md) { md = d; m = q; } } order(gd, { aimAt: [m[0], 1.2, m[2]] }); }   // (his gun on where the fire came from before he is round the corner)
  st.stats.pins++; L.pinBy = gd.char.id;
  note(g, gd, `lane ${L.id}: steps to his corner toward (${pick.to[0].toFixed(1)}, ${pick.to[2].toFixed(1)}) to put fire down it`);
}
/** every frame, a man out at his corner to fire down a lane: the moment his muzzle has a line to where the fire came from he stops, and with his gun on it puts his burst
 *  there — rounds at a PLACE (the spot of theirs nearest the man he sees there, if he sees one), wide — then gets back. No line from the mouth, or his gun not
 *  on it within `pinSnap`: back with the burst unfired. */
function pinStep(g: Game, st: State, gd: Guard, p: Peek, L: Lane, D: NonNullable<ReturnType<typeof defOf>>, seen: Vec3 | null, back: () => void) {
  const K = LANES, c = gd.char, F = p.fire!;
  if (seen && !F.saw) { F.saw = true; L.until = Math.max(L.until, g.time + K.peekKeep); L.peekPart = 0; if (L.guns.length < 4 && L.guns.every(m => flat(m, seen) > 1.5)) L.guns.push([seen[0], 0, seen[2]]); }   // (seen still on it: the lane stands — no news asked for, so the looks' own wait is not doubled)
  let tgt: Vec3 | null = null, bd = Infinity; const e = shotEnergy(g, c);
  for (const m of L.guns) { const q: Vec3 = [m[0], 1.2, m[2]]; if (g.col.shotBlocked(c.muzzle, q, 0.02, e)) continue; const d = flat(m, seen ?? c.pos); if (d < bd) { bd = d; tgt = q; } }
  const done = (why: string) => { const spent = K.pinRounds - F.n; note(g, gd, `lane ${L.id}: ${why}${spent ? ` — ${spent} round${spent === 1 ? '' : 's'} down it` : ''}${F.saw ? ', they are still on it' : ''}: back`); if (gd.weapon.roundsReady < K.pinRounds && gd.reloadT < 0) laneReload(g, gd); back(); };
  if (F.t >= 0 && g.time - F.t > K.pinSnap) return done('his moment at the corner is up');   // (a SNAP burst: no longer in their sight than a look is)
  if (!tgt) { if (F.t >= 0 ? g.time - F.lineT > 0.2 : D.mode !== 'move' || g.time - p.t > 6) done('no line down it for his fire'); return; }
  if (F.t < 0) { F.t = g.time; p.to = v3.copy(c.pos); gd.path = []; gd.pathGoal = null; legTo(g, D, p.to, null, 0); }   // the first line: NOT a step further out (0.2 m more and 4 of 14 firers were lost, 0.4 m and a second and a half out 5 of 14; from here 1 of 19) — he fires from where his muzzle first clears the corner, and a line lost to his own recoil ends the burst
  F.lineT = g.time; order(gd, { aimAt: tgt });
  for (const [o, f] of st.flankOf) if (f.lane === L.id && f.phase === 'go' && o.state !== 'dead' && flat(o.char.pos, tgt) < 5) return done('his mates are on the guns');
  const dx = tgt[0] - c.muzzle[0], dy = tgt[1] - c.muzzle[1], dz = tgt[2] - c.muzzle[2], dl = Math.hypot(dx, dy, dz) || 1;
  const on = (c.gunDir[0] * dx + c.gunDir[1] * dy + c.gunDir[2] * dz) / dl > Math.cos(K.pinAimDeg * Math.PI / 180);
  const at = v3.mad(c.muzzle, c.gunDir, dl);   // (down his BORE, which may sit a few degrees off the place: the round goes where the gun points, and the mates in its way are asked along that)
  if (on && g.time >= F.next && !gd.muzzleDown && !roundPastColleague(g, gd, at, null, K.pinSpread * 0.75) && gd.weapon.fire()) {
    fireWeapon(g, c, at, false, { steady: true, spread: K.pinSpread });
    if (F.n === K.pinRounds) { if (K.pinGo) { st.saidT = g.time; g.say(gd, 'covering — move!', true); flankGo(g, st, L); } else if (L.pinN === 1) { st.saidT = g.time; g.say(gd, 'putting fire on them!', true); } }
    F.n--; F.next = g.time + Math.max(K.pinEvery, gd.weapon.def.cd); st.stats.pinRounds++;
  }
  if (F.n <= 0) done('his burst is fired'); else if (!gd.weapon.canFire() && gd.weapon.roundsReady === 0) done('dry');
}
/** he has shouted and frag.ts's wind-up has his arm (half a second past its time at the most: a wind-up that never ends does not keep him) */
const winding = (g: Game, gd: Guard, F: NonNullable<Peek['frag']>) => !!F.at && fragWinding(g, gd) && g.time < F.until + 0.5;
/** A GRENADE DOWN IT (LANES.frag): of the men held on the lane who carry one and may throw this moment, one goes looking for an arc to the middle of where
 *  its fire came from (`fragStep`) — the nearest who could step to where the lane opens, else the first of them from where he stands. Not while a mate is on
 *  his way round to those guns. A man who has looked and found none does not look again until that middle has moved. */
function fragOut(g: Game, st: State, L: Lane, at: Guard[]) {
  L.fragAt = g.time + 2;   // (asked again soon while nobody is placed for it)
  if (!at.length) return;
  for (const p of st.peek.values()) if (p.lane === L.id) return;
  for (const f of st.flankOf.values()) if (f.lane === L.id && f.phase !== 'set') return;   // (not on the head of a mate walking round to them, or going in at them)
  const mid = gunsMid(L), can: Guard[] = [];
  for (const gd of at) {
    const no = st.fragNo.get(gd), h = st.held.get(gd);   // (`at` was read before this tick's charge and its men sent round: one of them may be held no longer)
    if (h && h.lane === L.id && h.aimed && defOf(g, gd)?.mode === 'hold' && !pushing(g, st, gd) && !flanking(g, st, gd) && !(no && no.lane === L.id && flat(no.at, mid) < 1.5) && fragReady(g, gd, mid)) can.push(gd);
  }
  if (!can.length) return;
  const skip = new Set<Guard>(); for (const x of g.fight.defs) if (!can.includes(x.gd)) skip.add(x.gd);
  const pick = stepper(g, st, L, skip, false, FRAG.defNear), gd = pick?.gd ?? can[0], look = st.held.get(gd)?.look ?? mouthOf(g, L, gd.char.pos);
  st.held.delete(gd); st.peek.set(gd, { lane: L.id, phase: 'out', t: g.time, home: v3.copy(gd.char.pos), look: v3.copy(look), to: pick?.to ?? mouthOf(g, L, gd.char.pos), lineT: -1,
    frag: { at: null, k: 0, next: 0, walk: !!pick, going: false, edge: false, own: false, until: 0, had: 0 } });
}
/** the middle of where a lane's fire came from: of the places its guns fired from, the one nearest their mean */
function gunsMid(L: Lane): Vec3 {
  if (!L.guns.length) return L.from;
  let mx = 0, mz = 0; for (const q of L.guns) { mx += q[0]; mz += q[2]; } mx /= L.guns.length; mz /= L.guns.length;
  let best = L.guns[0], bd = Infinity; for (const q of L.guns) { const d = Math.hypot(q[0] - mx, q[2] - mz); if (d < bd) { bd = d; best = q; } }
  return best;
}
/** where his feet would be `s` metres on: along the walk he is on (`going`), else straight toward `to`. 'edge' = that is a covered lane's floor, or past the
 *  end of his walk — his arm goes into the guns' line, he does not · null = no such place (a wall on the straight line) */
function fragPlace(g: Game, st: State, gd: Guard, to: Vec3, s: number, going: boolean): Vec3 | 'edge' | null {
  const c = gd.char; if (s <= 0) return v3.copy(c.pos);
  let b: Vec3;
  if (going && gd.pathI < gd.path.length) {
    let left = 0, a = c.pos; for (let i = gd.pathI; i < gd.path.length && left < s; i++) { left += flat(a, gd.path[i]); a = gd.path[i]; }
    if (left < s) return 'edge'; b = along(gd, s);
  } else {
    const dx = to[0] - c.pos[0], dz = to[2] - c.pos[2], d = Math.hypot(dx, dz); if (s > d) return 'edge';
    b = [c.pos[0] + dx / d * s, 0, c.pos[2] + dz / d * s];
    if (g.col.nav.isBlocked(b[0], b[2]) || g.col.solidBlocked([c.pos[0], 1.1, c.pos[2]], [b[0], 1.1, b[2]])) return null;
  }
  return inMask(g, maskOf(g, st, gd), b) ? 'edge' : b;
}
/** every frame, a man out to put a grenade down a lane. First from where he is held, his arm round his corner: an arc to the middle of the lane's guns and
 *  he SHOUTS and throws from there without taking a step. None: he comes toward the lane's mouth at a look's pace (if the look's own pick finds him a walk),
 *  and one place at a time is asked — where he is, then a step, two, three on along his walk (`fragStepM`: what the wind-up's second lets him walk). The first
 *  that has an arc and he shouts where he is — the grenade comes out of the pouch behind his corner — walks to that place and no further, throws, and goes
 *  back. As far as the EDGE of the lane's floor, never onto it; none there either = back with it on his belt. Ended at once, the grenade still his, by a
 *  stun charge of theirs in the air, a push down the lane, or anything that would refuse the throw anyway (the floor's gap between grenades, a hostage). */
function fragStep(g: Game, st: State, gd: Guard, p: Peek, L: Lane, D: NonNullable<ReturnType<typeof defOf>>, back: () => void) {
  const K = LANES, F = p.frag!, pace = K.peekPace - g.tune.guardChase, N = F.going ? Math.max(1, Math.round(K.fragStepM / 0.3)) + 1 : 1;
  if (F.at) {
    if (winding(g, gd, F)) return;
    const went = fragAway(g, gd) > F.had;
    if (went) st.stats.frags++; else { st.stats.fragKept++; L.fragAt = g.time + 6; st.fragNo.set(gd, { lane: L.id, at: v3.copy(F.at) }); }   // (it stayed in his hand — a mate came into its reach, or he was moved off his arc: he does not shout that place again; another carrier may)
    note(g, gd, `lane ${L.id}: ${went ? 'the grenade is away' : 'the grenade stayed in his hand'}: back`); back(); return;
  }
  const at = gunsMid(L);
  if (!K.frag || L.can || g.time < L.pushUntil || !fragReady(g, gd, at)) { L.fragAt = g.time + 2; if (F.going) note(g, gd, `lane ${L.id}: not now for his grenade — back`); back(); return; }
  if (g.time < F.next) return; F.next = g.time + 0.045;   // (a place every third frame: at a look's pace the four are asked again before he has walked the 0.3 m between two — and a frame pays for one place's arcs)
  const n = F.k % N, b = fragPlace(g, st, gd, p.to, n * 0.3, F.going), r = b && b !== 'edge' ? fragThrowAt(g, gd, at, b, p.to) : null; F.k++;
  if (r === 'thrown' && b && b !== 'edge') {
    // he has shouted: to the place it leaves his hand from and not a step further, his gun arm toward it — and no mate steps out onto the lane or goes round
    // to its guns (a look, a burst, a stun charge and the push behind it) until it has gone off
    const quiet = g.time + FRAG.defWind + FRAG.defFuse + K.fragLook;
    F.at = at; F.until = g.time + FRAG.defWind; F.had = fragAway(g, gd); st.saidT = g.time;
    if (F.going) { p.to = b; gd.path = []; gd.pathGoal = null; legTo(g, D, b, null, pace); order(gd, { aimAt: [at[0], 1.2, at[2]] }); }
    L.fragAt = g.time + K.fragGap; L.peekAt = Math.max(L.peekAt, quiet); L.pinAt = Math.max(L.pinAt, quiet); L.stunAt = Math.max(L.stunAt, quiet); L.roundAt = Math.max(L.roundAt, quiet);
    note(g, gd, `lane ${L.id}: a grenade down it ${F.going ? 'from the edge of its floor' : 'from behind his corner'}, for (${at[0].toFixed(1)}, ${at[2].toFixed(1)}), ${flat(gd.char.pos, at).toFixed(0)} m off`);
    return;
  }
  if (r === 'own' || r === 'busy') F.own = true;
  if (b === 'edge') { if (n <= 1) F.edge = true; F.k += N - 1 - n; }   // (nothing further out is his to stand on: this round of places is done — and with not even a step of his own left, so is the errand)
  if (F.k % N) return;
  if (!F.going && F.walk && !F.own) { F.going = true; F.k = 0; gd.path = []; gd.pathGoal = null; legTo(g, D, p.to, null, pace); note(g, gd, `lane ${L.id}: no arc for his grenade from where he is held — toward its mouth at (${p.to[0].toFixed(1)}, ${p.to[2].toFixed(1)}) for one`); return; }
  if (F.going && !F.edge && D.mode === 'move' && g.time - p.t < 6) return;
  if (F.own) L.fragAt = g.time + 6; else st.fragNo.set(gd, { lane: L.id, at: v3.copy(at) });   // (one of his own in its reach is no news about the arc: asked again soon)
  note(g, gd, `lane ${L.id}: ${F.own ? 'one of his own in his grenade\'s reach' : `no arc down it for his grenade${F.going ? ' as far as the edge of its floor' : ''}`} — ${F.going ? 'back' : 'stays'}`); back();
}
/** A LOOK ROUND THE CORNER: of the men this rule holds short of a quiet lane's mouth, the nearest steps to where it opens and looks down it at where the fire
 *  came from */
function peekStart(g: Game, st: State, L: Lane) {
  const K = LANES; L.peekAt = g.time + 3;   // (asked again soon while nobody is placed for it)
  for (const p of st.peek.values()) if (p.lane === L.id) return;
  const pick = stepper(g, st, L, null, false), best = pick?.gd ?? null, to = pick?.to ?? null;
  if (!best || !to) return; const D = defOf(g, best); if (!D) return;
  const look = st.held.get(best)?.look ?? mouthOf(g, L, best.char.pos); L.peekAt = g.time + K.peekGap;
  st.held.delete(best); st.peek.set(best, { lane: L.id, phase: 'out', t: g.time, home: v3.copy(best.char.pos), look: v3.copy(look), to, lineT: -1 });
  best.path = []; best.pathGoal = null; legTo(g, D, to, null, K.peekPace - g.tune.guardChase); st.stats.peeks++;
  note(g, best, `lane ${L.id}: quiet ${(g.time - L.lastT).toFixed(0)} s — steps to its mouth toward (${to[0].toFixed(1)}, ${to[2].toFixed(1)}) for a look`);
}
/** every frame, a man out for a look: the moment he has one of them in sight by the guns he is on his way back and the lane stands ('still on it'); a line down
 *  it to where the fire came from and nobody there for `peekLook` = it is clear — forgotten, and the men held on it go on together to where the guns were */
function peekStep(g: Game, st: State, gd: Guard, p: Peek) {
  const K = LANES, L = st.lanes.find(x => x.id === p.lane), D = defOf(g, gd);
  if (gd.state === 'dead' && p.frag) { st.peek.delete(gd); st.stats.fragLost++; if (L) { L.fragAt = Math.max(L.fragAt, g.time + K.fragGap); note(g, gd, `lane ${L.id}: the grenade cost him`); } return; }
  if (gd.state === 'dead' && p.fire) { st.peek.delete(gd); st.stats.pinLost++; if (L) { L.pinN = 0; L.pinAt = g.time + K.pinRest; note(g, gd, `lane ${L.id}: firing down it cost him`); } return; }
  if (gd.state === 'dead') { st.peek.delete(gd); st.stats.peekLost++; if (L) { L.peekN++; L.peekAt = g.time + K.peekLost; note(g, gd, `lane ${L.id}: the look cost him`); } return; }
  if ((!D || !fit(g, gd) || pushing(g, st, gd)) && p.frag) {   // (blind, folded, or in behind a charge with a grenade errand on him: frag.ts has dropped any wind-up — asked again soon; a man who never left his corner is still held on the lane)
    st.peek.delete(gd); if (L) { L.fragAt = g.time + (p.frag.at ? 6 : 2); if (D && !p.frag.going && flat(gd.char.pos, p.home) < 0.5) st.held.set(gd, { lane: L.id, t: g.time, look: v3.copy(p.look), aimed: true, at: v3.copy(gd.char.pos) }); } return; }
  if (!D || !fit(g, gd) || pushing(g, st, gd)) { st.peek.delete(gd); if (L) L.peekAt = Math.max(L.peekAt, g.time + K.peekGap); return; }   // (a charge of theirs on the guns, or he is blind: no longer this errand's man — the gate has his feet again, and the next look waits its gap)
  const back = () => { p.phase = 'back'; p.t = g.time; gd.path = []; gd.pathGoal = null; legTo(g, D, p.home, null, K.pushFast); };
  if (!L && p.phase !== 'back') { back(); return; }   // (the lane gone meanwhile: back to where he stood, not left a stride into it)
  if (p.phase === 'back') {
    if (D.mode === 'move' && flat(gd.char.pos, p.home) > 0.5 && g.time - p.t < 6) return;
    st.peek.delete(gd); if (laneOn(g, st, gd.char.pos, gd)) return;   // (stopped in the line — a man in his sights: the fight's, and the tick's own way out of a line)
    if (!L && LANES.stopClear) return;   // (his own look cleared it: nothing left to hold him on — the room fight has him back, not this rule's plant on a point nobody is at)
    if (g.time - gd.lastSeenT > 1 && g.fight.laneStop(gd, p.look) && L) st.held.set(gd, { lane: L.id, t: g.time, look: v3.copy(p.look), aimed: true, at: v3.copy(gd.char.pos) });   // (without the mend above, a lane cleared by his own look still planted him where he stood, his gun where it was — held by nothing)
    return;
  }
  if (!L) return;
  if (p.frag) { fragStep(g, st, gd, p, L, D, back); return; }
  // his head round the corner ahead of his feet: the look is taken from his eyes leant `peekLean` toward the mouth (nothing solid between the two)
  let eye = eyeOf(gd); { const dx = p.to[0] - gd.char.pos[0], dz = p.to[2] - gd.char.pos[2], d = Math.hypot(dx, dz); if (d > 0.05 && p.lineT < 0) { const out: Vec3 = [eye[0] + dx / d * K.peekLean, eye[1], eye[2] + dz / d * K.peekLean]; if (!g.col.solidBlocked(eye, out)) eye = out; p.eye = eye; } else if (p.eye && p.lineT >= 0) eye = p.eye; }
  const seen = gunsManned(g, L, eye);
  // out to FIRE down it: his burst goes unless he can see all of where they stood and nobody is there (then it is a look: clear)
  if (p.fire && p.fire.n > 0 && (seen || !L.guns.every(m => spotSeen(g, eye, m)))) { pinStep(g, st, gd, p, L, D, seen, back); return; }
  if (seen) {
    L.until = Math.max(L.until, g.time + K.peekKeep); L.peekPart = 0; L.peekN++; L.peekAt = g.time + Math.min(K.peekMax, K.peekGap * Math.pow(2, L.peekN)); st.stats.peekThere++;
    if (L.guns.length < 4 && L.guns.every(m => flat(m, seen) > 1.5)) L.guns.push([seen[0], 0, seen[2]]);   // (where they stand now: a place to stop is out of that one's sight too)
    if (g.time - st.saidT > 2) { st.saidT = g.time; g.say(gd, 'they\'re still on it — stay back!', true); }
    note(g, gd, `lane ${L.id}: a look — still held, from (${seen[0].toFixed(1)}, ${seen[2].toFixed(1)}); next no sooner than ${(L.peekAt - g.time).toFixed(0)} s`);
    back(); return;
  }
  if (D.mode !== 'move' && g.time - gd.lastSeenT < 1) { st.peek.delete(gd); L.peekAt = g.time + K.peekGap; return; }   // (a man in his sights somewhere else: the fight has him)
  // 'clear' wants the whole of it: the place round EVERY spot the fire came from in his view (a muzzle shows past a corner its man stands behind — the one
  // point proves nothing), and nobody on their net with eyes on one of them there just now. The spots in view but not all the floor round them (a corner by
  // the gun he cannot see behind from here) is HALF a look: it clears the lane only the second time running, and only once it has been quiet `peekSure`
  const full = L.guns.every(m => spotSeen(g, eye, m)), done = D.mode !== 'move' || g.time - p.t > 8;
  const part = !full && done && L.guns.every(m => !g.col.segmentBlocked(eye, [m[0], 1.4, m[2]]));
  if ((full || part) && netSees(g, L, gd)) { L.peekAt = g.time + K.peekGap; L.peekPart = 0; note(g, gd, `lane ${L.id}: a look — nobody in his view, but a mate has eyes on them there: back`); back(); return; }
  if (full || part) {
    if (p.lineT < 0) { p.lineT = g.time; p.to = v3.copy(gd.char.pos); gd.path = []; gd.pathGoal = null; legTo(g, D, p.to, null, 0); }   // (far enough: he looks from here)
    if (g.time - p.lineT < K.peekLook) return;
    if (!full && (++L.peekPart < 2 || g.time - L.lastT < K.peekSure)) {
      L.peekAt = g.time + K.peekGap; note(g, gd, `lane ${L.id}: a look — nobody in his view, but not all of where they stood (${L.peekPart}): back`); back(); return;
    }
    st.peek.delete(gd); st.stats.peekClear++; st.stats.lapsed++;
    st.lanes = st.lanes.filter(x => x !== L); st.due = st.due.filter(d => d.lane !== L.id); remask(g, st);   // (forgotten here and now: nobody is stopped short of it on his way out)
    const mates: Guard[] = []; for (const [o, h] of st.held) if (h.lane === L.id) { st.held.delete(o); if (o !== gd && fit(g, o)) mates.push(o); }
    note(g, gd, `lane ${L.id}: a look — nobody on it: clear${mates.length ? `, ${mates.length + 1} move up together` : ', back to his place'}`);
    note(g, null, `lane ${L.id}: forgotten (${L.downs} down, last round ${(g.time - L.lastT).toFixed(0)} s ago)`);
    // with a mate held on it too they go on TOGETHER to where the guns were (what cost them is where they look first); a man by himself goes nowhere on it — back to his place
    if (mates.length) { g.say(gd, 'they\'re off it — move up, together!', true); for (const o of mates) { const Do = defOf(g, o); if (Do) loose(g, Do, L.from); } loose(g, D, L.from); }
    else { g.say(gd, 'they\'ve moved off it — eyes open!', true); st.peek.set(gd, p); back(); }
    st.saidT = g.time;
    return;
  }
  if (done) { L.peekAt = g.time + K.peekGap; note(g, gd, `lane ${L.id}: no line down it from its mouth — back`); back(); }
}
/** where a lane opens before a man standing at `p`: the nearest of its floor he has a line to (of the ten nearest; else the nearest — never a cell picked through a wall while one in his sight is as near) */
function mouthOf(g: Game, L: Lane, p: Vec3): Vec3 {
  const n = g.col.nav, near: { d: number; x: number; z: number }[] = [];
  for (const i of L.cells ?? []) { const x = (i % n.W + 0.5) * n.cell, z = (((i / n.W) | 0) + 0.5) * n.cell, d = Math.hypot(x - p[0], z - p[2]);
    if (near.length >= 10 && d >= near[9].d) continue; let k = near.length; while (k > 0 && near[k - 1].d > d) k--; near.splice(k, 0, { d, x, z }); if (near.length > 10) near.pop(); }
  if (!near.length) return v3.copy(L.at);
  const eye: Vec3 = [p[0], 1.5, p[2]];
  for (const c of near) if (!g.col.solidBlocked(eye, [c.x, 1.0, c.z])) return [c.x, 0, c.z];
  return [near[0].x, 0, near[0].z];
}

function priceOf(g: Game, m: Uint8Array | null, base: ((ix: number, iz: number) => number) | undefined): ((ix: number, iz: number) => number) | undefined {
  if (!m) return base; const W = g.col.nav.W, d = LANES.dear;
  return base ? (ix, iz) => Math.max(base(ix, iz), m[iz * W + ix] ? d : 1) : (ix, iz) => m[iz * W + ix] ? d : 1;
}
/** guards.ts goTo: the price of a walk for this man — `base` (the pursuit tactics', or none) with the floor of every lane his side knows made dear */
export function lanePenalty(g: Game, gd: Guard, base: ((ix: number, iz: number) => number) | undefined): ((ix: number, iz: number) => number) | undefined {
  if (!LANES.on) return base; const st = states.get(g); if (!st || !st.lanes.length || !live(g) || !mine(g, gd) || pushing(g, st, gd)) return base;
  return priceOf(g, maskOf(g, st, gd), base);
}
/** guards.ts followPath: true = this rule has his feet this frame — his way lies down a lane his side knows is covered, and he has been stopped short of it */
export function laneGate(g: Game, gd: Guard): boolean {
  const st = states.get(g); if (!st || !st.lanes.length || !live(g) || !mine(g, gd) || !gd.path.length || pushing(g, st, gd)) return false;
  const m = maskOf(g, st, gd); if (!m || flanking(g, st, gd) || st.peek.has(gd)) return false;   // (…out for a look round the corner: that walk is this rule's own)
  { const h = st.held.get(gd), sg = gd.script?.goal; if (h && !h.aimed && sg && flat(sg, h.at) < 0.8) return false; }   // (on his way out of a line to cover: not stopped again on THAT walk — one he is sent on since is asked like any)
  if (g.time - (st.look.get(gd) ?? -100) < 0.2) return false; st.look.set(gd, g.time);
  if (closeFight(g, gd) || g.time < gd.dazzledUntil || fragFlee(g, gd)) return false;
  const here = inMask(g, m, gd.char.pos);
  let first = ahead(g, m, gd, here); if (!first) return false;
  if (!here && gd.pathGoal) {   // a way planned before he knew of the lane: plan it again at the lane's price — a way round, if the level has one
    const goal = v3.copy(gd.pathGoal); goTo(g, gd, goal, true);
    first = ahead(g, m, gd, false); if (!first) { st.stats.rerouted++; note(g, gd, 'a covered lane on his way: goes round it'); return false; }
  }
  const L = laneAt(g, st, first, gd); if (!L) return false;
  if (here) {   // caught in it as he learnt of it — or walking down one that has gone quiet: out of it or away from its guns he may go, never on toward them
    if (g.time - L.lastT > LANES.hotSecs && flat(along(gd, LANES.aheadM), L.from) > flat(gd.char.pos, L.from) - 0.5) return false;
    if (backOut(g, st, gd, L)) return true;
  } else if ((gunOn(g, L, gd.char.pos, LANES.stopClear ? LANES.shiftM : 0) || (LANES.stopClear && doorwayInWay(g, gd.char.pos))) && backOut(g, st, gd, L)) return true;   // (the floor beside the wedge is no place to stop, nor a doorway: back to where that gun — a stride to either side too — has no line to him)
  if (!defOf(g, gd)) return false;   // (…and with no such floor in reach, here is still better than on)
  if (!st.due.some(d => d.gd === gd)) {
    let look = first;   // (what he watches from where he stops: the lane's first floor on his way — or, that being at his feet, a point on down it)
    if (LANES.stopClear && flat(gd.char.pos, first) < LANES.lookM) { const far = along(gd, 3); look = flat(gd.char.pos, far) >= LANES.lookM ? far : flat(gd.char.pos, L.from) >= LANES.lookM ? L.from : first; }
    st.due.push({ gd, lane: L.id, look });
  }
  gd.speed = 0; gd.char.vel = [0, 0, 0];
  return true;
}
/** the point `m` metres on along his way */
function along(gd: Guard, m: number): Vec3 { let a = gd.char.pos, left = m; for (let i = gd.pathI; i < gd.path.length; i++) { const b = gd.path[i], d = flat(a, b); if (d >= left) return [a[0] + (b[0] - a[0]) * left / (d || 1), 0, a[2] + (b[2] - a[2]) * left / (d || 1)]; left -= d; a = b; } return v3.copy(a); }
function plantShort(g: Game, st: State, gd: Guard, lane: number, look: Vec3) {
  if (!mine(g, gd) || !st.lanes.some(L => L.id === lane && knows(L, gd)) || !g.fight.laneStop(gd, look)) return;
  gd.path = []; gd.pathGoal = null;
  st.held.set(gd, { lane, t: g.time, look: v3.copy(look), aimed: true, at: v3.copy(gd.char.pos) }); st.stats.held++;
  if (g.time - st.saidT > 5) { st.saidT = g.time; g.say(gd, 'holding here — I\'m not walking into that!', true); }
  note(g, gd, `lane ${lane}: stops short of it at (${gd.char.pos[0].toFixed(1)}, ${gd.char.pos[2].toFixed(1)})`);
}
/** the first point of a known lane on the next `aheadM` of his way (null = none). `inside`: he stands in one — null when his way leaves it for good within reach */
function ahead(g: Game, m: Uint8Array, gd: Guard, inside: boolean): Vec3 | null {
  let a = gd.char.pos, left = LANES.aheadM, was = inside, hit: Vec3 | null = null;
  for (let i = gd.pathI; i < gd.path.length && left > 0; i++) {
    const b = gd.path[i], d = flat(a, b), k = Math.max(1, Math.ceil(Math.min(d, left) / 0.35));
    for (let j = 1; j <= k; j++) { const t = Math.min(1, j * 0.35 / (d || 1)); const p: Vec3 = [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t]; const on = inMask(g, m, p); if (on && !hit) hit = p; if (inside && was && !on) return null; was = on; }
    left -= d; a = b;
  }
  return hit ?? (inside ? v3.copy(gd.char.pos) : null);
}
/** pressure.ts consider / roomfight.ts rally: he is held short of a lane his side knows is covered, and what wants him (`to`: the noise he would be sent at;
 *  none given = anything) lies at that lane's guns or down it — he keeps its mouth (a press that wants him sends him at the same guns by the same way). A fight
 *  somewhere else may have him: his way there is priced like any, and the gate stops him again if it lies down the lane. */
export function laneHolds(g: Game, gd: Guard, to?: Vec3 | null): boolean {
  if (gunKeepsPost(gd)) return true;   // (gunroles.ts: a defender with the belt-fed gun keeps the post he was dealt — false on its first test with the switch off)
  const st = states.get(g); if (!st || !(st.held.size || st.peek.size) || !live(g)) return false;
  const h = st.held.get(gd) ?? st.peek.get(gd); if (!h) return false; const L = st.lanes.find(x => x.id === h.lane); if (!L) return false;
  return !to || L.guns.some(m => flat(m, to) < LANES.fieldM + 4) || !!L.cells?.has(cellAt(g, to));
}
/** roomfight.ts tickDef: he has shouted for a lane and the wind-up still has his arm (LANES.fragOwn) — the dig-in does not adopt him and walk him off his arc.
 *  The dig-in alone: a press, a rally or his squad's errand may still take him, as they may take any man this rule holds (`laneHolds`). */
export function laneThrows(g: Game, gd: Guard): boolean {
  if (!LANES.fragOwn) return false; const st = states.get(g); if (!st || !st.peek.size || !live(g)) return false;
  const F = st.peek.get(gd)?.frag; return !!F && winding(g, gd, F);
}
/** roomfight.ts rally: the noise he would walk over to BY HIMSELF is at the guns of a lane he knows is covered, or down it — nobody goes at those alone, held or
 *  not (the one-at-a-time feed). A press may still take a man who is not held: together, by its own way, a charge first. */
export function laneWarns(g: Game, gd: Guard, to: Vec3 | null): boolean {
  if (!to) return false; const st = states.get(g); if (!st || !st.lanes.length || !live(g) || !mine(g, gd)) return false;
  const i = cellAt(g, to);
  for (const L of st.lanes) if (knows(L, gd) && L.cells && (L.cells.has(i) || L.guns.some(m => flat(m, to) < LANES.fieldM + 4))) return true;
  return false;
}
/** tactics.ts tryEngage: the far side of this doorway (`far`) is in the line of guns his side knows of — no drill through it (he is stopped short of it by this
 *  rule instead), unless the charge that goes in first will burst on those guns (`can`: he carries one — and the doorway is that near them) */
export function laneDoor(g: Game, gd: Guard, far: Vec3, centre: Vec3, can: boolean): boolean {
  if (!LANES.on) return false; const st = states.get(g); if (!st || !st.lanes.length || !live(g) || !mine(g, gd) || pushing(g, st, gd) || flanking(g, st, gd)) return false;
  const L = laneOn(g, st, far, gd); if (!L) return false;
  return !(can && L.guns.some(m => flat(m, centre) < LANES.bangM + 2.5));
}
/** tactics.ts runGate (`LANES.drill`, asked there): the two questions tryEngage asked as the drill took him, asked again while it has him this side of the
 *  doorway — `at` is his jamb, the handle's place he is stepping to, or the station he is slicing to. True = the drill lets him go (said in the log) */
export function laneDrill(g: Game, gd: Guard, at: Vec3, far: Vec3, centre: Vec3, can: boolean): boolean {
  if (!laneCovers(g, gd, at) && !laneDoor(g, gd, far, centre, can)) return false;
  note(g, gd, 'the doorway drill has him at a doorway in a lane his side knows of: it lets him go');
  return true;
}
/** tactics.ts tryEngage: this spot is in the line of guns his side knows of — no place to stack on a doorway (the jamb the holders see through the opening) */
export function laneCovers(g: Game, gd: Guard, p: Vec3): boolean {
  if (!LANES.on) return false; const st = states.get(g); if (!st || !st.lanes.length || !live(g) || !mine(g, gd)) return false;
  return !pushing(g, st, gd) && !flanking(g, st, gd) && !!laneOn(g, st, p, gd);
}
/** pressure.ts stand and fight: he stands in a lane his side knows is covered — no place to plant himself */
export function laneExposed(g: Game, gd: Guard): boolean {
  const st = states.get(g); if (!st || !live(g) || !mine(g, gd)) return false;
  if (pushing(g, st, gd) || flanking(g, st, gd)) return false;   // (going in behind a charge: the lane is theirs while it lasts · sent round at the guns: he fights where he comes out)
  return st.lanes.length > 0 && !closeFight(g, gd) && !!laneOn(g, st, gd.char.pos, gd);
}

/** a magazine change this rule starts for a man behind his corner and counts down itself (lanesTick: one count a frame, whoever else counts it).
 *  The caller's to ask that he is not already changing one */
export function laneReload(g: Game, gd: Guard) { startReloadBeat(g, gd); S(g).reloads.set(gd, gd.reloadT); }
export function lanesReset(g: Game) { const st = states.get(g); if (st) states.set(g, Object.assign(fresh(), { stats: st.stats })); }
export function lanesStats(g: Game): Record<string, number> { return { ...(states.get(g)?.stats ?? fresh().stats), live: states.get(g)?.lanes.filter(L => L.known).length ?? 0 }; }
export function lanesSummary(g: Game): string {
  const st = states.get(g); if (!LANES.on) return 'off'; if (!st) return 'none yet';
  const k = st.lanes.filter(L => L.known).length, s = st.stats;
  return `${k} known of ${st.lanes.length} · held short ${s.held} · round ${s.rerouted + s.round} · backed out ${s.backedOut} · charges ${s.stuns} · looks ${s.peeks} (still held ${s.peekThere}, clear ${s.peekClear}) · set on its other side ${s.sets}, bursts from the corners ${s.pins}${s.frags ? ` · grenades down it ${s.frags}` : ''}`;
}
/** for a check or the debugger: every lane as plain data */
export function lanesList(g: Game) { return (states.get(g)?.lanes ?? []).map(L => ({ id: L.id, from: v3.copy(L.from), at: v3.copy(L.at), known: L.known, weight: L.weight, downs: L.downs, cells: L.cells?.size ?? 0, until: L.until, pushUntil: L.pushUntil })); }
export function lanesKnows(g: Game, p: Vec3): boolean { const st = states.get(g); return !!st && inMask(g, st.mask, p); }

// ---------------------------------------------------------------- checkpoints (a room fight refuses one today — a unit on the floor — so this rides only a forced file)
export interface LanesSave { serial: number; lanes: { id: number; from: number[]; at: number[]; t0: number; lastT: number; until: number; weight: number; downs: number; known: boolean; knownAt: number; guns: number[][]; wedges: number[][]; roundAt: number; stunAt: number; who?: number[]; peekAt?: number; peekN?: number; peekPart?: number; fragAt?: number; e?: number }[] }
export function lanesSnapshot(g: Game): LanesSave | undefined {
  const st = states.get(g); if (!st || !st.lanes.length) return undefined;
  return { serial: st.serial, lanes: st.lanes.map(L => ({ id: L.id, from: [...L.from], at: [...L.at], t0: L.t0, lastT: L.lastT, until: L.until, weight: L.weight, downs: L.downs, known: L.known, knownAt: L.knownAt, guns: L.guns.map(w => [...w]), wedges: L.wedges.map(w => [...w]), roundAt: L.roundAt, stunAt: L.stunAt, who: [...L.who], peekAt: L.peekAt, peekN: L.peekN, peekPart: L.peekPart, fragAt: L.fragAt || undefined, e: L.e || undefined })) };
}
export function lanesRestore(g: Game, s: LanesSave | undefined) {
  states.delete(g); const st = S(g); st.skip = true; st.t = g.time;   // (the rounds and bangs a load puts back among the events were read before the file was made: not twice)
  if (!s || !s.lanes?.length) return;
  st.serial = s.serial;
  for (const r of s.lanes) {
    const from = r.from as Vec3, at = r.at as Vec3, len = flat(from, at) || 1;
    const L: Lane = { id: r.id, from, at, dx: (at[0] - from[0]) / len, dz: (at[2] - from[2]) / len, t0: r.t0, lastT: r.lastT, until: r.until, weight: r.weight, downs: r.downs, known: r.known, knownAt: r.knownAt, lookAt: 0, guns: (r.guns ?? [r.from]).map(w => w as Vec3), saw: new Map(), knowers: new Set(), cells: null, wedges: r.wedges.map(w => w as Vec3), re: null, who: new Set(r.who ?? []), moved: new Set(), roundAt: r.roundAt, stunAt: r.stunAt, pushUntil: -1, can: null, peekAt: r.peekAt ?? 0, peekN: r.peekN ?? 0, peekPart: r.peekPart ?? 0, pinAt: 0, pinN: 0, pinBy: -1, fragAt: r.fragAt ?? 0, e: r.e ?? 0 };
    if (L.weight >= 1) { L.cells = new Set(); for (let i = 0; i + 1 < L.wedges.length; i += 2) wedge(g, L.cells, L.wedges[i], L.wedges[i + 1], laneE(L)); }
    st.lanes.push(L);
  }
  remask(g, st);   // (the men held at its mouths are not kept: each is planted where he stood — the room fight's own holder — and the gate stops him again if he is sent)
}
