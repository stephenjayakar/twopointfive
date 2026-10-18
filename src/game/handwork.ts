// HANDS THAT DO THE WORK — the three biggest gaps on the missing-animations audit, closed with small layers (character.ts workLayer / radioLayer / swapLayer;
// nothing here is a clip):
//
//   WORK   one "working at a thing" pose, fed wherever a man already stands at something and uses it: Sam keying a door code (a forefinger on the pad's own keys,
//          the beeps on its presses), a charge going on a door or a wall (Sam's and a teammate's), the mains breaker (Sam's hand throws the lever — the lights go
//          WITH the hand; a guard re-arming it), the objective coming out of its rack (both hands, then away at his hip). Sam is walked the step in to arm's length
//          and squared to the thing for as long as the verb runs, as he already was at a lock and a keypad; the trigger lets go of the drive and a charge — the
//          lever's half second is committed, like a kick (its row's deed is filed on the tap).
//   RADIO  a line that goes over the net (guards.ts say) lifts the speaker's left hand to the handset at his collar for about as long as the line.
//   SWAP   a guard's torch ↔ sidearm change is a move of his hand — torch to the belt, hand to the holster, gun up; and back — instead of a change on the frame.
//          The RULE (guards.ts handCarry) is untouched: what he may do with the gun, and when, is exactly what it was, and his BORE and MUZZLE are read off the
//          arm UNDER the swap (character.ts handPre): a line of fire and a round's start are where they are with it off; a shot mid-draw jumps the move's end.
//
// One switch, HANDWORK.on — the page: on (`?nohandwork` off); the frozen harness stand: off (`TPS_HANDWORK=1` on) — and its three halves for A/B on the panel.
// What changes for the SIMULATION with it on (so the frozen stand holds it off): Sam's breaker takes the half second his hand needs, a code waits for his finger
// to reach the pad, and he is planted while he pulls the drive / sets a wall charge / throws the breaker. The radio hand and the guards' swap move nothing of
// the game but what the picture shows: the torch's beam goes to the belt with the hand for the swap's third of a second, and a man whose gun is DOWN tips his
// head to his handset as he does for a tell (his eyes go with it); with his sights up the head stays. A man dropped mid-swap falls from the arm UNDER the swap
// (character.ts underPose: he lies where he lies with it off); one dropped with his hand at his radio falls as he was drawn. The animator's clocks are not in a
// checkpoint (as no layer's are): a load mid-swap finds the hand already there.
//
// State: none of its own beyond two fields on the Player (breakerMove, handWait — a save is refused while either runs: savestate.ts playerBusy); everything else
// is fed a frame at a time and lives in the animator, like every other layer's clocks.
import type { Game, Guard, Player } from './game';
import type { Character, WorkKind, WorkPose } from './character';
import { SWAP, workKeyBeat } from './character';
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import { cancelDrive } from './mission';
import { quietOf } from './quiet';
import { breakerResetNear } from './lighting';
import { samStaggered } from './samstun';
import { INHAND, BELT_TORCH } from './inhand';

export const HANDWORK = {
  /** THE switch — the page: on (`?nohandwork` off); the frozen stand: off (`TPS_HANDWORK=1` on) */
  on: false,
  /** its three halves, for A/B on the panel */
  work: true, radio: true, swap: true,
  /** m off the thing's face he is stood to work at it · how he is walked there (an ease, 1/s, at no more than this pace, m/s) · m to one side, so the working shoulder is before the spot */
  standM: 0.52, stepRate: 7, stepPace: 1.7, standSide: 0.1,
  /** s a verb's clock waits, at most, for his hand to reach the thing (a hand that cannot get there keys nothing — the verb still goes) */
  waitSecs: 0.7,
  /** Sam's breaker: s the move takes once his hand is on the lever · s into it the lever goes over (the lights with it) */
  leverSecs: 0.5, leverAt: 0.3,
  /** the objective: s the hand takes putting it away once it is out */
  stowSecs: 0.45,
  /** the radio hand: × the line's own time on screen, and its bounds (s) */
  radioK: 0.6, radioMin: 0.9, radioMax: 2.4,
};
/** QA: how often each was asked for (probes read them; nothing else does) */
export const HANDWORK_STATS = { work: 0, radio: 0, swaps: 0, levers: 0 };

const live = (half: 'work' | 'radio' | 'swap') => HANDWORK.on && HANDWORK[half];
export const handworkOn = live;

// ---------------------------------------------------------------- the work pose
/** feed one man's work pose for this frame (see WorkPose) — nothing with the switch off */
export function workAt(c: Character, kind: WorkKind, p: Vec3, n: Vec3, t: number, dur: number, more?: Pick<WorkPose, 'keys' | 'dir' | 'hand'>) {
  if (!live('work')) return;
  c.anim.work = { kind, p, n, t, dur, ...more }; HANDWORK_STATS.work++;
}
/** a level normal out of a thing's face toward a man, when the code that owns the thing keeps none: the axis nearest the line from the spot to him */
export function faceToward(spot: Vec3, from: Vec3): Vec3 { const dx = from[0] - spot[0], dz = from[2] - spot[2]; return Math.abs(dx) > Math.abs(dz) ? [Math.sign(dx) || 1, 0, 0] : [0, 0, Math.sign(dz) || 1]; }
/** his right as he faces a face whose normal (toward him) is n */
const rightOf = (n: Vec3): Vec3 => [n[2], 0, -n[0]];
/** Walk a man the step in to arm's length of the thing and say which way he is to face: toward the point standM off its face, the working shoulder before the
 *  spot. Position only (level) — the caller settles him against the world after, as the lock's plant does. */
export function workStand(c: Character, p: Vec3, n: Vec3, dt: number, hand: 0 | 1 = 1, pace = HANDWORK.stepPace): number {
  const K = HANDWORK, r = rightOf(n), s = hand ? -K.standSide : K.standSide;
  const tx = p[0] + n[0] * K.standM + r[0] * s, tz = p[2] + n[2] * K.standM + r[2] * s;
  const d = Math.hypot(tx - c.pos[0], tz - c.pos[2]), k = d > 1e-4 ? Math.min(1 - Math.exp(-K.stepRate * dt), pace * dt / d) : 0;
  if (d < 1.8) { c.pos[0] += (tx - c.pos[0]) * k; c.pos[2] += (tz - c.pos[2]) * k; }
  return Math.atan2(-n[0], -n[2]);
}
/** has his hand got to the thing (p, n: its spot and face)? A verb's clock waits for it — handWait counts the wait (slowly while he is still walking in) and gives
 *  up at waitSecs: a hand that cannot get there holds nothing up for long */
function handThere(pl: Player, dt: number, p: Vec3, n: Vec3): boolean {
  const c = pl.char; if (c.anim.workInfo().w > 0.85) return true;
  const off = (c.pos[0] - p[0]) * n[0] + (c.pos[2] - p[2]) * n[2];
  pl.handWait += off > HANDWORK.standM + 0.15 ? dt * 0.35 : dt; return pl.handWait > HANDWORK.waitSecs;
}
/** WHICH OF SAM'S HANDS works a thing — the one rule, for the step in (workStand) and the pose (as the hint: the animator cannot tell a pistol in a hand that
 *  a plant has lowered): the left while the right has the pistol, the rifle's grip or a can in its fist, else the right */
export const samWorkHand = (g: Game): 0 | 1 => { const pl = g.player; return pl.pistolUp || pl.rifleUp || pl.char.anim.grip[1] ? 0 : 1; };
const samHand = (g: Game): 0 | undefined => samWorkHand(g) ? undefined : 0;

// ---------------------------------------------------------------- the keypad
/** where the pad's keys are on its face, m right / up of its centre as he sees it (devices.ts draws the block: three across, four down — 1 2 3 / 4 5 6 / 7 8 9 / * 0 #) */
const KEY_AT: Record<string, readonly [number, number]> = (() => { const o: Record<string, [number, number]> = {}; ['123', '456', '789', '*0#'].forEach((row, r) => [...row].forEach((ch, c) => { o[ch] = [(c - 1) * 0.02, -0.015 + (1.5 - r) * 0.0175]; })); return o; })();
/** the four keys a code presses (a code of another length is gone through in turn) */
export function padKeys(code: string): (readonly [number, number])[] { const ks = [...String(code)].map(ch => KEY_AT[ch] ?? KEY_AT['5']); return ks.length ? [0, 1, 2, 3].map(k => ks[k % ks.length]) : [KEY_AT['5']]; }
/** devices.ts updateCoding, once a frame while the code goes in: his finger is fed onto the pad; returns the seconds the code's clock may run this frame (none
 *  until the hand is there) and plays each key's beep — and lights the key — on its press. `secs` = the whole entry (CODE_SECS). */
export function padHands(g: Game, pad: { def: { pos: Vec3; code: string; yaw: number }; n: Vec3 }, dt: number, secs: number): number {
  const pl = g.player, keys = padKeys(pad.def.code);
  workAt(pl.char, 'keys', pad.def.pos, pad.n, pl.codeT, secs, { keys, hand: samHand(g) });
  if (pl.codeT <= 0 && !handThere(pl, dt, pad.def.pos, pad.n)) return 0;
  const before = pl.codeT, after = before + dt, r = rightOf(pad.n);
  for (let k = 0; k < 4; k++) { const at = workKeyBeat(k, secs); if (before < at && after >= at) {
    g.audio.play('padBeep', pad.def.pos, 0.5, { rate: 1 + 0.03 * k });
    const [x, y] = keys[k]; const c: Vec3 = [pad.def.pos[0] + pad.n[0] * 0.03 + r[0] * x, pad.def.pos[1] + y, pad.def.pos[2] + pad.n[2] * 0.03 + r[2] * x];
    g.fx.push({ box: makeBox({ c, h: [0.008, 0.007, 0.002], yaw: pad.def.yaw, albedo: [0.2, 0.16, 0.05], emissive: [2.4, 1.5, 0.3], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: 0.11 });   // the key lights under the finger
  } }
  return dt;
}

// ---------------------------------------------------------------- a charge going on
/** a setter's hands on the charge while he sets it (doortools.ts / wallcharge.ts, once a frame of the setting): the pose, and the slab under his palms from when
 *  they have pressed it there (the set charge — with its light — is drawn by its owner once it IS set) */
export function chargeHands(g: Game, c: Character, p: Vec3, n: Vec3, t: number, dur: number, hand?: 0) {
  if (!live('work')) return;
  workAt(c, 'charge', p, n, t, dur, { hand });
  if (t > 0.35 && c.anim.workInfo().w > 0.5) g.fx.push({ box: makeBox({ c: v3.mad(p, n, 0.02), h: [0.07, 0.11, 0.02], yaw: Math.atan2(n[0], n[2]), albedo: [0.09, 0.1, 0.08], flags: BoxFlag.Dynamic, owner: c.id & 0xff }), ttl: 1e-3 });
}

// ---------------------------------------------------------------- Sam's plants: the breaker, the drive, a wall charge
export interface SamWork { kind: 'breaker' | 'drive' | 'wall' | 'door' | 'defuse'; p: Vec3; n: Vec3; /** where the verb's owner thinks he stands (the wall charge breaks off if he shifts from it): kept on him as he is walked in */ at?: Vec3 }
/** the face of the breaker panel toward a man: the panel box's thin axis when it has one, else the axis nearest him */
function breakerFace(g: Game, from: Vec3): { p: Vec3; n: Vec3 } {
  const B = g.level.breaker, b: Box | undefined = g.engine.world.statics[B.boxes[0]];
  if (b && !b.yaw && !b.rot && Math.min(b.h[0], b.h[2]) < 0.5 * Math.max(b.h[0], b.h[2])) {
    const n: Vec3 = b.h[2] < b.h[0] ? [0, 0, Math.sign(from[2] - b.c[2]) || 1] : [Math.sign(from[0] - b.c[0]) || 1, 0, 0];
    return { p: [b.c[0] + n[0] * b.h[0], b.c[1], b.c[2] + n[2] * b.h[2]], n };
  }
  return { p: B.pos, n: faceToward(B.pos, from) };
}
/** the face of the objective's holder toward a man, as mission.ts rackDist has it: the office's rack is a width along x that faces ±z (so a man reaching it from
 *  off to one side still squares to the FACE, not to the line from its middle to him); a quiet mission's holder faces any way — the way he came at it */
function rackFace(g: Game, from: Vec3): { p: Vec3; n: Vec3 } {
  const rf = g.level.mission.rack.front;
  return { p: rf, n: quietOf(g) ? faceToward(rf, from) : [0, 0, Math.sign(from[2] - rf[2]) || 1] };
}
/** what Sam's hands are on, if a verb of his that plants him is running (player.ts asks before his own movement; null with the switch off) */
export function samWork(g: Game): SamWork | null {
  if (!live('work') || g.puppet) return null;
  const pl = g.player, p = pl.char.pos;
  if (pl.breakerMove) return { kind: 'breaker', ...breakerFace(g, p) };
  if (g.mission.stage === 'drive' && g.mission.driveT >= 0) return { kind: 'drive', ...rackFace(g, p) };
  const J = g.wallCharge?.samJob; if (J) return { kind: 'wall', p: J.p, n: J.n, at: J.at };
  const D = g.doorTools?.samJob; if (D) return { kind: 'door', p: D.p, n: D.n, at: D.at };   // (a door charge by hand: owncharge.ts)
  const C = g.defuse?.samJob; if (C) return { kind: 'defuse', p: C.p, n: C.n, at: C.at };   // (a timed charge on its bench: defuse.ts, only on a level that carries them)
  return null;
}

/** the 'breaker' rows (game.ts updateDoors): with the switch on the mains do not flip on the frame — his hand goes to the lever and throws it. True = taken here. */
export function breakerStart(g: Game, on: boolean): boolean {
  if (!live('work') || g.puppet) return false;
  const pl = g.player; if (pl.breakerMove) return true;
  pl.breakerMove = { on, t: 0, thrown: false }; pl.handWait = 0; HANDWORK_STATS.levers++;
  return true;
}
/** once a frame (game.ts, after the rows are read): the lever's move — it waits for the hand, the mains go over at leverAt, the hand comes away at leverSecs */
export function breakerTick(g: Game, dt: number) {
  const pl = g.player, M = pl.breakerMove; if (!M) return;
  const bo = g.blackout, bp = g.level.breaker.pos;
  if (!live('work') || pl.down || pl.holding || pl.takedown || pl.dragging || samStaggered(g) || v3.distXZ(bp, pl.char.pos) > 1.6 || (bo.active && bo.permanent)) { pl.breakerMove = null; return; }
  const F = breakerFace(g, pl.char.pos);
  workAt(pl.char, 'lever', F.p, F.n, M.t, HANDWORK.leverSecs, { dir: M.on ? -1 : 1, hand: samHand(g) });
  if (M.t <= 0 && !handThere(pl, dt, F.p, F.n)) return;
  M.t += dt;
  if (!M.thrown && M.t >= Math.min(HANDWORK.leverAt, HANDWORK.leverSecs - 0.1)) { M.thrown = true;
    if (M.on) { if (bo.active && !bo.permanent) g.endBlackout(); } else if (!bo.active) g.setBlackout(86400, 'hand'); }
  if (M.t >= HANDWORK.leverSecs) pl.breakerMove = null;
}
/** player.ts: a click while a plant runs lets go of it (the click is then his to shoot with) — the drive and a wall charge; the breaker's half second is
 *  COMMITTED like a kick (its row's deed was filed on the tap — the lessons, the chronicle — so the mains must follow it): false = not let go of */
export function samWorkLetGo(g: Game, W: SamWork): boolean { if (W.kind === 'breaker') return false; if (W.kind === 'drive') cancelDrive(g); else if (W.kind === 'defuse') g.defuse?.cancel(); else if (W.kind === 'door') g.doorTools?.cancelSam(); else g.wallCharge?.cancel(); return true; }
/** lighting.ts: a guard at the thrown breaker, re-arming it — his hand on the lever for the `dur` he fumbles, the throw at the end */
export function leverHands(g: Game, c: Character, t: number, dur: number) { if (!live('work')) return; const F = breakerFace(g, c.pos); workAt(c, 'lever', F.p, F.n, t, dur, { dir: -1 }); }

/** A TEAMMATE SENT TO WORK A THING — the join for a module that owns WHEN and WHERE and keeps a door-hand style record for it ({ p: the thing's face point,
 *  n: its normal out toward him, w: 1 while he works, 0 as the hand comes off }): the work pose in the door hand's place. True = this layer has the hand (the
 *  caller then feeds no door hand for it); false = no record, or the switch off: the caller's own feed stands. `kind` 'lever' (a breaker — dir −1 re-arms it)
 *  or 'take' (the mission's thing); t / dur = s into the work and how long it takes, when the caller knows (the lever goes over just before `dur`; left at
 *  0 / 1 the hand simply rests on it). A teammate's right hand has his gun: his left works. */
export function teamWorkHand(c: Character, h: { p: Vec3; n: Vec3; w: number } | null, kind: 'lever' | 'take' = 'lever', t = 0, dur = 1, dir = 1): boolean {
  if (!h || !live('work')) return false;
  if (h.w > 0) workAt(c, kind, h.p, h.n, t, dur, { dir, hand: 0 });
  return true;
}

/** guards.ts, the man sent to the breaker (his errand, the mains out and resettable): once he is in the re-arm's own reach of the panel he steps up to it and
 *  squares to it instead of looking round from a stride off — the way he is to face and the pace of the step, or null (not there yet / the switch off / the
 *  panel dead: the AI has him as ever). The clock and the reset stay lighting.ts's. */
export function leverStand(g: Game, gd: Guard, dt: number): { yaw: number; speed: number } | null {
  if (!live('work')) return null;
  const c = gd.char;
  if (!breakerResetNear(g, gd)) return null;
  const F = breakerFace(g, c.pos), x = c.pos[0], z = c.pos[2];
  const yaw = workStand(c, F.p, F.n, dt, 0, 1.3)   // (a guard's right hand has his torch or his sidearm: the left works);
  return { yaw, speed: dt > 0 ? Math.hypot(c.pos[0] - x, c.pos[2] - z) / dt : 0 };
}

/** mission.ts, once a frame of the drive stage: both hands in the rack while it comes out, then the thing put away at his hip; `pulled` = this is the frame it came free */
export function driveHands(g: Game, secs: number, pulled: boolean) {
  if (!live('work')) return;
  const pl = g.player, c = pl.char, m = g.mission;
  if (pulled) { c.anim.workAfter(HANDWORK.stowSecs); return; }
  if (m.driveT < 0) return;
  const F = rackFace(g, c.pos);
  workAt(c, 'take', F.p, F.n, m.driveT, secs, { hand: samHand(g) });
}
/** the thing in his hand while it comes out and is put away: a caddy-sized box off the working hand (combat.ts handProps calls it for Sam) */
export function workProps(c: Character, out: Box[]) {
  if (!live('work')) return;
  const I = c.anim.workInfo(), L = I.pose; if (!L || L.kind !== 'take' || I.w < 0.4) return;
  const u = L.t / L.dur; if (u < 0.5 || L.t > L.dur + HANDWORK.stowSecs * 0.8) return;
  const h = I.hand ? c.bones.handR : c.bones.handL; if (!h) return;
  const f = c.forward(), r: Vec3 = [-f[2], 0, f[0]], s = I.two ? (I.hand ? 0.045 : -0.045) : 0;   // between the two hands while both have it
  const done = L.t > L.dur;
  out.push(makeBox({ c: done ? [h[0], h[1] - 0.07, h[2]] : [h[0] + f[0] * 0.09 - r[0] * s, h[1], h[2] + f[2] * 0.09 - r[2] * s], h: [0.05, 0.013, 0.07], yaw: Math.atan2(f[0], f[2]), albedo: [0.13, 0.14, 0.15], rough: 0.4, metal: true, flags: BoxFlag.Dynamic | BoxFlag.NoShadow, owner: c.id & 0xff }));
}

// ---------------------------------------------------------------- the radio hand
/** guards.ts say, a line that goes over the net: his hand goes to the handset for about as long as the line stands (`secs` = its time on screen) */
export function radioHand(gd: Guard, secs: number) {
  if (!live('radio') || gd.state === 'dead' || gd.civ) return;
  HANDWORK_STATS.radio++;
  gd.char.anim.radio(Math.min(HANDWORK.radioMax, Math.max(HANDWORK.radioMin, secs * HANDWORK.radioK)));
}

// ---------------------------------------------------------------- the guard's torch ↔ sidearm swap
/** game.ts, once a frame per man before anybody is posed: what the rule has in his gun hand (guards.ts inHand) — the animator makes a move of a change. Only a
 *  man who carries the plain sidearm and a hand torch has anything to swap. */
export function swapFeed(gd: Guard, held: 'torch' | 'weapon' | null, plain: boolean) {
  if (!live('swap') || !plain || gd.state === 'dead' || gd.held) return;
  const an = gd.char.anim;
  an.swapLag = SWAP.lag * ((gd.char.id * 0.6180339887) % 1);   // (each man his own beat before his hand starts, off his id: never a die)
  const si = an.swapInfo();
  if (held && si.a < 0 && !si.pending && an.swapHeld(held) !== held) HANDWORK_STATS.swaps++;   // (his hand still shows the other thing: the move starts with this frame's pose)
  an.carry = held;
}
/** what his gun hand VISIBLY holds this frame (combat.ts handProps, guards.ts for the light): the rule's answer, but for the frames of a swap */
export function swapHeld(gd: Guard, held: 'torch' | 'weapon' | null): 'torch' | 'weapon' | null {
  return live('swap') ? gd.char.anim.swapHeld(held) : held;
}
/** is a swap running on him (0‥1 through it; −1 none) */
export const swapping = (gd: Guard): number => live('swap') ? gd.char.anim.swapInfo().a : -1;
/** the torch on his belt while the sidearm is out (and for the beat of the swap the hand is empty): hung at the front of the right hip, lens down, dark */
export function beltTorch(c: Character, out: Box[]) {
  const hp = c.bones.hips; if (!hp) return;
  const f = c.forward(), r: Vec3 = [-f[2], 0, f[0]];   // (his right: model −X)
  const B = INHAND.on && INHAND.belt ? BELT_TORCH.at : BELT_TORCH.was, o = B[0], a = B[1];   // (inhand.ts: at 0.15 / 0.115 three quarters of it was under his shirt — measured on the worn mesh of every defender and responder; outside it at 0.21 / 0.16)
  const at: Vec3 = [hp[0] + r[0] * o + f[0] * a, hp[1] - 0.045, hp[2] + r[2] * o + f[2] * a];
  out.push(makeBox({ c: at, h: [0.017, 0.062, 0.017], yaw: Math.atan2(f[0], f[2]), albedo: [0.05, 0.05, 0.055], flags: BoxFlag.Dynamic | BoxFlag.NoShadow, owner: c.id & 0xff }));
  out.push(makeBox({ c: [at[0], at[1] - 0.07, at[2]], h: [0.021, 0.012, 0.021], yaw: Math.atan2(f[0], f[2]), albedo: [0.07, 0.07, 0.075], flags: BoxFlag.Dynamic | BoxFlag.NoShadow, owner: c.id & 0xff }));
}
