import { SideMap } from '../math/side';
import type { Vec3 } from '../math/vec';
import { v3, clamp, lerp, wrapAngle } from '../math/vec';
import { BoxFlag } from '../scene/boxes';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { WALL_TUCK } from './character';
import { armThrough, solidBetween } from './combat';
import { glassPenLive } from './glasspen';
import type { PelletSpec } from './weapons';

/** A RAISED WEAPON COMES DOWN AT A WALL. A shouldered rifle's muzzle stands 0.63 m ahead of the man who holds it and an aimed pistol's 0.64; a man can stand
 *  with his centre 0.3 m off a wall — so every man who turned to cover a line with a wall, a jamb or a door leaf inside that reach was DRAWN with his gun in it
 *  or out through its far face (39 play-throughs of the one build: 3.1 % of all armed man-frames; nine in ten of them the shouldered carriage). Rounds have a
 *  rule for the pressed muzzle (combat.ts armThrough: the round dies in the panel) and so has the weapon light (lighting.ts LIGHTWALL); this is the GUN's:
 *
 *  1. THE LOW READY. A gun that is up (the aim; the high port of a stack or the high ready) and whose own line meets a static or a leaf inside its reach is
 *     brought to the low ready — through Guard.muzzleDown, the bit a colleague in the line already sets (guards.ts muzzleCheck): the pose, every fire gate and
 *     the visible laser read it, so nothing new has to learn about a lowered gun. Two lines are asked (walledNow): the gun AS DRAWN once it is up and settled
 *     (exact at a jamb's edge), and otherwise the carriage he WANTS, worked out from his feet and his aim (a gun already down would report nothing in the way
 *     if it were asked as drawn, and come straight back up) — with a lead for the speed he closes at and a band between down and up, so it comes down before
 *     the wall and does not flutter at the edge of the reach. A man whose point of aim IS that surface (within `atM` of where the line meets it: the shotgun
 *     on a lock — doortools.ts gunStep) keeps it up while the muzzle itself is short of it: that muzzle is there on purpose. One that would stand IN the
 *     surface comes down like any other (a man walking at the door he watches).
 *     A MAN IN A FIGHT (`hot`: the alert branch, a script's `over`) is treated more narrowly: his gun comes down only once it has stood IN a panel a round
 *     would have died in anyway (armThrough's own test), and he then moves for a line (guards.ts `poked`; roomfight.ts walks on / steps aside).
 *  2. THE TUCK. The low ready itself reaches 0.43‥0.51 m — still past a wall he is pressed to. CharacterAnimator.gunWall (0‥2, from how much room the low
 *     carriage's line has) pulls the low carriages in toward character.ts WALL_TUCK: at 1 the muzzle is inside his own collision circle, and from 1 to 2 the
 *     hand is drawn further back still (WALL_TUCK.over) for a torso twisted toward the wall.
 *
 *  Sam: the same test, the same low ready (player.ts), and no round while it is down — but for the BREACHING SHOTGUN LAID ON A LOCK (`breachAim`: the raised
 *  gun's own line meets a locked, latched leaf where a shell takes its keep): that gun stays up however close he stands, pressed to the leaf included, and the
 *  shell goes — as a teammate's on the same lock always did. A breach shot at a lock always fires. Pinned men are left alone (they cannot step for a line), and so is
 *  everybody while a showcase has the floor (its choreography was written against guns that stay up).
 *  Off (the table's own value, so a host that never says otherwise is unchanged): nothing asked, muzzleDown and gunWall never touched — the game as it was.
 *  The page turns it on (src/host/profile.ts pageSwitches; ?nogunwall = off) and so does the harness's shipped stand; its frozen stand holds it off
 *  (src/host/standup.ts; TPS_GUNWALL=1 turns it on there).
 *  `downM` / `upM`: the room past the wanted muzzle under which the gun comes down / over which it may come back up, metres. `leadS`: seconds of his closing
 *  speed added to both (the carriage takes about that long to change). `tuckM`: the room the tucked muzzle keeps; `tuckLeadS`: its lead.
 *  `fightS`: a fight anywhere on the floor (a man gone alert, a scripted man with one in his sights) makes EVERY man a man in a fight for this long after it
 *  was last seen — the calm man's margins bring a gun down a stride early, and a stride early at a jamb with defenders two rooms off is a shot not taken
 *  (0 = only the man who has a target himself). */
export const GUNWALL = { on: false, downM: 0.03, upM: 0.12, leadS: 0.2, atM: 0.5, tuckM: 0.04, tuckLeadS: 0.12, fightS: 5 };
/** QA: line tests made, guns brought down (spells) and for how long (man-seconds), frames a low carriage was pulled in — tools/qa/gunwall-watch.ts reads it; nothing in the game does */
export const GUNWALL_STATS = { asked: 0, lowered: 0, loweredS: 0, tucked: 0 };

/** which raised carriage is asked about: the aim (shouldered / the two-hand pistol aim) or the high port (the stack's, the high ready's) */
export type GunUp = 'aim' | 'port';
/** a gun found in a wall as drawn: where he stood (x, z), aimed (yaw, pitch) and how tall (the gun shoulder over his feet), the segment that found it, and by which test */
interface Hold { x: number; z: number; yaw: number; pitch: number; sh: number; a: Vec3; b: Vec3; hot: boolean }
interface St { low: boolean; /** Game.time of the last answer */ t: number; /** Sam's low ready is this rule's */ mine: boolean; hold: Hold | null;
  /** seconds a man in a fight has had his settled gun in a panel */ wood: number; /** this frame's answer let the gun go that the last one held */ rose: boolean;
  /** his feet's own speed over the floor (Character.vel is the COMMANDED velocity: a man queued behind another has it and stands still): the last sample and when */ px: number; pz: number; vt: number; vx: number; vz: number }
const ST = new SideMap<Character, St>('gunwall.ST');
const st = (c: Character): St => { let s = ST.get(c); if (!s) ST.set(c, s = { low: false, t: -1, mine: false, hold: null, wood: 0, rose: false, px: c.pos[0], pz: c.pos[2], vt: -1, vx: 0, vz: 0 }); return s; };

const STAND_SH = 1.4, CROUCH_SH = 0.99;   // the gun shoulder's height standing / crouched (the mannequin's, measured): how far down he is, for the carriages' crouched numbers
const TUCK_REACH = 0.235;                 // where WALL_TUCK leaves the muzzle ahead of his feet at gunWall 1 (measured: 0.21‥0.235 over the FN2000, the AKS-74U and the pistol)
const SH_REST = -0.07, SH_CARRY = 0.6, REACH_OVER = 0.2;   // the low carriage rides the shoulders: the gun shoulder stands 7 cm behind his feet at rest, and six tenths of every centimetre it comes forward of that (a torso twisted hard round, a lean into the stride: up to ~0.2 m) is added to the muzzle's reach — measured
const GUN_HALF = 0.04, GUN_HALF_LOW = 0.06;   // half the width the worked-out line is asked over: coming up / once down (wider: it stays down at an edge it only just clears)
const SETTLED_M = 0.08;                     // the muzzle within this of where the carriage puts it (ahead; twice it in height) = the gun is up: asked as drawn
const HOLD_M = 0.1, HOLD_RAD = 0.15;        // a gun found in a wall as drawn stays down until he has stepped / turned (or risen, or pitched) this far off the spot
const HOT_SECS = 0.1;                       // a man in a fight: his settled gun this long in a panel before it comes down (a recoil's kick through a jamb's edge is not a wall)
const FRESH_S = 0.05;                       // an answer older than this is nobody's (a man nobody asked about this frame or last: dead, held, pinned)
const TUCK_HALF = 0.07;
const TELEPORT_M = 0.25;                    // further than this in a frame is not a step (teleportPlayer, a staged man): no speed read off it
const BREACH_AIM_M = 1.4;                   // breachAim: how far along the raised gun's line, from the hand, the lock may stand (the gun's reach and a stride)
const AT_IN = 0.03;                         // a muzzle laid ON the surface he aims at may stand this far into the test's line and stay up; deeper, the gun is in the wood whatever he aims at
/** the floor's fight: when one was last seen, asked once a frame (GUNWALL.fightS) */
const FIGHT = new SideMap<Game, { t: number; until: number }>('gunwall.FIGHT');
function fightOn(g: Game): boolean {
  const K = GUNWALL; if (!(K.fightS > 0)) return false;
  let F = FIGHT.get(g); if (!F) FIGHT.set(g, F = { t: -1, until: -1 });
  if (F.t !== g.time) {
    F.t = g.time; F.until = Math.min(F.until, g.time + K.fightS);   // (the clock gone back — a load that carried no word of it: never longer than a fight seen now would keep it)
    for (const gd of g.guards) if (gd.char.alive && (gd.state === 'alert' || gd.script?.over)) { F.until = g.time + K.fightS; break; }
  }
  return g.time < F.until;
}
/** a showcase has the floor (the tour, a Director showcase) */
const showing = (g: Game): boolean => g.touring || !!g.director?.showing;

/** His frame: forward and right on the floor along `yaw`, the gun shoulder's height over his feet, how crouched that says he is (0‥1) */
function frame(c: Character, yaw: number) {
  const f: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)], r: Vec3 = [-Math.cos(yaw), 0, Math.sin(yaw)];
  const sh = (c.bones.upperArmR?.[1] ?? c.pos[1] + STAND_SH) - c.pos[1];
  return { f, r, sh, k: clamp((STAND_SH - sh) / (STAND_SH - CROUCH_SH), 0, 1) };
}
const at = (c: Character, F: { f: Vec3; r: Vec3 }, fwd: number, right: number, y: number): Vec3 =>
  [c.pos[0] + F.f[0] * fwd + F.r[0] * right, c.pos[1] + y, c.pos[2] + F.f[2] * fwd + F.r[2] * right];
/** his feet's speed over the floor, sampled once a frame by whoever asks first */
function track(g: Game, c: Character, S: St): void {
  if (S.vt === g.time) return;
  const h = g.time - S.vt;
  const dx = c.pos[0] - S.px, dz = c.pos[2] - S.pz;
  if (h > 1e-5 && h < 0.1 && Math.hypot(dx, dz) < TELEPORT_M) { S.vx = dx / h; S.vz = dz / h; } else S.vx = S.vz = 0;   // (a gap, the clock gone back — a load —, or put somewhere else: standing)
  S.px = c.pos[0]; S.pz = c.pos[2]; S.vt = g.time;
}
/** how fast he closes along `f`, m/s (never negative: backing off buys nothing early) */
const closing = (S: St, f: Vec3) => Math.max(0, S.vx * f[0] + S.vz * f[2]);

/** The line a RAISED gun lies along on heading `yaw`, from his feet (metres off the measured carriages, standing → crouched): `a` at the hand end, `b` at the
 *  muzzle. The aim: level with his eye line, on his gun side, pitched as he aims. The port: the long gun slanting up across his chest, the pistol level at
 *  the chin. These are COPIES of what character.ts's carriage tables (LONG, LONG_CROUCH, STANCES) come out as on the mannequin — `probes.ts gunwall`'s
 *  gun-model card holds them to the posed gun, so a re-tuned table that moves a muzzle is a red there and not a rule that silently stopped fitting. */
function raisedLine(c: Character, up: GunUp, yaw: number): { a: Vec3; b: Vec3 } {
  const F = frame(c, yaw), long = c.anim.longGun;
  if (up === 'aim') {
    const reach = (long ? 0.11 : 0.385) + c.muzzleAhead, side = long ? lerp(0.2, 0.16, F.k) : lerp(0.16, 0.02, F.k), y = F.sh - (long ? 0.11 : lerp(0.02, 0.22, F.k));
    const p = clamp(c.aimPitch, -0.7, 0.7);
    return { a: at(c, F, 0, side, y), b: at(c, F, reach * Math.cos(p), side, y + reach * Math.sin(p)) };
  }
  return long ? { a: at(c, F, 0.15, 0.12, F.sh - 0.28), b: at(c, F, 0.44, -0.065, F.sh + 0.13) } : { a: at(c, F, 0, 0.07, F.sh + 0.04), b: at(c, F, 0.465, 0.07, F.sh + 0.07) };
}
/** how far ahead of his feet the low ready leaves the muzzle (untucked) */
const lowReach = (c: Character) => c.anim.longGun ? 0.145 + 0.7 * c.muzzleAhead : 0.241 + 0.74 * c.muzzleAhead;
/** QA (tools/qa/gunwall-probes.ts gun-model): the worked-out carriages, to be held against the posed gun */
export const gunWallModel = { raisedLine, lowReach, TUCK_REACH };

/** a PANEL on a → b as a round sees one (combat.ts solidBetween: a static, or a leaf standing shut — one standing open yields), and not a pane rounds go through */
function panel(g: Game, a: Vec3, b: Vec3): boolean {
  GUNWALL_STATS.asked++;
  if (!solidBetween(g, a, b)) return false;
  if (!glassPenLive(g)) return true;
  const d = v3.sub(b, a), L = v3.len(d), h = L > 1e-3 ? g.col.raycast(a, v3.scale(d, 1 / L), L) : null;
  return !(h && h.index < 1e6 && (g.col.boxes[h.index].flags & BoxFlag.Glass));
}

/** Is the gun he wants up (`up`) kept down by a wall this frame? `to`: the point he aims at, if he has one — on the surface itself, the gun stays up
 *  (`deep`: however far in — the breaching shotgun's muzzle is laid where the lock is).
 *  A CALM man — collision rays over the statics and every leaf (collision.ts raycast; loose furniture is not asked, as for rounds and the light), a little
 *  past the muzzle. WHICH line depends on where the gun is:
 *   · up and settled (the aim, the muzzle about where the carriage puts it): the gun AS DRAWN — gun hand → muzzle, and the arm behind it. Exact at a jamb's
 *     edge, which is where men stand: a gun that passes the edge by a finger stays up, one that is in it comes down. The segment that found it is remembered
 *     (`hold`): until he has stepped, turned, risen or pitched off that pose — or that segment is clear again: a leaf swung away, a wall blown — the gun
 *     stays down, whatever the worked-out line below says. It never comes back up into the same wood.
 *   · down for a wall already, on its way up, or the port: the carriage's line worked out from his feet and his aim (and, turning under weight, from where
 *     the gun has got to: Character.gunYaw), a gun's width either side of it.
 *  A man IN A FIGHT (`hot`) — only what would have cost him the round anyway: his settled gun, as drawn, in a panel by armThrough's own test (so an open
 *  leaf's edge or a pane his rounds go through never lowers it) for HOT_SECS; then held as above, and up again once the worked-out line is out of the panel.
 *  None of the calm man's margins: they would cost this one shots he has. */
function walledNow(g: Game, c: Character, up: GunUp, to: Vec3 | null, S: St, dt: number, hot: boolean, deep: boolean): boolean {
  const K = GUNWALL, F = frame(c, c.aimYaw), M = raisedLine(c, up, c.aimYaw);
  const cast = (a: Vec3, b: Vec3, need: number): boolean => {
    const d = v3.sub(b, a), L = v3.len(d); if (L < 1e-3) return false;
    const rd = v3.scale(d, 1 / L); GUNWALL_STATS.asked++;
    const h = g.col.raycast(a, rd, L + need); if (!h) return false;
    return !(to && (deep || h.t > L - AT_IN) && v3.dist(to, v3.mad(a, rd, h.t)) < K.atM);
  };
  if (S.low && S.hold) {   // found in the wood as drawn: down until he is off that pose, or the wood is off that line
    const H = S.hold;
    const same = Math.hypot(c.pos[0] - H.x, c.pos[2] - H.z) < HOLD_M && Math.abs(wrapAngle(c.aimYaw - H.yaw)) < HOLD_RAD && Math.abs(F.sh - H.sh) < HOLD_M && Math.abs(c.aimPitch - H.pitch) < HOLD_RAD;
    if (same && (H.hot ? panel(g, H.a, H.b) : cast(H.a, H.b, 0))) return true;
    S.hold = null;
  }
  const hand = c.bones.handR, sh = c.bones.upperArmR, B = c.bonesAt;   // (the bones are a frame old: they stand where his feet were when they were read)
  const settled = up === 'aim' && !!hand && !!sh
    && (c.muzzle[0] - B[0]) * F.f[0] + (c.muzzle[2] - B[1]) * F.f[2] > (M.b[0] - c.pos[0]) * F.f[0] + (M.b[2] - c.pos[2]) * F.f[2] - SETTLED_M && Math.abs(c.muzzle[1] - M.b[1]) < 2 * SETTLED_M;
  const held = (a: Vec3, b: Vec3): true => { S.hold = { x: c.pos[0], z: c.pos[2], yaw: c.aimYaw, pitch: c.aimPitch, sh: F.sh, a: v3.copy(a), b: v3.copy(b), hot }; return true; };
  if (hot) {
    if (S.low) return panel(g, M.a, M.b);   // down already (a calm man's wall, or off a hold): up once the worked-out line is out of the panel
    S.wood = settled && armThrough(g, c) && panel(g, sh!, c.muzzle) ? S.wood + dt : 0;
    return S.wood >= HOT_SECS && held(sh!, c.muzzle);
  }
  S.wood = 0;
  const lead = closing(S, F.f) * K.leadS;
  if (!S.low && settled) {   // up and settled: the gun as drawn, moved on by his step since
    const dx = c.pos[0] - B[0], dz = c.pos[2] - B[1], mv = (p: Vec3): Vec3 => [p[0] + dx, p[1], p[2] + dz];
    const h = mv(hand!), m = mv(c.muzzle), s = mv(sh!);
    return cast(h, m, K.downM + lead) ? held(h, m) : cast(s, h, 0) && held(s, h);
  }
  const need = (S.low ? K.upM : K.downM) + lead, w = S.low ? GUN_HALF_LOW : GUN_HALF;
  for (const L of Math.abs(wrapAngle(c.gunYaw - c.aimYaw)) > 0.1 ? [M, raisedLine(c, up, c.gunYaw)] : [M])
    for (const o of [0, -w, w]) { const off: Vec3 = [F.r[0] * o, 0, F.r[2] * o]; if (cast(v3.add(L.a, off), v3.add(L.b, off), need)) return true; }
  return false;
}
/** YOUR BREACH SHOT. Where the raised gun's own line — the worked-out aim carriage, gun side and pitch and all — meets a LOCK a shell takes (shotgun.ts
 *  fireShell's own test: a leaf latched and locked, no wedge at its foot, within the pattern's `latchM` of its latch edge — no slack on it: pressed to
 *  the leaf the pattern has no spread, and a gun kept up short of that band would spend its shell on a lock that holds), inside the gun's reach and a stride: that point, to hand to gunWalled as `to` with `deep`; else null. Asked of the gun's line and not of the
 *  cursor's point on the floor: pressed to a door, what he points at is mostly somewhere past it. Null with the rule off. */
export function breachAim(g: Game, c: Character, B: NonNullable<PelletSpec['breach']>): Vec3 | null {
  if (!GUNWALL.on) return null;
  const M = raisedLine(c, 'aim', c.aimYaw), rd = v3.sub(M.b, M.a), L = v3.len(rd); if (L < 1e-3) return null;
  const dir = v3.scale(rd, 1 / L), h = g.col.raycast(M.a, dir, BREACH_AIM_M);
  if (!h || h.index < 1e6) return null;
  const box = g.col.dynamicBoxes[h.index - 1e6], d = box ? g.doors.list.find(x => x.box === box) : undefined;
  if (!d || !d.latched || !d.locked || d.lockId.startsWith('wedge:')) return null;
  const p = v3.mad(M.a, dir, h.t), u = d.dir(), along = (p[0] - d.def.hinge[0]) * u[0] + (p[2] - d.def.hinge[1]) * u[1];
  return along < d.def.width - B.latchM ? null : p;
}
/** This frame's answer for a character (asked once a frame, then remembered): `up` = the raised carriage he wants, null = the gun is not wanted up at all;
 *  `hot` = he is in a fight, `deep` = his muzzle belongs on the surface he aims at (walledNow). Nothing while a showcase has the floor. */
export function gunWalled(g: Game, c: Character, up: GunUp | null, to: Vec3 | null, dt: number, hot = false, deep = false): boolean {
  if (!GUNWALL.on) return false;
  const S = st(c);
  if (S.t !== g.time) {
    S.t = g.time; track(g, c, S); const was = S.low;
    S.low = !!up && !showing(g) && walledNow(g, c, up, to, S, dt, hot, deep); if (!S.low) S.hold = null;
    S.rose = was && !S.low;
    if (S.low) { GUNWALL_STATS.loweredS += dt; if (!was) GUNWALL_STATS.lowered++; }
  }
  return S.low;
}
/** the last answer, read only, if it is this frame's or the last's (roomfight.ts: a gun on its man that a wall holds down is no shot from here) */
export function gunWallIs(g: Game, c: Character): boolean {
  if (!GUNWALL.on) return false;
  const S = ST.get(c); return !!S && S.low && g.time - S.t < FRESH_S;
}
/** …and for one of the men (the AI's and the scripts' — guards.ts, squad.ts): a gun kept down by a wall is `muzzleDown`, held there every frame it is asked
 *  (muzzleCheck lets it up again MUZZLE_UP_SECS after the wall — and any colleague — is off the line; a man in a fight, his own or the floor's, at once).
 *  Idempotent within a frame. */
export function gunWallCheck(g: Game, gd: Guard, up: GunUp | null, to: Vec3 | null, dt: number, hot = false): boolean {
  if (!GUNWALL.on) return false;
  hot ||= fightOn(g);
  const low = gunWalled(g, gd.char, up, to, dt, hot, !!gd.weapon?.def.pellets);
  if (low) { gd.muzzleDown = true; gd.muzzleClearT = 0; }
  else if (hot && gd.muzzleDown && ST.get(gd.char)?.rose && gd.muzzleEvalT === g.time && gd.muzzleClearT > 0) { gd.muzzleDown = false; gd.muzzleClearT = 0; }   // (a man in a fight, the wall just off his line and no colleague on it this frame: up now, not after the hysteresis a calm man's gun waits out)
  return low;
}
/** The low carriages pulled in by the room they have: CharacterAnimator.gunWall for this frame, written after the pose is chosen and before the animator runs
 *  (guards.ts, squad.ts, player.ts). A ray along the low carriage's own line (hand → muzzle, on the aim's heading and — where they differ — the body's) says
 *  where the wall is; the muzzle is asked to stand `tuckM` short of it. The carriage rides the shoulders, so its reach is taken from where the gun shoulder
 *  stood ahead of his feet in last frame's pose: a torso twisted hard round or leaning into a stride reaches further than the carriage at rest, and is
 *  pulled in by that much more. Nothing while a gun is up or no gun is in a hand; 0 with the rule off. */
export function gunWallPose(g: Game, c: Character): void {
  const an = c.anim;
  if (!GUNWALL.on || showing(g)) { if (an.gunWall !== 0) an.gunWall = 0; return; }
  const carry = an.longStance ?? (an.stance === 'lowReady' || an.stance === 'none' ? 'lowLong' : 'portLong');   // (the animator's own choice of long carriage, near enough: the calm patrol carry is pulled in like the low ready)
  const lowNow = an.upper !== 'aim' && (an.longGun ? carry === 'lowLong' || carry === 'patrolLong' : an.stance === 'lowReady');
  if (!lowNow || !c.alive) { an.gunWall = 0; return; }
  const S = st(c); track(g, c, S);
  const K = GUNWALL, R = lowReach(c), span = R - TUCK_REACH; let w = 0;
  const one = (yaw: number) => {
    const F = frame(c, yaw), long = an.longGun, B = c.bonesAt;
    const sh = c.bones.upperArmR, shF = sh ? (sh[0] - B[0]) * F.f[0] + (sh[2] - B[1]) * F.f[2] : SH_REST;   // the gun shoulder ahead of his feet as the last pose had it
    const reach = R + clamp((shF - SH_REST) * SH_CARRY, 0, REACH_OVER);
    const a = long ? at(c, F, 0, 0.18, F.sh - 0.18) : at(c, F, 0, 0.08, F.sh - 0.3), b = long ? at(c, F, R, 0.03, F.sh - 0.51) : at(c, F, R, 0.08, F.sh - 0.49);
    const d = v3.sub(b, a), L = v3.len(d), rd = v3.scale(d, 1 / L), lead = closing(S, F.f) * K.tuckLeadS;
    for (const o of [0, -TUCK_HALF, TUCK_HALF]) {   // (a gun's width and the model's error either side: pulling in at an edge it would have cleared costs nothing)
      GUNWALL_STATS.asked++;
      const h = g.col.raycast([a[0] + F.r[0] * o, a[1], a[2] + F.r[2] * o], rd, L * (reach + K.tuckM + lead) / R); if (!h) continue;
      const room = h.t / L * R - K.tuckM - lead;   // how far ahead of his feet the muzzle may stand
      const k = (reach - room) / span;   // 1 = WALL_TUCK's carriage; past it, the hand drawn further back (character.ts WALL_TUCK.over, gunWall 1‥2)
      w = Math.max(w, k <= 1 ? Math.max(0, k) : 1 + clamp((k - 1) * span / WALL_TUCK.over, 0, 1));
    }
  };
  one(c.aimYaw); if (Math.abs(wrapAngle(c.aimYaw - c.bodyYaw)) > 0.15) one(c.bodyYaw);
  an.gunWall = w; if (w > 0) GUNWALL_STATS.tucked++;
}
/** Sam's pistol: the low ready this rule put him in is taken off again by it and by nobody else (`set` = it is the rule's this frame). */
export function gunWallStance(c: Character, set: boolean): void {
  const S = set ? st(c) : ST.get(c); if (!S) return;
  if (set) { if (c.anim.stance === 'none') { c.anim.stance = 'lowReady'; S.mine = true; } }
  else if (S.mine) { if (c.anim.stance === 'lowReady') c.anim.stance = 'none'; S.mine = false; }
}
/** checkpoints (savestate.ts): whose gun the wall holds down right now and what holds it — the band's memory, so a loaded game answers as the saved one
 *  would have. A row a man: his character id, then (if he has one) his `hold`'s twelve numbers. Only answers still fresh: nobody dead, held or pinned.
 *  A last row [-1, seconds] while the floor's fight is still remembered. */
export function gunWallSnapshot(g: Game): number[][] | undefined {
  if (!GUNWALL.on) return undefined;
  const rows: number[][] = [];
  for (const c of [g.player.char, ...g.guards.map(gd => gd.char)]) {
    if (!c.alive || !gunWallIs(g, c)) continue;
    const H = ST.get(c)!.hold; rows.push(H ? [c.id, H.x, H.z, H.yaw, H.pitch, H.sh, ...H.a, ...H.b, H.hot ? 1 : 0] : [c.id]);
  }
  const F = FIGHT.get(g); if (F && F.until > g.time) rows.push([-1, F.until - g.time]);   // (the floor's fight, still remembered: a row of its own under an id nobody has)
  return rows.length ? rows : undefined;
}
/** a restart (cleanrestart.ts): the fight the floor remembered was the last try's */
export function gunWallFresh(g: Game): void { FIGHT.delete(g); }
export function gunWallRestore(g: Game, rows: number[][] | undefined): void {
  if (!GUNWALL.on) return;
  const fr = rows?.find(x => x[0] === -1); FIGHT.set(g, { t: -1, until: fr ? g.time + fr[1] : -1 });
  for (const c of [g.player.char, ...g.guards.map(gd => gd.char)]) {
    const r = rows?.find(x => x[0] === c.id), S = r ? st(c) : ST.get(c); if (!S) continue;
    S.low = !!r; S.t = r ? g.time - 1e-3 : -1;   // (fresh, and not yet this frame's answer)
    S.wood = 0; S.vt = -1; S.rose = false;
    S.hold = r && r.length >= 13 ? { x: r[1], z: r[2], yaw: r[3], pitch: r[4], sh: r[5], a: [r[6], r[7], r[8]], b: [r[9], r[10], r[11]], hot: r[12] === 1 } : null;
  }
}
