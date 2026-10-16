// The player's aim has WEIGHT (the maintainer, 10-12: "we should have limited turning rate + the aiming circle can lag behind the cursor (like helldivers 2)").
//
// Two marks, two meanings. The CURSOR is where he wants to aim: `g.aimPoint`, the world point under it (or what the reticle snapped to), moves the frame the
// mouse does and everything that read it before still reads it (the camera's lead, the order menu, the wall hold's step-out). The CIRCLE is where the gun
// points: the gun's heading (`Character.aimYaw`) is stepped toward the cursor's bearing by a critically damped spring with a TOP RATE — `AIMWEIGHT.rate`
// rad/s × the handling of what is in his hands raised to `heft` (weapons.ts handlingOf: the pistol 1, the rifle 0.8; empty hands `bare`) — so a flick to a new bearing is a
// swing that takes time, a small correction is still quick, and it lands on the point without overshoot. What leaves the gun while the circle is still
// travelling goes where the CIRCLE is (`aimWeighShot`): a round at once; a launcher's load waits up to `launchWait` for the circle to arrive, its arc drawn
// (`aimWeighLaunch`). Once the circle is on the cursor (within `onM` across the line at the
// target's range) every shot is exactly the shot the build fired before.
//
// ONE switch, `AIMWEIGHT.on`: ON in the page (`?noaimweight`), OFF in the module and on the frozen harness stand (`TPS_AIMWEIGHT=1`); a `FROZEN_HOLDS` row,
// in the knob registry and a journal's tables — a recording from before the table replays with it off. Off = nothing here runs: the exponential ease of the
// build, the ring on the cursor. Never under a puppet or a show (their aims are scripted points), never for anybody but the player. No dice, no camera, no
// pixels: every number is radians, seconds or metres off the Player's own state (`Player.aimw`), which rides a checkpoint while a swing is running.
import type { Game, Player } from './game';
import { Vec3, wrapAngle, clamp } from '../math/vec';
import { handlingOf } from './weapons';

export const AIMWEIGHT = { on: false,
  /** top rate the gun's heading turns at, rad/s, for a gun of handling 1 (the pistol); × handlingOf(the gun in his hands) */
  rate: 11,
  /** seconds: the spring's time constant — how soon a small correction lands, and how far the gun trails a steadily moving cursor (rate × this) */
  smooth: 0.05,
  /** how much a heavier gun slows the turn: the top rate is × handling ^ this (1 = the men's own share; the rifle's 0.8 alone is hard to feel) */
  heft: 1.5,
  /** the handling of empty hands (a holstered / slung gun, a can in the fist): he turns his head and shoulders, not a weapon */
  bare: 1.25,
  /** metres across the line, at the target's range (never less than a metre out), inside which the gun counts as ON the cursor: shots are the build's own */
  onM: 0.3,
  /** how fast the circle's RANGE and height follow the cursor's, 1/s (picture only: a round flies along the heading whatever the range) */
  reach: 18,
  /** seconds a launcher's load, let go of while the tube is still swinging, waits for the circle to reach the cursor (its arc drawn meanwhile); past that it goes
   *  where the circle is. 0 = sent the frame the button comes up, wherever the circle is (as the weight first shipped) */
  launchWait: 0.5,
};
/** QA: swings stepped / shots that left the gun off the cursor since the last reset */
export const AIMWEIGHT_STATS = { steps: 0, offShots: 0 };

/** The player's lag state. `live` = the weighted turn drove his aim on his last update (the plain aim branch, switch on, no puppet): only then is there a
 *  circle apart from the cursor. */
export class AimWeight {
  /** the gun heading's rate, rad/s (signed) */
  vel = 0;
  /** the circle's range from his feet and its height, eased onto the cursor's */
  r = 0; y = 0;
  live = false; was = false;
  /** the swing is over: the circle IS the cursor's point (aimGunPoint hands that very point back, not one rebuilt from an angle) */
  landed = true;
  /** what drives vs. what is read: the gun is within `onM` of the cursor's line (always true when not live) */
  on = true;
  /** radians the gun still has to turn to be on the cursor's bearing (signed; 0 when not live) */
  err = 0;
  /** seconds a let-go launcher load has waited on the swing (aimWeighLaunch) */
  launchT = 0;
}

const can = (g: Game) => AIMWEIGHT.on && !g.puppet && !g.touring && !g.player.down;

/** First thing in the player's update: this frame has not weighed his aim yet (a branch that drives his yaw itself — a sprint, a wall, a man in his arm —
 *  leaves it so, and the next weighted frame starts from rest). */
export function aimWeighBegin(pl: Player): void { const w = pl.aimw; w.was = w.live; w.live = false; w.on = true; w.landed = true; w.err = 0; }

/** The plain aim branch's step: turn `aimYaw` toward the bearing of the cursor's point. Returns false with the switch off (the caller keeps its own ease). */
export function aimWeighTurn(g: Game, dt: number): boolean {
  if (!can(g)) return false;
  const pl = g.player, c = pl.char, w = pl.aimw, ap = g.aimPoint;
  const dx = ap[0] - c.pos[0], dz = ap[2] - c.pos[2], d = Math.hypot(dx, dz);
  if (!w.was) { w.vel = 0; w.r = d; w.y = ap[1]; }
  w.live = true; AIMWEIGHT_STATS.steps++;
  let err = 0;
  if (d > 0.25 && dt > 0) {
    const gun = pl.gunInHand();
    const top = Math.max(0.5, AIMWEIGHT.rate * (gun ? Math.pow(handlingOf(gun.def), Math.max(0, AIMWEIGHT.heft)) : AIMWEIGHT.bare));
    const T = Math.max(1e-3, AIMWEIGHT.smooth), om = 2 / T, lim = top * T;   // (the spring pulls on at most `lim` of error: that is the top rate)
    const y0 = c.aimYaw, err0 = wrapAngle(Math.atan2(dx, dz) - y0); err = err0;   // how far round the cursor is from the gun
    // stepped in slices of 1/240 s at most, each the spring's exact answer for a point held still: the swing is the same at 60, 120 and 144 frames a second
    const n = clamp(Math.ceil(dt * 240 - 1e-6), 1, 48), h = dt / n, ex = Math.exp(-om * h);
    for (let i = 0; i < n && err !== 0; i++) {
      const ch = clamp(-err, -lim, lim), tmp = (w.vel + om * ch) * h;
      w.vel = (w.vel - om * tmp) * ex;
      let step = -ch + (ch + tmp) * ex;
      if (Math.abs(step) >= Math.abs(err) && step * err >= 0) { step = err; w.vel = 0; }   // never past the point
      err -= step;
      if (Math.abs(err) < 1e-3 && Math.abs(w.vel) < 0.05) { err = 0; w.vel = 0; }   // landed
    }
    c.aimYaw = y0 + (err0 - err);   // (never wrapped here: his heading runs on unbroken, as the build's ease left it)
  } else w.vel = 0;
  const k = 1 - Math.exp(-Math.max(0, AIMWEIGHT.reach) * dt);
  w.r += (d - w.r) * k; w.y += (ap[1] - w.y) * k;
  w.landed = err === 0 && Math.abs(d - w.r) < 0.02;
  if (w.landed) { w.r = d; w.y = ap[1]; }
  w.err = err; w.on = Math.abs(err) * Math.max(d, 1) <= AIMWEIGHT.onM;
  return true;
}

/** Where the gun points: the circle's world point — null when nothing is weighing his aim (the circle is the cursor's). */
export function aimGunPoint(g: Game): Vec3 | null {
  const pl = g.player, w = pl.aimw; if (!w.live || !AIMWEIGHT.on) return null;
  if (w.landed) return [g.aimPoint[0], g.aimPoint[1], g.aimPoint[2]];
  const c = pl.char;
  return [c.pos[0] + Math.sin(c.aimYaw) * w.r, w.y, c.pos[2] + Math.cos(c.aimYaw) * w.r];
}
/** Is the circle on the cursor (true when nothing is weighing his aim) */
export function aimGunOn(g: Game): boolean { const w = g.player.aimw; return !(w.live && AIMWEIGHT.on) || w.on; }

/** What leaves the gun goes where the gun points. `tgt` = the point the build would have sent it at (a man's chest, a fixture, a launcher's lead on a walking
 *  man, level along the cursor's heading): handed back AS IT IS while the circle is on the cursor — the one test the HUD's circle shows — else turned about
 *  him by what the gun still has to swing, range and height kept (so a lead stays a lead, about the gun's heading). */
export function aimWeighShot(g: Game, tgt: Vec3): Vec3 {
  const pl = g.player, w = pl.aimw; if (!w.live || !AIMWEIGHT.on || w.on) return tgt;
  const c = pl.char, dx = tgt[0] - c.pos[0], dz = tgt[2] - c.pos[2], cs = Math.cos(w.err), sn = Math.sin(w.err);   // (bearing − err: yaw is atan2(x, z))
  AIMWEIGHT_STATS.offShots++;
  return [c.pos[0] + dx * cs - dz * sn, tgt[1], c.pos[2] + dz * cs + dx * sn];
}

/** The launcher's release (player.ts; `up` = the button has come up with a load held and the rifle in his hands). Rounds go where the circle is, but a 40 mm
 *  flicked and tapped mid-swing went off the cursor with no arc ever drawn (a tap has no preview) — a grenade where he did not point. So a load let go of
 *  while the tube is still off the cursor is KEPT (the caller draws its arc, as under a held button) and sent the frame the circle is on the cursor, or after
 *  `launchWait` where the circle then is. Nothing weighing his aim, or the circle on the cursor: true at once, the build's own release. */
export function aimWeighLaunch(g: Game, dt: number, up: boolean): boolean {
  const w = g.player.aimw;
  if (!up) { w.launchT = 0; return false; }
  if (!w.live || !AIMWEIGHT.on || w.on || !(AIMWEIGHT.launchWait > 0)) { w.launchT = 0; return true; }
  if ((w.launchT += dt) >= AIMWEIGHT.launchWait) { w.launchT = 0; return true; }
  return false;
}
/** A load OWED (the button is up, the round waiting on the swing) on a frame the gun is DOWN — swinging past a wall or a jamb (gunwall.ts), a teammate in the
 *  line: nothing leaves a lowered gun and no arc is drawn, but the load is not dropped for it — the wait's clock runs on, and only its end lets go of it unsent
 *  (a press at a wall is still nothing: nothing is owed until the button has come up with the gun free). true = still owed. */
export function aimWeighLaunchKeep(pl: Player, dt: number): boolean {
  const w = pl.aimw; if (!(w.launchT > 0)) return false;
  if ((w.launchT += dt) >= AIMWEIGHT.launchWait) { w.launchT = 0; return false; }
  return true;
}

/** checkpoint slice: only while a swing is running (savestate.ts) */
export function aimWeightSnapshot(pl: Player): number[] | undefined { const w = pl.aimw; return w.live && (w.vel !== 0 || !w.on) ? [w.vel, w.r, w.y] : undefined; }
export function aimWeightRestore(pl: Player, s: unknown): void {
  const w = pl.aimw; w.vel = 0; w.live = false; w.was = false; w.on = true; w.landed = true; w.err = 0;
  if (Array.isArray(s) && s.length === 3 && s.every(n => Number.isFinite(n))) { w.vel = s[0]; w.r = s[1]; w.y = s[2]; w.live = true; }
}

/** QA / the page's summary line */
export function aimWeightSummary(g: Game): string {
  const w = g.player.aimw; if (!AIMWEIGHT.on) return 'off';
  return w.live ? (w.on ? 'on the cursor' : `swinging ${(w.vel * 180 / Math.PI).toFixed(0)}°/s`) : 'on · not weighing';
}
