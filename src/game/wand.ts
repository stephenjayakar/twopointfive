// The optical wand: a scope on a cable, fed under a shut door to see the room behind it before anybody opens it (SWAT 4's Optiwand, Ready or Not's mirror gun,
// Chaos Theory's optic cable). A piece of KIT: a row of YOUR card (kit.ts `MemberKit.wand`, one pouch — slots.json tool `wand`), written onto the Player
// (`Player.wand`) by kitPlayer. A TEAMMATE's card can carry one too (`WAND.mate`), and he uses it ONLY on your order: wandorder.ts (the order, his kneel,
// his lens as one of the fog's eyes) — never by himself.
//
// ONE SWITCH, `WAND.on`: ON in the page (`?nowand` = the kit card has no such row and no door offers the look — the build as it was), OFF in the module and on
// the frozen harness stand (`TPS_WAND=1`); a FROZEN_HOLDS row, in the knob registry and a journal's tables. With nobody carrying one, on = off by run digest.
//
// WHAT IT IS IN PLAY. At a SHUT door in reach, with fog of war up (the squad missions and a quiet mission with a fog rung: elsewhere the picture already shows
// every room, there is nothing to look for and the row is not offered), the door's rows carry 'look under it'. It is a sustained verb like the lock pick
// (player.ts startWand / updateWanding / stopWand; interact.ts stops it on a step, Space or Esc): he kneels at the middle of the leaf, both hands on it, gun
// away, and after `feedSecs` (`quick`, the page: as he gets there) the lens is LIVE. From then, in fogofwar.ts, HIS OWN EYE IS THE LENS (`wandEye` stands in his eye's place among the fog's eyes —
// tunnel vision: his own eyes are in the scope, the teammates' still count): a point `pastM` beyond the leaf at `eyeY` off the floor, a wedge of `fovDeg`
// turned by the CURSOR (the aim point, an input) at `panRate`, never nearer than `blindDeg` to the wall the door is in — the hard corners beside the door are
// not his to see. Everything else is the fog's own model, picture and CPU alike: a level line at the lens's height, so anything standing on the floor hides
// what is behind it; a man is seen by a line to his chest or his head. No rule of its own for the dark: the fog never asked for light, and the picture shows a
// dark room dark (his goggles help as they help his own eyes: N works on his knee at the door, `WAND.nv`).
//
// WHAT HE KEEPS. A man who was in the lens when he was last seen is marked where he stood with the fog's own fading '(?)' for `markSecs` after
// (fogofwar.ts lastSeen, the HUD's alone — nobody's AI reads it). Pulling the wand out leaves no round until the gun is back up: with kit
// handling on (the page) it is drawn by hand like any kit change and the lock-out is that draw's own (kitanim.ts, about half a second for the pistol, more off
// the back for the rifle); with it off, `stowSecs`.
//
// WHAT IS NOT HERE: nobody on the far side notices the lens; no sound is filed; the two-man recon role (a partner who scouts by himself) is parked by the maintainer; a steel fire
// door has no gap to feed it through and a door off its hinges is a doorway. No dice, no GPU read, nothing of the camera: the aim point is the frame's input.
// State is the Player's (`wand`, `wanding`): `wand` rides a checkpoint's player slice; a look under way refuses a plain save (savestate.ts playerBusy) and is
// simply not in a forced one (a fresh Player is not looking).
import type { Game, Player } from './game';
import type { Door } from './doors';
import type { Vec3 } from '../math/vec';
import type { FogEye } from './fogofwar';
import { FOG, fieldDeg } from './fogofwar';
import { STEALTHPOSE } from './stealthpose';   // (read inside a function only)

export const WAND = {
  /** the switch (page on, ?nowand; frozen stand off, TPS_WAND=1) */
  on: false,
  /** s kneeling, hands on it, before the lens shows anything */
  feedSecs: 1.5,
  /** s without a round or a throw after it is pulled out (with kit handling on the gun's own draw by hand is the lock-out instead) */
  stowSecs: 0.6,
  /** the lens's wedge, degrees (under the cone fog of hard the wedge is the cone's own: the picture's soft edge is one number for every eye) */
  fovDeg: 90,
  /** degrees either side, at the wall the door is in, the wedge never turns into */
  blindDeg: 10,
  /** how fast the lens turns after the cursor, rad/s */
  panRate: 1.6,
  /** the lens off the floor, m */
  eyeY: 0.1,
  /** the lens past the leaf's middle plane, m (clear of the wall's far face: the levels' walls are 0.12 to 0.24 thick) */
  pastM: 0.22,
  /** s a man last seen through it keeps his '(?)' where he stood */
  markSecs: 15,
  /** the leaf counts as shut inside this angle of home, rad (doors.ts's own 'home' for a boot is the same 0.05) */
  shutRad: 0.05,
  /** s kept off his spot before he gives it up (a man standing where he must kneel, furniture in the way) */
  giveUpSecs: 2.5,
  /** N is read while he looks: the goggles go down / up by a nod (his hands are on the cable) and the picture follows as anywhere else. false = N did
   *  nothing on his knee at the door, as it was (a recording from before the key replays so) */
  nv: true,
  /** a TEAMMATE can carry the wand and be ORDERED to look under a door (wandorder.ts): ON in the page, `?nowandmate` = yours alone, as it was; OFF here
   *  and on the frozen stand (`TPS_WANDMATE=1`). Acts only with `on`. A recording from before the key replays with it off. */
  mate: false,
  /** the order's key on a door's menu (X on the door, then this): no digit is free there, and nothing is ever on a digit above 5 */
  orderKey: 'KeyV',
  /** seconds for a teammate's lens to sweep from one end of its arc to the other and back (nobody aims it for him) */
  sweepSecs: 5,
  /** THE QUICK SET-UP (the maintainer: "setting up the optical wand should be faster. pretty much just the time for the animation and none of the waiting
   *  time with the spinner (which we can probably just remove)"): the lens is through as soon as he is down on his knee with his hands on it and the
   *  animation's time has passed since he started down (wandFeedSecs) — nothing after it — instead of `feedSecs` on his knee; a teammate's FIRST look
   *  the same from his mark at the door (fed again after a fight or a flash took him off it, it is the old `feedSecs`: a lull is not a set-up); the
   *  row that says a look is under way draws no ring and no bar, and the log says one line, not two. ON in the page (`?nowandquick` = the 1.5 s feed and its ring, as it was), OFF here and on the frozen stand (`TPS_WANDQUICK=1`).
   *  Acts only with `on`. A recording from before the key replays with it off. */
  quick: false,
  /** s from the start of the look (a teammate: from on his mark at the door) to the lens through, with `quick`, where the squat at the door is not drawn
   *  (a teammate, the stealth poses off): the kneel's own time. Where it IS drawn the wait is the squat's own `cableIn` (stealthpose.ts) — wandFeedSecs.
   *  Never before he is down on his knee (`quickDown`), and for Sam never before both hands are on it, however long putting the gun away takes */
  quickSecs: 0.4,
  /** how far down the kneel must be (the animator's crouch, 0‥1) before a quick lens is through */
  quickDown: 0.9,
};
export const WAND_STATS = { looks: 0, live: 0, marked: 0 };

/** a look under way (Player.wanding): the door, the face he kneels on (Doors.side's sign), seconds on his knee there, the lens's turn off square (rad, + =
 *  counter-clockwise seen from above in the game's yaw sense), whether the lens is through, and how long he has been kept off his spot */
export interface Wanding { door: Door; side: 1 | -1; t: number; pan: number; live: boolean; /** seconds running he has been off his spot (shoved, or never got there) */ off: number; /** seconds since the look began (WAND.quick counts these, not `t`) */ age: number }

/** a door the wand goes under: shut HOME (a leaf standing ajar is a gap to look through, not a door to feed a cable under — and a leaf somebody starts to
 *  open ends the look within a frame or two, not a quarter radian later), on its hinges, not the steel fire door */
export function wandFits(d: Door): boolean { return !d.off && Math.abs(d.angle) < WAND.shutRad && !d.def.steel; }
/** is 'look under it' on this door's rows for this player: the switch, the wand on him, a fog to look through, a door it fits */
export function wandOffered(g: Game, pl: Player, d: Door): boolean { return WAND.on && pl.wand && g.fogOfWar.active && wandFits(d); }

/** the wait before the lens is through, as the keys stand: `feedSecs` on his knee, or with `quick` the animation's time from the start of the look —
 *  `squat`: the squat at the door is what is drawn (Sam with the stealth poses on), whose own blend in is the time; else the kneel's `quickSecs` */
export function wandFeedSecs(squat = false): number { return !WAND.quick ? WAND.feedSecs : squat && STEALTHPOSE.on && STEALTHPOSE.cable ? STEALTHPOSE.cableIn : WAND.quickSecs; }
/** is the lens through this step, for a man the caller has found planted: `t` s on his knee, `age` s since the look began, `crouch` the animator's kneel */
export function wandThrough(t: number, age: number, crouch: number, squat = false): boolean {
  return WAND.quick ? age >= wandFeedSecs(squat) - 1e-6 && crouch >= WAND.quickDown : t >= WAND.feedSecs;   // (1e-6: `age` is a sum of steps — 24 sixtieths are a hair under 0.4)
}

/** the wedge in force, degrees */
export function wandFov(): number { return Math.min(170, Math.max(20, FOG.cone ? fieldDeg() : WAND.fovDeg)); }
/** the most the lens turns off square, rad */
export function wandPanMax(): number { return Math.max(0, 90 - wandFov() * 0.5 - WAND.blindDeg) * Math.PI / 180; }

/** where the lens is and the way it faces square on: the leaf's middle, `pastM` out of the face he is NOT on */
export function wandLens(d: Door, side: 1 | -1): { pos: Vec3; yaw: number } {
  const [hx, hz] = d.def.hinge, u = d.dir(), w = d.def.width * 0.5;
  const nx = u[1] * side, nz = -u[0] * side;   // (doors.ts workSpot's normal, turned round: out of the leaf on the far side)
  return { pos: [hx + u[0] * w + nx * WAND.pastM, WAND.eyeY, hz + u[1] * w + nz * WAND.pastM], yaw: Math.atan2(nx, nz) };
}
/** turn the lens toward the frame's aim point, at its rate, inside its stops */
export function wandTurn(W: Wanding, aim: Vec3, dt: number) {
  const L = wandLens(W.door, W.side), max = wandPanMax();
  let want = Math.atan2(aim[0] - L.pos[0], aim[2] - L.pos[2]) - L.yaw; want = Math.atan2(Math.sin(want), Math.cos(want));
  want = Math.max(-max, Math.min(max, want));
  const step = WAND.panRate * dt; W.pan += Math.max(-step, Math.min(step, want - W.pan)); W.pan = Math.max(-max, Math.min(max, W.pan));
}
/** THE LENS AS ONE OF THE FOG'S EYES (fogofwar.ts update asks it in place of the player's own eye), or null while nobody is looking */
export function wandEye(g: Game): FogEye | null {
  const pl = g.player, W = pl.wanding; if (!W || !W.live || pl.down) return null;
  const L = wandLens(W.door, W.side), a = L.yaw + W.pan;
  return { id: pl.char.id, pos: L.pos, look: [Math.sin(a), 0, Math.cos(a)], at: L.pos, fov: wandFov(), near: 0, wand: true };
}
/** the look let go of with nothing said (a round into him, a blast, the door blown off its hinges, going down, a kick, a teleport: combat.ts, frag.ts,
 *  doorblast.ts, player.ts) — player.ts stopWand is the worded way out */
export function wandDrop(pl: Player) {
  if (!pl.wanding) return;
  pl.wanding = null; pl.char.anim.lockpick = false; pl.equipT = Math.max(pl.equipT, WAND.stowSecs);
}
/** a line for the debugger */
export function wandSummary(g: Game): string {
  const pl = g.player, W = pl.wanding;
  return `${WAND.on ? 'on' : 'off'} · ${pl.wand ? 'carried' : 'not carried'}${W ? ` · under ${W.door.def.name} ${W.live ? `live, ${(W.pan * 180 / Math.PI).toFixed(0)}°` : `feeding ${W.t.toFixed(1)} s`}` : ''} · looks ${WAND_STATS.looks}, marked ${WAND_STATS.marked}`;
}
