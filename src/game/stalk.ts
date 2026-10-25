// THE STALK (STALK) — the last three metres to a man's back are one held click. The maintainer's design: "when you're close enough to an enemy (like entering the
// closer than ever state) you can click and hold on an enemy and sam will creep toward him · you might want to click, let go to stop, and click again to continue —
// really works well with the paused animation · the game also controls the trajectory and speed and makes things smooth. it ends with you grabbing him · you get
// kicked out of the mode if he gets too far away, turns around, goes through a door in a way that doesn't make sense". Before it those metres were the player's own
// keys into a window a metre deep behind a man who is walking, seen from 21 m up.
//
//   THE HOLD     hands empty, a living man who is not onto him, inside close.ts's mode range (CLOSE.modeM) with nothing solid between, Sam in his rear arc: the LEFT
//                button PRESSED on him (the reticle's man, or the cursor within `cursorM` of him) takes him as the man stalked. While the button stays down the game
//                walks Sam: crouched, toward a point `stationM` behind the man's back, at the man's own speed plus a closing speed that eases off as he nears
//                (`closeMin` + `closeK` a metre out from `grabM`, never over `pace`), facing him. The cursor is free after the press: the man walks, the mouse need not.
//   LETTING GO   the button up: nothing is stalked. Sam is where he is, in the mode's held stride (character.ts creep: the pose stops mid-step), and his keys are
//                his own. The next press takes the man again.
//   THE GRAB     inside `grabM` with the grab on offer (close.ts closeAt: behind him, in reach, room to stand): the hold becomes the grab — game.ts takes
//                `stalkGrab` exactly where it takes the row's (player.ts startGrab).
//   OUT          he is dead, held, onto Sam, or out of the picture · past CLOSE.modeOutM · a wall or a door leaf between them · he has turned until Sam is no longer
//                behind him (`outCos`: a few degrees of grace past the rear arc's own edge) · Sam's hands are no longer empty or are busy · a move key of the
//                player's own (his feet are his again at once; with `orbit` up his keys take him round the man instead, below). Out = nothing stalked until the button is pressed afresh; a button merely still down does nothing.
//
// What it does NOT touch: what the men see and hear (a creeping Sam files the crouch's footfalls and moves under their eyes as any crouched Sam), the grab itself,
// a civilian's own grab row. With `only` (below) a staff man's 'grab him' row is gone: the held click is the one way to him. The left click that began or carries a stalk is no blow (game.ts asks `stalkHas`).
// ON in the page unless ?stalk=0 (src/host/profile.ts pageSwitches); off here and on the harness's frozen stand (src/host/standup.ts; TPS_STALK=1 turns it on
// there). Off = the build as it was. Check: tools/qa/stalk-check.ts (STALK_BREAK=1 must fail).
// ITS POLISH (the fourth to sixth passes: stalkPolish below) is a hold of its own: down in this table and on the frozen stand, so a frozen run raised with
// TPS_STALK=1 is the stalk as it first stood; TPS_STALKPOLISH=1 raises it there, the page has it up unless ?stalkpolish=0.
import { SideMap } from '../math/side';
import { Vec3, wrapAngle, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import { CLOSE, closeAt, closeLive, closeSubject, closeClear, BEHIND_COS } from './close';
import { holdPolish } from './character';
import { samStaggered } from './samstun';
import { canStand } from './player';

export const STALK = {
  on: false,
  /** THE CLICK IS THE ONLY WAY IN (the maintainer: "we should get rid of E to grab then. lmb is the only way"): with the stalk on, a staff man has no 'grab him'
   *  row — the list says 'hold LMB to grab him' and the interaction key does nothing to him. A civilian keeps her row (nobody stalks her). Nothing with `on`
   *  off. ?stalkonly=0 puts the row back beside the stalk. */
  only: true,
  /** m: the press is ON a man when the cursor's floor point is this near him (or the reticle has him) */
  cursorM: 1.1,
  /** cos of his bearing to Sam under which a press can begin one (−0.25 = the grab's own rear arc, 104.5° off his facing) · and past which Sam is no longer
   *  behind him and the stalk is over (93°: a few degrees of grace so a man swaying on his feet does not throw him out) */
  beginCos: -0.25, outCos: -0.05,
  /** m: the point behind his back Sam is walked toward · inside this the hold becomes the grab (under close.ts's reach of 1.05) */
  stationM: 0.55, grabM: 0.95,
  /** m/s: never faster than this · the closing speed on the man at `grabM` · and what each metre beyond it adds */
  pace: 1.6, closeMin: 0.3, closeK: 0.6,
  /** 1/s: how quickly his speed takes up what the stalk asks, speeding up · and slowing (his own walk's are 6 and 12: gentler in, so the creep starts like a breath) */
  easeUp: 4, easeDown: 9,
  /** THE BODY SAYS HOW CLOSE (the maintainer: "we want very very smooth transitions from regular crouching to the closer than ever state. then, once you click
   *  and hold its very smooth to gradually shift the animation until you end on a grab, and you can be interrupted any time"). Behind a man he could stalk, or
   *  stalking him, Sam's pose is a function of the DISTANCE to that man's back and of nothing else: from `reachFrom` m in, the left arm comes up for his neck
   *  (the tell's own reach, character.ts readyLayer, at a weight that is `reach` by the time the grab fires), and from `riseFrom` m in he comes up out of the
   *  crouch (`rise` of the way to his feet by `riseBy` m — the grab itself stands him up the rest). Both run straight by the distance. Because it is the distance's, letting go of the button holds
   *  the pose where it is — a frame of the move, paused — and the next press goes on from it; his own keys behind the same man show the same body. What the men
   *  see and hear of him is the crouch's, as it was. `tell` off = the tell in reach alone, as before the stalk. */
  tell: true, reachFrom: 2.9, reach: 1, riseFrom: 2.3, riseBy: 1.05, rise: 0.7,
  /** THE STEP IN: the grab a stalk ends in closes the last of the gap in one step over `catchSecs` (a step longer than `catchM` takes up to `catchLong` times that: the haul back has what is left of HOLD.secs.grab; `turnIn`: he comes round to the man's back through the step, not in its first frames) —
   *  a lunge: off the mark over its first three frames, most of the way inside a third of it, landing gently (stepEase). The grab's own way in covers a
   *  fifth of the gap in its first FRAME. His legs are given the step, at no more than `catchStride` m/s. 0 = the grab's own.
   *  THE YANK: once the step has landed the man is hauled `yank` m straight back the way he was facing from — Sam going back with him (`yankWith`; off, he stays where he landed and the man comes 11 cm into him) — over what is left of
   *  the grab: movement across the floor is what the game's camera shows of a grab (the pose's share: character.ts HOLD.yank). Less where something solid
   *  stands behind the pair (`yankRoom` m kept clear behind Sam); 0 = he is held where he stood. */
  catchSecs: 0.3, catchM: 0.75, catchLong: 1, turnIn: false, catchStride: 1.5, yank: 0.28, yankRoom: 0.4, yankWith: false,
  /** THE SAME AT A CORNER (the maintainer: "curious if we can make this language work for working corners. like when you're at a corner you can either grab
   *  or CQC with the right timing"). With his back on a wall (the wall hold, not the stack) and his hands empty, the left button HELD is a man lying in wait:
   *  nothing moves, and the moment a man who is not onto him is inside `cornerM` with Sam at least `cornerDeg`° round from his nose — he has come past the
   *  corner, most of a pace — Sam comes off the wall onto him: the grab, by the same eased step in. Pressed too soon it simply waits; let go, nothing happens; a man who comes
   *  round FACING him is not taken (the right button's knockout is still the player's own timing, as off a wall). `corner` off = the button on a wall does
   *  nothing, as before. The page: ?stalkcorner=0. */
  corner: true, cornerM: 1.35, cornerDeg: 110,
  /** BROKEN OFF BY THE MAN (stalkStep): `jolt` = how much of the animator's duck (character.ts flinchFrom, soft) Sam gives when the man turns off his back with
   *  the stalk on AND comes on round to face him (Sam inside `joltFace`° of his nose within `joltSecs` s: a patrol's quarter turn is not that) — the whole of it,
   *  at once, when the man is onto him. 0 = none: the stalk ends and he sinks back into the crouch, as it was. joltFace 180 = at any turn that ends the stalk.
   *  `joltAtOnce` = the duck for a turn on the out's own frame with none of brokeDuck's tests: the fifth pass as it was, raised only by journal.ts for a recording of it.
   *  THE WAIT SHOWS (closeTick): on the wall with the button held he coils — sunk `cornerCoil` of the way into the crouch, the lead hand tucked toward the man at `cornerReach[0]`
   *  of the grab's reach, growing to `cornerReach[1]` as the nearest man he could take comes from `cornerSee` m to `cornerM`; he comes up out of the coil over
   *  `cornerRise` s of the step in. `cornerShow` off = the wall stance alone, as it was.
   *  (Of the polish, so DOWN here: `jolt` 0 and `cornerShow` off — and above, `catchLong` 1, `turnIn` and `yankWith` off. stalkPolish(true) writes POLISH_UP's.) */
  jolt: 0, joltFace: 50, joltSecs: 0.6, joltAtOnce: false, cornerShow: false, cornerSee: 3.2, cornerReach: [0.25, 0.55] as [number, number], cornerCoil: 0.3, cornerRise: 0.24,  /** THE KEY FINISHES IT (the maintainer, having played the creep: "one change we should make is that I think you should really have to hit E to finish
   *  the grab. it feels weird having it happen automatically"). With `key` up the held click only walks him in: inside the grab's reach he eases to a stop `keyM` m
   *  behind the man and waits there — keeping station, at the man's own speed, if the man walks on — and the grab is the row's own, 'grab him' on the interaction's key (E in the page), back
   *  whatever `only` says and taken AS the stalk's: the step in, the landing, the haul back (game.ts, stalkKeyGrab). He may also walk in on his own keys
   *  and press it. A corner's wait still takes its man by itself (its timing is the press). OFF HERE and on the frozen stand: the hold becomes the grab by
   *  itself, as it was. The page: ?stalkkey=0. */
  key: false, keyM: 0.8,
  /** LOWER, HANDS DOWN (the same message: "i do think having the hands up just doesn't look cool. in chaos theory sam starts regular crouch walk, then
   *  goes lower to the ground and creeps much more deliberately (and that's where stopping just pauses the animation). and when he's really close he
   *  reaches for his knife (maybe we'd just have our hands down)"). With `low` up the tell is the other way about: no arm comes up and he does not rise —
   *  from `lowFrom` m in he SINKS, all the way down by `lowBy` m (the shape of it: `lowDrop` and the two after it — the pelvis lower, the back flatter),
   *  still straight by the distance, so letting go holds it; the creep's carriage keeps its hands DOWN at any distance (`lowHands`: the crouch's own, by
   *  his knees); and each metre beyond the reach adds `lowK` m/s to his closing speed where it added `closeK`: slower, the whole way in. He comes up out
   *  of it in the grab, and fast (`lowSpring`, the rate he leaves the crouch at through a stalk's grab, where the animator's own is 10): the spring. OFF
   *  HERE and on the frozen stand: the arm comes up and he rises, as it was. The page: ?stalklow=0. */
  low: false, lowFrom: 2.6, lowBy: 1.1, lowK: 0.35,
  /** …its shape, all the way down (fed to the animator, whose CREEP.low has the same numbers until it is): the pelvis this much lower (m) and further back
   *  (m) and the spine bowed this many degrees more; the share of the carriage's raised hands given up; the spring's rate, and the seconds of the grab it winds up to it over */
  lowDrop: 0.06, lowBack: 0.03, lowLean: 6, lowHands: 1, lowSpring: 18, lowWind: 0.12,
  /** ARMS OUT (under `low`, bare hands, in his crouch). Closing on a man from behind, his hands are not tucked by his knees: each is out `wideOut` m to its own
   *  side of its shoulder, `wideDown` m under it and `wideFwd` m ahead of it (the left `wideLead` m further, the right as far back), open, palm to the floor,
   *  the elbows bent and back (`widePole`, the elbow's way off the shoulder line: left, up, forward): the Chaos Theory creep's, read frame by frame (the first numbers flung them out like wings). It comes with the sink (all of it once he is `wideBy`
   *  of the way down), slowly, and lets go fast (the animator's CREEP.wide rates); it holds for as long as he waits behind the man ("that's where stopping
   *  just pauses the animation"), and goes with the carriage when there is no man in front of him. OFF HERE and on the frozen stand: his hands by his knees, as it was. The page: ?stalkwide=0. */
  wide: false, wideOut: 0.1, wideDown: 0.32, wideFwd: 0.24, wideLead: 0.07, wideBy: 0.35, widePole: [0.45, 0.15, -0.88] as Vec3,
  /** WEIGHT IN IT (the maintainer of the arms above, on a GPU: "(1) looks weird, but (2) also just looks like very static. the chaos theory animations have some real
   *  weight but also smoothness and precision to them"). With `heft` up his trunk and arms are carried by his legs (character.ts CREEP.heft): his back bowed `heftLean` °
   *  further, his shoulders `heftTwist` ° against each step, his weight `heftSide` m over the foot he is on and his hips `heftDip` m lower through the wide of a step,
   *  each hand swung `heftSwing` m ahead and back against its own foot a beat behind the trunk, and `heftSurge` of his setting off and stopping in his back and his hands.
   *  The arms hang from the shoulders with a bent elbow (`heftPole`): `heftOut` m out, `heftDown` m under, `heftFwd` m ahead (behind, so the hands sit by his hips; the left
   *  `heftLead` m further). Ahead of the shoulder they read from the game's camera, side on, as arms held out (his note on a GPU: "almost zombie like"), though not from behind. ON in the page (?stalkheft=0: the arms as they were), OFF here and on the frozen stand. */
  heft: false, heftTwist: 20, heftSwing: 0.11, heftSide: 0.04, heftLean: 4, heftDip: 0.02, heftSurge: 1, heftOut: 0.18, heftDown: 0.4, heftFwd: -0.2, heftLead: 0, heftPole: [0.6, 0, -0.8] as Vec3,
  /** THE STICK (the maintainer: "you click on the guy and then you can drag towards him to move in that direction. like a joystick centered on the guy.
   *  that would make things feel more controlled than right now which feels automatic"). With `drag` up, the press on a man still begins the creep, and the
   *  point on the screen it was made at is the stick's middle: while the button is held, the mouse's way from there is the way Sam creeps (screen up = the
   *  camera's forward, as the move keys have it), and how far it is, from `dragDead` px (nothing) to `dragFull` px (all of it), is how much of `pace`. The
   *  mouse left where it was pressed = he holds still in the pose. He faces the man throughout; he is never walked closer than `keyM` (the way into the man
   *  is taken off the stick there, the way round him is not); the rest is the creep's own rules (the arc, the walls, the key's grab). PROTOTYPE: OFF here,
   *  on the frozen stand AND in the plain page; up in the sneak lab (?sneaklab) and anywhere with ?stalkdrag=1; ?stalkdrag=0 puts it down in the lab. */
  drag: false, dragDead: 14, dragFull: 140,
  /** ROUND HIM (the maintainer: "when you're clicking on an enemy and moving around them, you should really be "orbiting" them"). With `orbit` up, a move
   *  key while the button holds a man no longer ends the creep: the way the keys point is taken round the man, not past him. The part of it toward or away from
   *  him closes or opens the gap; the part across him carries Sam round on the circle he is on (he keeps facing the man, and a pull of `orbitK` per metre off
   *  that circle holds him to it), at the creep's `pace`, and a man who walks takes the circle with him. The stick (`drag`) is taken the same way. He goes no
   *  further round than `orbitEdge` short of the grab's own arc (close.ts BEHIND_COS, inside where the creep ends), and no closer than `keyM`. Keys let go: the held button walks him in as before. With it up he faces the man in any creep, the aim's weight (aimweight.ts, which turned him
   *  to the cursor's floor point, left where the press was) has no say there. A key that is within `orbitSnap` of straight across him (its share toward him,
   *  0.3 ≈ 17°) is taken as all the way across: the screen's keys are seldom square to the man, and one a little off would spiral Sam in or out. ON in the page
   *  (?stalkorbit=0: a move key ends the creep, as it was), OFF here and on the frozen stand. */
  orbit: false, orbitK: 3, orbitEdge: 0.05, orbitSnap: 0.3,
  /** …and with it a press can begin one from further off ("i think we can make the start radius a bit larger too"): inside `lowBeginM`, kept out to `lowOutM`,
   *  where close.ts's mode range (3.0 and 3.6 m) was the limit. From out there he comes on at his plain crouch walk; the mode's carriage and the sink come in inside it */
  lowBeginM: 4.2, lowOutM: 5,
};
/** tallies for the checks and the page's hook (begun = presses that took a man; out = why each ended without a grab) */
export const STALK_STATS = { begun: 0, grabs: 0, corner: 0, out: { let: 0, far: 0, turned: 0, wall: 0, him: 0, hands: 0, keys: 0 }, last: '' };
type Why = keyof typeof STALK_STATS.out;

interface St { on: Guard | null; grab: Guard | null; t: number; /** on a wall with the button held and nothing in the way of a grab: he is lying in wait */ wait?: boolean; /** the button went down and has not come up or taken a man since: a stalk may begin */ armed?: boolean;
  /** STALK.drag: where on the screen (px) the press that began this stalk was made — the stick's middle */ stick?: [number, number] | null;
  /** STALK.orbit: the circle round the man he is held to (m), the frame it was last held on, and the way asked for as it was taken: on the floor, then its
   *  share into the man and its share round him (+ = the way round that turns left about him) */ orbitR?: number; orbitT?: number; orbitAsk?: [number, number, number, number];
  /** the man who broke a stalk off by turning, and when: if he comes round to FACE Sam inside STALK.joltSecs, Sam ducks */ broke?: { gd: Guard; t: number; /** where Sam stood */ at: Vec3 } | null }
const STATE = new SideMap<Game, St>('stalk.STATE');
/** every key from birth and in one order: a restart's state is compared with an untouched level's, key for key, whatever order play reached them in */
const fresh = (): St => ({ on: null, grab: null, t: -1, wait: false, armed: false, stick: null, orbitR: undefined, orbitT: undefined, orbitAsk: undefined, broke: null });
function stateOf(g: Game): St { let s = STATE.get(g); if (!s) { s = fresh(); STATE.set(g, s); } return s; }
function end(S: St, why: Why) { if (S.on) { S.armed = false; S.on = null; STALK_STATS.out[why]++; STALK_STATS.last = why; } S.orbitR = S.orbitT = undefined; S.orbitAsk = undefined; }

/** his bearing to a point, off his facing (0 = dead ahead of him) */
const bearingOf = (gd: Guard, p: ArrayLike<number>): number => wrapAngle(Math.atan2(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]) - gd.char.bodyYaw);
/** are Sam's hands free for it at all (empty, and nothing else has him) */
function hands(g: Game): boolean {
  const pl = g.player;
  return STALK.on && closeLive(g) && !g.puppet && pl.holstered && !pl.down && !pl.holding && !pl.takedown && !pl.dragging && !pl.kick && !pl.picking && !pl.wanding && !pl.wall && !pl.listOpen && able(g);
}
/** …and is the held click his to begin one with (no step of a tutorial mission has taken it) */
const free = (g: Game): boolean => hands(g) && !shut(g);
/** a tutorial mission's step has taken the stalk (rails.ts `shuts`, the frame's word `stalk`): no press begins one, from the floor or from a corner, and
 *  nothing that asks whether he could — the row's hint, the pose that tells — says he can. IT IS THE CLICK THAT IS TAKEN, NOT THE GRAB: the row's key
 *  still grabs a man he has walked up behind, with the stalk's own step in (`stalkKeyCan` asks `hands`), and where the click was the one way to a man
 *  the row is back (`stalkClickOnly`) */
const shut = (g: Game): boolean => !!g.rails?.shuts('stalk');
/** the gate game.ts puts on a grab, so nothing is handed over that it would refuse: not folded by a blast, no hand on a breaker's lever */
const able = (g: Game): boolean => !samStaggered(g) && !g.player.breakerMove;
/** why this man cannot be stalked from `p` right now, or null when he can (`begin`: the stricter test a press must pass — the rear arc itself) */
/** how far off a press can begin one: close.ts's mode range — and with STALK.low the wider `lowBeginM` (he starts at his plain crouch walk and goes lower inside the mode) */
const beginM = (): number => STALK.low ? Math.max(CLOSE.modeM, STALK.lowBeginM) : CLOSE.modeM;
const outM = (): number => STALK.low ? Math.max(CLOSE.modeOutM, STALK.lowOutM) : CLOSE.modeOutM;
/** how far off a press begins a stalk, and how far off one is given up (the lab's rings, close.ts's hint) */
export function stalkBeginM(): number { return beginM(); }
export function stalkOutM(): number { return outM(); }
/** is the held click the ONE way to grab a man from behind (no row grabs him)? `only`, until the key finishes the grab (STALK.key) — and still on a wall,
 *  where the wait at the corner is the click's and no stalk can be the key's */
export function stalkClickOnly(g?: Game): boolean { return STALK.on && STALK.only && (!STALK.key || !!g?.player.wall) && !(g && shut(g)); }   // (a step that takes the click gives the row back: a line that named the click would name a dead button)
function outOf(g: Game, gd: Guard, p: ArrayLike<number>, begin: boolean): Why | null {
  if (gd.civ || !closeSubject(g, gd) || gd.state === 'alert') return 'him';
  const d = Math.hypot(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]);
  if (d >= (begin ? beginM() : outM())) return 'far';
  if (Math.cos(bearingOf(gd, p)) > (begin ? STALK.beginCos : STALK.outCos)) return 'turned';
  if (!closeClear(g, gd.char.pos, p)) return 'wall';
  return null;
}
/** COULD A PRESS ON THIS MAN BEGIN ONE from where Sam stands (the row's hint asks) */
export function stalkCould(g: Game, gd: Guard): boolean { return free(g) && outOf(g, gd, g.player.char.pos, true) === null; }
/** the man a press at the cursor is on: the reticle's if he can be stalked, else the nearest such man within `cursorM` of the cursor's floor point */
function pressed(g: Game): Guard | null {
  const p = g.player.char.pos, a = g.aimPoint;
  if (g.aimGuard && outOf(g, g.aimGuard, p, true) === null) return g.aimGuard;
  let best: Guard | null = null, bd = STALK.cursorM;
  for (const gd of g.guards) { const d = Math.hypot(a[0] - gd.char.pos[0], a[2] - gd.char.pos[2]); if (d < bd && outOf(g, gd, p, true) === null) { best = gd; bd = d; } }
  return best;
}

/** STALK.corner: the man the wait at a corner takes this frame — the nearest who has come past him — or null (not on a wall with empty hands; nobody past) */
function cornerGate(g: Game): boolean {
  const pl = g.player, w = pl.wall;
  return !(!STALK.on || !STALK.corner || !w || w.kind === 'stack' || w.drawn || !closeLive(g) || g.puppet || !pl.holstered || pl.down || pl.holding || pl.takedown || pl.dragging || pl.kick || pl.picking || pl.wanding || pl.listOpen || !able(g) || shut(g) || (pl.crouch && !canStand(g)));   // (the last: startGrab would refuse it, with its line, every frame the button stayed down)
}
function cornerMan(g: Game): Guard | null {
  const pl = g.player;
  if (!cornerGate(g)) return null;
  const p = pl.char.pos, cos = Math.cos(STALK.cornerDeg * Math.PI / 180); let best: Guard | null = null, bd = STALK.cornerM;
  for (const gd of g.guards) {
    if (gd.civ || !closeSubject(g, gd) || gd.state === 'alert') continue;
    const d = Math.hypot(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]);
    if (d < bd && Math.cos(bearingOf(gd, p)) <= cos && closeClear(g, gd.char.pos, p)) { best = gd; bd = d; }
  }
  return best;
}
/** the animator's SOFT duck (character.ts flinchFrom): it leaves a hand's errand alone — a pistol he draws the next instant keeps its draw and its click */
function duck(g: Game, gd: Guard, k: number) { const p = g.player.char.pos; g.player.char.anim.flinchFrom([gd.char.pos[0] - p[0], 0, gd.char.pos[2] - p[2]], k, true); }
/** the man who turned off his back with a stalk on (St.broke): if HE comes on round until where Sam stood is inside `joltFace` degrees of his nose — or he is
 *  onto him — inside `joltSecs`, Sam ducks: part of the duck for the turn, the whole for a man onto him. A man who only turned a quarter (a patrol's corner)
 *  never gets there. Only while Sam's hands are still empty and idle, nobody else is being stalked, he has not gone a pace from where he was caught, and
 *  nothing solid is between them. */
function brokeDuck(g: Game, S: St) {
  const b = S.broke; if (!b) return; const p = g.player.char.pos;
  if (g.time - b.t > STALK.joltSecs || S.on || !free(g) || !closeSubject(g, b.gd) || Math.hypot(p[0] - b.at[0], p[2] - b.at[2]) > 1) { S.broke = null; return; }
  if (!closeClear(g, b.gd.char.pos, p)) return;
  if (b.gd.state === 'alert') { duck(g, b.gd, 1); S.broke = null; }
  else if (Math.abs(bearingOf(b.gd, b.at)) <= STALK.joltFace * Math.PI / 180) { duck(g, b.gd, STALK.jolt); S.broke = null; }
}
/** THE POLISH, UP OR DOWN TOGETHER (the page's ?stalkpolish=0, and journal.ts for a recording from before the fourth pass): the turn through the step, the longer
 *  long step, the wait's pose at a corner, the duck when the man turns round — and the hold's share (character.ts holdPolish). Up = POLISH_UP's numbers, as
 *  the page has them; down = the tables' own, as the frozen stand has them (src/host/standup.ts: TPS_STALKPOLISH=1 raises them on a frozen run). */
const POLISH_UP = { turnIn: true, cornerShow: true, yankWith: true, catchLong: 1.1, jolt: 0.6 } as const;   // (THE PAGE'S NUMBERS — a tuned one goes here, not in the table, which has them down)
const POLISH_DOWN = { turnIn: STALK.turnIn, cornerShow: STALK.cornerShow, yankWith: STALK.yankWith, catchLong: STALK.catchLong, jolt: STALK.jolt } as const;   // (the table's own, read once as this file loads)
export function stalkPolish(up: boolean) {
  const U = up ? POLISH_UP : POLISH_DOWN; STALK.turnIn = U.turnIn; STALK.cornerShow = U.cornerShow; STALK.yankWith = U.yankWith; STALK.catchLong = U.catchLong; STALK.jolt = U.jolt; holdPolish(up);
}
/** what the stalk asks of his feet this frame: the unit direction, the speed, and the point he faces (the man's chest) */
export interface StalkMove { mx: number; mz: number; pace: number; at: Vec3; /** STALK.key, keeping station in reach: his speed follows `pace` closely (the creep's own ease would have him hunt back and forth behind a man who walks) */ keep?: boolean }
/** ONCE A FRAME from updatePlayer, before his keys become a step: the left button held / pressed this frame, and whether a move key of his own is down.
 *  null = his feet and his aim are his own. */
/** STALK.drag: the mouse this frame (px on the view) and the camera's floor axes (player.ts: the move keys' own) */
export interface StalkStick { x: number; y: number; fwd: Vec3; right: Vec3 }
/** STALK.orbit: his move keys this frame as a way across the floor, and the frame's step (s) (player.ts) */
export interface StalkKeys { mx: number; mz: number; dt: number }
export function stalkStep(g: Game, lmb: boolean, lmbHit: boolean, ownKeys: boolean, stick?: StalkStick, keys?: StalkKeys): StalkMove | null {
  const S = stateOf(g); S.t = g.time; S.grab = null; S.wait = false; brokeDuck(g, S);
  if (!free(g)) { end(S, 'hands'); if (lmb || lmbHit) { S.wait = cornerGate(g); const gd = cornerMan(g); if (gd) { S.grab = gd; STALK_STATS.grabs++; STALK_STATS.corner++; STALK_STATS.last = 'corner'; } } return null; }
  if (lmbHit) S.armed = true; else if (!lmb) S.armed = false;
  // (a press made with a move key still down waits for the key: the button held on him begins it the frame his own feet stop — once a press)
  const had = S.on;
  if (!S.on && S.armed && !ownKeys) { const gd = pressed(g); if (gd) { S.on = gd; S.armed = false; STALK_STATS.begun++; S.stick = stick ? [stick.x, stick.y] : null; } }
  const gd = S.on; if (!gd) return null;
  if (!lmb && !lmbHit) { end(S, 'let'); return null; }
  const round = ownKeys && !!keys;   // (STALK.orbit, which alone hands the keys in: they take him round the man, the creep goes on)
  if (ownKeys && !round) { end(S, 'keys'); return null; }
  const p = g.player.char.pos, why = outOf(g, gd, p, false);
  if (why) {   // (STALK.jolt: broken off by the man himself, Sam shrinks back off him — at once when the man is onto him, and when he has turned off his back only if he comes on round to face Sam: brokeDuck; not on the frame a stalk began)
    if (had === gd && STALK.jolt > 0) { if (why === 'him') duck(g, gd, 1); else if (why === 'turned') { if (STALK.joltAtOnce) duck(g, gd, STALK.jolt); else S.broke = { gd, t: g.time, at: [p[0], p[1], p[2]] }; } }   // (joltAtOnce, which only journal.ts raises: the fifth pass's rule to the letter — at any turn, on this frame, whatever stands between them — for a recording of that pass)
    end(S, why); brokeDuck(g, S); return null; }
  const gp = gd.char.pos, at: Vec3 = [gp[0], gp[1] + 1.2, gp[2]], dist = Math.hypot(p[0] - gp[0], p[2] - gp[2]); let hold: number | null = null;   // (hold: keeping station under STALK.key — how far outside `keyM` he is, −1‥1)
  if (dist < STALK.grabM) {
    const o = closeAt(g, gd, p);
    if (o.can && o.grab && !STALK.key) { S.on = null; S.grab = gd; STALK_STATS.grabs++; STALK_STATS.last = 'grab'; }   // (game.ts takes it this frame, where it takes the row's — with STALK.key he waits here for the row's key instead)
    const wait = (o.can && o.grab) || o.win?.grab;   // …or he waits in reach: no room to stand up behind him here (the row says so)
    if (wait && !(STALK.key && o.can && o.grab) && !round) return { mx: 0, mz: 0, pace: 0, at };   // (STALK.orbit: his keys still take him round, out of a place with no room to stand)
    if (wait) hold = clamp((dist - STALK.keyM) / Math.max(1e-3, STALK.grabM - STALK.keyM), -1, 1);   // (STALK.key: in reach with the grab on offer he keeps STATION — the man's own speed, and the last of his closing speed let off over the way from `grabM` in to `keyM` — so a man who walks is followed without a stop and a start, and a man who stands is come up on softly; nearer than `keyM` he gives that much way, down to standing still)
    // …or he is in reach on the man's flank, outside the grab's own arc (the man turned a little): he is walked on round to the point behind his back, below
  }
  if (round) { const L = Math.hypot(keys!.mx, keys!.mz) || 1; return orbited(g, S, gd, p, at, dist, keys!.mx / L, keys!.mz / L, STALK.pace, keys!.dt); }
  if (STALK.drag && stick && S.stick) return dragged(g, S, gd, p, at, dist, stick, S.stick, 1 / 60);
  // toward the point behind his back: from his rear it is a straight line in; from a rear quarter it swings Sam in behind him as he closes
  const yaw = gd.char.bodyYaw, bx = gp[0] - Math.sin(yaw) * STALK.stationM - p[0], bz = gp[2] - Math.cos(yaw) * STALK.stationM - p[2], bl = Math.hypot(bx, bz) || 1;
  const his = Math.hypot(gd.char.vel[0], gd.char.vel[2]);
  if (hold !== null) { const ease = STALK.closeMin * hold; return { mx: bx / bl, mz: bz / bl, pace: Math.min(STALK.pace, Math.max(0, his + (Math.abs(ease) < 0.02 ? 0 : ease))), at, keep: true }; }
  return { mx: bx / bl, mz: bz / bl, pace: Math.min(STALK.pace, his + STALK.closeMin + clamp(dist - STALK.grabM, 0, 4) * (STALK.low ? STALK.lowK : STALK.closeK)), at };
}
/** STALK.drag: the stick's step — the mouse's way from where the press was made, as a way across the floor, and its length as a share of the pace; never
 *  further into the man than `keyM` */
function dragged(g: Game, S: St, gd: Guard, p: ArrayLike<number>, at: Vec3, dist: number, st: StalkStick, mid: [number, number], dt: number): StalkMove {
  const dx = st.x - mid[0], dy = st.y - mid[1], m = Math.hypot(dx, dy), k = clamp((m - STALK.dragDead) / Math.max(1, STALK.dragFull - STALK.dragDead), 0, 1);
  if (k <= 0) return { mx: 0, mz: 0, pace: 0, at, keep: true };
  let mx = st.right[0] * dx - st.fwd[0] * dy, mz = st.right[2] * dx - st.fwd[2] * dy; { const L = Math.hypot(mx, mz) || 1; mx /= L; mz /= L; }   // (screen down is the camera's back)
  if (STALK.orbit) return orbited(g, S, gd, p, at, dist, mx, mz, STALK.pace * k, dt);   // (STALK.orbit: the stick taken round him, as the keys are)
  const ux = (gd.char.pos[0] - p[0]) / Math.max(1e-3, dist), uz = (gd.char.pos[2] - p[2]) / Math.max(1e-3, dist), into = mx * ux + mz * uz;
  let pace = STALK.pace * k;
  if (into > 0 && dist < STALK.keyM + 0.2) { const keep = intoKeep(dist); mx -= ux * into * (1 - keep); mz -= uz * into * (1 - keep); const L = Math.hypot(mx, mz); if (L < 1e-3) return { mx: 0, mz: 0, pace: 0, at, keep: true }; mx /= L; mz /= L; pace *= L; }   // (the last 20 cm into him taken off the stick, all of it 4 cm out — his own speed carries him that far: he comes up to `keyM` and stops, and can still go round)
  return { mx, mz, pace, at, keep: true };
}
/** the share of a way into the man left to it at `dist`: all of it until 20 cm outside `keyM`, none of it from 4 cm outside (his own speed carries him the rest) */
const intoKeep = (dist: number) => clamp((dist - STALK.keyM - 0.04) / 0.16, 0, 1);
/** STALK.orbit: a way across the floor (`dx`, `dz`, of unit length, at `pace`) taken round the man. It is split as it is first asked for (and again whenever it
 *  swings more than 30° off that), into its share toward him and its share round him, and those shares are kept while it is held: a key held across him goes
 *  on round him, not off in a line. The share into him closes the gap (never inside `keyM`); the share round him carries Sam round the circle he is held to
 *  (`St.orbitR`, which only the first share moves), and never past `orbitEdge` short of his back arc's end. */
function orbited(g: Game, S: St, gd: Guard, p: ArrayLike<number>, at: Vec3, dist: number, dx: number, dz: number, pace: number, dt: number): StalkMove {
  const gp = gd.char.pos, d = Math.max(1e-3, dist), ux = (gp[0] - p[0]) / d, uz = (gp[2] - p[2]) / d;   // (toward him)
  const stale = S.orbitR === undefined || S.orbitT === undefined || g.time - S.orbitT > 0.1 || g.time < S.orbitT, A = S.orbitAsk;   // (g.time < orbitT: a load has put the clock back)
  if (stale || !A || dx * A[0] + dz * A[1] < Math.cos(Math.PI / 6)) { const r0 = dx * ux + dz * uz, sn = clamp(STALK.orbitSnap, 0, 0.9), a0 = Math.abs(r0);
    const r1 = a0 <= sn ? 0 : Math.sign(r0) * (a0 - sn) / (1 - sn), t1 = Math.sqrt(Math.max(0, 1 - r1 * r1));   // (nearly across him is across him: `orbitSnap`)
    S.orbitAsk = [dx, dz, r1, (ux * dz - uz * dx) >= 0 ? t1 : -t1]; }
  const K = S.orbitAsk!; let r = K[2], tx = -uz * K[3], tz = ux * K[3];
  if (r > 0) r *= intoKeep(dist);   // (as the stick has it: the last 20 cm into him taken off)
  const tl = Math.hypot(tx, tz);
  if (tl > 1e-4) { const ahead = 0.05 + 0.1 * pace;   // (looked ahead by a tenth of a second of the way round: the ease of his stop carries him on about that far)
    const c0 = Math.cos(bearingOf(gd, p)), c1 = Math.cos(bearingOf(gd, [p[0] + tx / tl * ahead, 0, p[2] + tz / tl * ahead]));
    if (c1 > c0 && c1 > Math.min(STALK.outCos, BEHIND_COS) - STALK.orbitEdge) { tx = 0; tz = 0; } }   // (round toward his flank only as far as `orbitEdge` short of the grab's own arc — and of where the creep ends)
  if (stale) S.orbitR = dist;
  S.orbitR = clamp(S.orbitR! - r * pace * dt, Math.max(STALK.keyM, dist - 0.15), dist + 0.15); S.orbitT = g.time;
  const pull = clamp(STALK.orbitK * (dist - S.orbitR), -1, 1), hv = gd.char.vel;   // (the circle is round the man where he is: a man who walks takes it with him)
  const vx = (tx + ux * r + ux * pull) * pace + hv[0], vz = (tz + uz * r + uz * pull) * pace + hv[2], v = Math.hypot(vx, vz);
  if (v < 1e-3) return { mx: 0, mz: 0, pace: 0, at, keep: true };
  return { mx: vx / v, mz: vz / v, pace: Math.min(v, STALK.pace + Math.hypot(hv[0], hv[2])), at, keep: true };
}
/** THE TELL BY DISTANCE (close.ts closeTick, once a frame): the man Sam's body speaks of — the one stalked, else the nearest he could begin on —
 *  the point the arm goes for (his neck), and how much of the reach and of the rise the distance asks for. null = none of it (the tell as close.ts has it). */
export function stalkTell(g: Game): { gd: Guard; at: Vec3; reach: number; rise: number; /** STALK.low: how far he is sunk, 0‥1 */ low: number } | null {
  if (!STALK.tell || !free(g)) return null;
  const p = g.player.char.pos; let gd = STATE.get(g)?.on ?? null, bd = Infinity;
  if (!gd) for (const x of g.guards) { const d = Math.hypot(p[0] - x.char.pos[0], p[2] - x.char.pos[2]); if (d < bd && d < beginM() && outOf(g, x, p, true) === null) { gd = x; bd = d; } }
  if (!gd) return null;
  const gp = gd.char.pos, d = Math.hypot(p[0] - gp[0], p[2] - gp[2]), neck = gd.char.bones.neck ?? gd.char.bones.head, at: Vec3 = neck ? [neck[0], neck[1], neck[2]] : [gp[0], gp[1] + 1.45, gp[2]];
  // (straight by the distance, not an S: an S did all of its work between 1.8 and 1.5 m and nothing either side — the animator's own easing rounds the ends)
  const by = (from: number, to: number) => clamp((from - d) / Math.max(0.05, from - to), 0, 1);
  if (STALK.low) return { gd, at, reach: 0, rise: 0, low: g.player.crouch ? by(STALK.lowFrom, Math.max(STALK.grabM, STALK.lowBy)) : 0 };   // (hands down, and down he goes — from his crouch: a man walked up on standing is walked up on standing)
  return { gd, at, reach: STALK.reach * by(STALK.reachFrom, STALK.grabM), rise: at[1] - gp[1] > 1.2 ? STALK.rise * by(STALK.riseFrom, Math.max(STALK.grabM, STALK.riseBy)) : 0, low: 0 };   // (a man sat or bent low: nothing to come up for)
}
/** THE WAIT AT A CORNER, ON HIS BODY (close.ts closeTick): lying in wait this frame — where his hands point (the neck of the nearest man he could take, else
 *  out from the wall at his own shoulder height), how much of the grab's reach, and how far he is sunk */
export function stalkWait(g: Game): { at: Vec3; reach: number; coil: number } | null {
  const S = STATE.get(g), pl = g.player, w = pl.wall; if (!STALK.cornerShow || !S || !S.wait || !w || g.time - S.t > 0.1 || !cornerGate(g)) return null;
  const p = pl.char.pos; let best: Guard | null = null, bd = STALK.cornerSee;
  for (const gd of g.guards) { if (gd.civ || !closeSubject(g, gd) || gd.state === 'alert') continue; const d = Math.hypot(p[0] - gd.char.pos[0], p[2] - gd.char.pos[2]); if (d < bd && closeClear(g, gd.char.pos, p)) { best = gd; bd = d; } }
  const neck = best ? best.char.bones.neck ?? best.char.bones.head : null, R = STALK.cornerReach;
  const at: Vec3 = neck ? [neck[0], neck[1], neck[2]] : best ? [best.char.pos[0], 1.45, best.char.pos[2]] : [p[0] + w.n[0] * 0.8, 1.35, p[2] + w.n[2] * 0.8];
  const near = best ? clamp((STALK.cornerSee - bd) / Math.max(0.05, STALK.cornerSee - STALK.cornerM), 0, 1) : 0;
  return { at, reach: R[0] + (R[1] - R[0]) * near, coil: STALK.cornerCoil };
}
/** a man is being stalked, or the stalk has just become a grab: this frame's left click is the stalk's, no blow */
export function stalkHas(g: Game): boolean { const S = STATE.get(g); return !!S && S.t === g.time && (!!S.on || !!S.grab); }
/** the man the stalk reached this frame: the grab to take now (game.ts) */
export function stalkGrab(g: Game): Guard | null { const S = STATE.get(g); return S && S.t === g.time ? S.grab : null; }
/** STALK.key: the row's grab on this man is about to be taken (game.ts) — is it the stalk's? With the key's rule up, his hands as a stalk wants them and
 *  room to come up it is, whether the held click walked him in or his own keys did. A question only: `stalkKeyTook` once the grab has him. */
export function stalkKeyCan(g: Game, gd: Guard): boolean {
  const pl = g.player;
  return STALK.on && STALK.key && !gd.civ && hands(g) && !(pl.crouch && !canStand(g)) && outOf(g, gd, pl.char.pos, false) === null;   // (`hands`, not `free`: a step that takes the held click leaves the key's grab as it is)
}
/** …and the grab took him: the stalk on him (if any) is over, counted as a grab */
export function stalkKeyTook(g: Game) { const S = stateOf(g); S.on = null; S.armed = false; STALK_STATS.grabs++; STALK_STATS.last = 'grab'; }
/** the man being stalked right now, for the picture and the checks */
export function stalkOn(g: Game): Guard | null { return STATE.get(g)?.on ?? null; }
/** a reset of the floor's men (game.ts resetGuards), a load: nothing is stalked */
export function stalkReset(g: Game) { const S = STATE.get(g); if (S) Object.assign(S, fresh()); }

/** the step in's ease (STALK.catchSecs), 0‥1 → 0‥1: he is off the mark over the first `P` of it (a quadratic, so the first frame is no snap) and from there
 *  it is a cubic ease-out, joined with one slope: some three fifths of the way inside a third of the time, landing gently */
export function stepEase(u: number): number {
  const v = clamp(u, 0, 1), P = 0.15, B = 1 / ((1 - P) * (1 - P) * (1 + 0.5 * P)), A = 3 * B * (1 - P) * (1 - P) / (2 * P);
  return v < P ? A * v * v : 1 - B * (1 - v) ** 3;
}
