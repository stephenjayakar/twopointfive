// A SPRINT INTO A DOOR HAS WEIGHT (the maintainer, 10-13, while playing: "sprinting through a door needs some work, maybe bashing the door (and keeping a lot
// of momentum) if it opens out, kicking the door if it's the other way?").
//
// What a run at an unlocked door was: the leaf flung at 7.5 rad/s with the loud 'bash' and not a centimetre a second off his run — from EITHER face: the one it
// opens toward was hauled round through his own body at the same speed for the same nothing. A door weighed nothing and had no front or back to a runner.
// Now, for the player at a sprint (a teammate never sprints; a guard at a run is as he was):
//   · THE FACE IT OPENS AWAY FROM — a shoulder through it (`bashed`): the leaf leaves his shoulder at `bashVel` (faster than he runs: it leads him), he keeps
//     `keep` of his speed square on (a glancing shoulder costs less: the share is taken off the part of his run that went INTO the leaf) and has it back by the
//     sprint's own acceleration, about a quarter of a second; his body turns the shoulder nearer the latch into it for `leanSecs`, his head staying on the run.
//   · THE FACE IT OPENS TOWARD — A BOOT AT THE RUN (the maintainer's pick, 10-14, with the handle rip built and played: "Make it a kick"). A frame holds an
//     ordinary boot from that face (doors.ts DOORWAY.frameHolds — his own rule, and it stands for every other boot); a man's whole run behind the sole is the
//     exception: the leaf goes THROUGH its frame, off its hinges, away from him (doorblast.ts tearOff — the loose slab a charge makes of it, thrown `kickK` as
//     hard; with no room beyond the frame to lie in, that module's own rule: flat to the far wall and back down through its doorway — it hurts nobody), as
//     loud as any kicked door, and the door is gone for the night. A leaf somebody opens under the wind-up is not kicked at all. He plants a stride short of it (sprintDoorKick sees the leaf coming: the kick
//     starts at the kicking distance plus what his speed carries him, so he is eased FORWARD onto the spot; a run begun too near the leaf for that is the handle), is
//     rooted for the blow and has his legs again `kickFree` seconds in (never before half a second: the blow lands at 0.38); the sprint comes back by itself with Shift still held.
//     Where a boot cannot do that — the frame rule off or a show on the stage, a steel door, a leaf standing ajar off its frame, doors that never come off
//     (DOORBLAST.on false), the run too slow or too glancing to be a kick, `kick: false` — it is THE HANDLE, as first built: he checks to `ripPace` of the
//     sprint (about a walk), rips it round at `ripVel` — quicker than a walked pull, quieter than a shoulder (`ripLevel`) — and the run comes back after
//     `ripSecs`. The leaf passes him as a pulled leaf passes anyone (the one-way doors' pull).
//   · LOCKED against him: as it was — the kick from the face it opens away from, a wall from the other (game.ts updateDoors, doors.ts): a lock still means
//     a pick, a key or a charge from that face.
// The two stamps it keeps are on the Player (doorBashAt / doorBashLean / doorRipUntil) and ride a checkpoint while one is running (savestate.ts); a kick under
// way is the Player's own `kick`, and `doorKickTail` while its leg is still coming down with his legs already his own: a checkpoint is refused through both.
//
// `on`: ON in the page (src/host/profile.ts pageSwitches; ?nosprintdoor = a run at a door as it was), OFF in the module and on the harness's frozen stand
// (TPS_SPRINTDOOR=1). Off = no contact carries `run`, nothing here is read: the build as it was. Never under a show or with the puppet's strings on him.
import type { Game, Player } from './game';
import type { Door, DoorContact } from './doors';
import { DOORBLAST } from './doorblast';

export const SPRINTDOOR = { on: false,
  /** the share of his speed he keeps through a shoulder bash taken square on (under about 0.65 it reads as glue) */
  keep: 0.75,
  /** rad/s the leaf leaves his shoulder at (it was 7.5: at a 4.7 m/s run the leaf rode his chest; at 9 it leads him) */
  bashVel: 9,
  /** rad his body turns the latch-side shoulder into the leaf, and the seconds it takes to come back square (0 = no turn) */
  lean: 0.45, leanSecs: 0.25,
  /** the face it opens toward: the share of the sprint he is checked to, for how long, the rad/s the leaf comes round at and how loud that is (a bash is 1) */
  ripPace: 0.3, ripSecs: 0.3, ripVel: 6, ripLevel: 0.55,
  /** the face it opens toward, shut in its frame: a boot at the run takes it off its hinges (false = the handle, whatever the door) */
  kick: true,
  /** how hard the boot throws the slab, 0‥1 of DOORBLAST.speed (a charge set on the leaf is 0.55) · the m/s INTO the leaf under which a run is no kick ·
   *  seconds into the one-second kick at which his legs are his own again (1 = the whole kick, as a kick at a locked door) */
  kickK: 0.25, kickInto: 2.5, kickFree: 0.8,
};
/** QA: shoulders through, handles ripped and leaves booted off their hinges since the last reset */
export const SPRINTDOOR_STATS = { bashes: 0, rips: 0, kicks: 0 };

const live = (g: Game, pl: Player) => SPRINTDOOR.on && !pl.down && !g.puppet && !g.touring;

/** What his door contact carries this frame (game.ts updateDoors): the rule's numbers while he is at a sprint, nothing otherwise. */
export function sprintDoorRun(g: Game, pl: Player): DoorContact['run'] {
  return live(g, pl) && pl.sprinting ? { bash: SPRINTDOOR.bashVel, rip: SPRINTDOOR.ripVel, ripLevel: SPRINTDOOR.ripLevel } : undefined;
}

/** metres off the leaf a kick is thrown from (Doors.kickSpot), and the rate (1/s) updateKick eases him onto that spot: a kick begun at KICK_OFF + speed / KICK_EASE
 *  off the leaf starts its ease at the speed he is running at */
const KICK_OFF = 0.76, KICK_EASE = 12;
/** how much nearer the leaf than the kicking spot a kick may still begin (m): nearer than that he would be reeled back off the leaf to throw it — there it is
 *  the handle (a run begun on top of the door) */
const KICK_NEAR = 0.06;

/** THE BOOT AT THE RUN (game.ts updateDoors, once the doors are resolved): the leaf his sprint is about to meet from the face it opens toward, when a boot is
 *  the thing to do about it — shut in its frame where the frame would hold an ordinary boot (Doors.bootHolds: hung, not steel, the frame rule live), not locked
 *  against him, a door that can come off, his run square enough to land on the leaf and fast enough into it, floor to plant on. null = no kick this frame
 *  (he runs on, and if he reaches the leaf it is the handle). */
export function sprintDoorKick(g: Game, pl: Player): Door | null {
  if (!SPRINTDOOR.kick || !live(g, pl) || !pl.sprinting || pl.kick || pl.picking || pl.coding || pl.takedown || pl.holding || !DOORBLAST.on) return null;
  const c = pl.char, vx = c.vel[0], vz = c.vel[2];
  for (const d of g.doors.list) {
    if (d.locked || !g.doors.bootHolds(d, c.pos)) continue;
    const a = d.def.closedDir + d.angle, ux = Math.cos(a), uz = Math.sin(a), px = c.pos[0] - d.def.hinge[0], pz = c.pos[2] - d.def.hinge[1];
    const perp = ux * pz - uz * px, s = perp >= 0 ? 1 : -1, off = Math.abs(perp);
    const into = (uz * vx - ux * vz) * s;   // his speed INTO the leaf (its normal on his side is (−u.z, u.x)·s)
    if (into < SPRINTDOOR.kickInto || off > KICK_OFF + into / KICK_EASE || off < KICK_OFF - KICK_NEAR) continue;
    const meet = px * ux + pz * uz + (vx * ux + vz * uz) * (off / into);   // where along the leaf his run lands
    if (meet < 0.1 || meet > d.def.width - 0.05) continue;
    const spot = g.doors.kickSpot(d, c.pos).pos;
    if (g.col.nav.isBlocked(spot[0], spot[2]) || g.col.solidBlocked([c.pos[0], 0.5, c.pos[2]], [spot[0], 0.5, spot[2]])) continue;
    return d;
  }
  return null;
}

/** seconds after a shoulder through one leaf in which the next leaf costs nothing more (a pair of leaves, a second door a stride on: one blow, not two) */
const AGAIN = 0.4;
/** seconds his body takes to come back square after the turn has run out (player.ts counters it with his head for the turn and this long after) */
const SETTLE = 0.2;

/** After the doors have been resolved: what the leaf he ran open or ripped round cost him. */
export function sprintDoorAfter(g: Game, pl: Player, own: DoorContact): void {
  const c = pl.char; if (!own.run) return;
  const sp = Math.hypot(c.vel[0], c.vel[2]);
  if (own.bashed && g.time - pl.doorBashAt >= AGAIN) { const d = own.bashed;
    // the part of his run that went into the leaf, as it stood when he met it (ajar, less of it does: a leaf half open across his way is a glancing blow)
    const a = d.def.closedDir + (own.bashedAt ?? 0), nx = -Math.sin(a), nz = Math.cos(a); const sq = sp > 1e-3 ? Math.min(1, Math.abs(c.vel[0] * nx + c.vel[2] * nz) / sp) : 1;
    const k = 1 - (1 - SPRINTDOOR.keep) * sq;
    pl.speedSm *= k; c.vel = [c.vel[0] * k, 0, c.vel[2] * k];
    // the shoulder nearer the latch leads: which way that turns him is the side of his run the hinge is on
    const hx = d.def.hinge[0] - c.pos[0], hz = d.def.hinge[1] - c.pos[2]; const cross = c.vel[0] * hz - c.vel[2] * hx;
    pl.doorBashAt = g.time; pl.doorBashLean = cross >= 0 ? -1 : 1;
    SPRINTDOOR_STATS.bashes++;
  }
  if (own.ripped) {
    const cap = g.tune.playerSprint * SPRINTDOOR.ripPace, now = Math.hypot(c.vel[0], c.vel[2]);
    if (now > cap) { const k = cap / now; c.vel = [c.vel[0] * k, 0, c.vel[2] * k]; }
    pl.speedSm = Math.min(pl.speedSm, cap); pl.doorRipUntil = g.time + SPRINTDOOR.ripSecs;
    SPRINTDOOR_STATS.rips++;
  }
}

/** The share of his top speed his run is held to this frame (player.ts): `ripPace` while his hand is ripping a leaf round, else 1. */
export function sprintDoorPace(g: Game, pl: Player): number { return live(g, pl) && g.time < pl.doorRipUntil ? SPRINTDOOR.ripPace : 1; }

/** Is the turn of his shoulder into a leaf (or his head coming back off it) still running: what a checkpoint asks before it writes the stamp. */
export function sprintDoorTurning(g: Game, pl: Player): boolean { return SPRINTDOOR.leanSecs > 0 && g.time - pl.doorBashAt < SPRINTDOOR.leanSecs + SETTLE; }

/** Radians added to the yaw his body runs at (player.ts): the shoulder turned into the leaf he has just gone through, easing back square. null = no turn
 *  running and none just ended: the sprint's facing exactly as it was. Read off the stamp alone — the stamp is only ever written with the rule live, and a turn
 *  under way when the switch is thrown runs out instead of snapping. */
export function sprintDoorLean(g: Game, pl: Player): number | null {
  if (!sprintDoorTurning(g, pl)) return null;
  const t = (g.time - pl.doorBashAt) / SPRINTDOOR.leanSecs; if (t < 0) return null;
  return t >= 1 ? 0 : pl.doorBashLean * SPRINTDOOR.lean * (1 - t) * (1 - t);
}

/** The look his head is given while his body is `off` radians off his run (player.ts → CharacterAnimator.lookYawExtra): the same angle back the other way. */
export function sprintDoorHead(off: number): number { const w = off - Math.round(off / (2 * Math.PI)) * 2 * Math.PI; return Math.abs(w) < 1e-6 ? 0 : HEAD_SIGN * w; }
/** which way lookYawExtra turns a head against the body's yaw (+ = to his left; the body's yaw is atan2(x, z)) */
const HEAD_SIGN = -1;
