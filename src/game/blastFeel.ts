// THE FEEL OF A WALL CHARGE GOING OFF — picture and sound only ('the wall shot should really feel explosive and bang things around. both the explosion and
// shock wave and sound').
//
// blastLook.ts made the blast LOOK like a wall's (a warm flash that cools, fragments out of the wall's two faces). This is what it does to the room and to whoever
// is watching, in four parts — every one of them for the player's eyes and ears, none of them read by play:
//   · SOUND. Its own report in place of the stun can's it borrowed: a hard CRACK (wallCrack), a deep THUMP with a rumble under it (wallThump) and a PATTER of
//     debris coming down for two seconds after (wallDebris) — sfx.ts. They arrive at the speed of sound from the blast to Sam's head (a frame or three across a
//     floor), and the crack loses level with distance faster than the thump does (FEEL.sound.dullM): from far off it is a thud and a rumble. Close to it, a second
//     lower ring in the ears on top of the one detonateStun plays.
//   · THE SHOCK WAVE, SEEN. A low ring of floor dust racing out from the wall on both faces (the far one only through a wall that gave) and dying within
//     FEEL.ring reach; what lies loose in its way — paper, chips, brass, dust — thrown outward by three impulses that follow the ring out; dust and crumbs shaken
//     down off the ceiling a beat later, each spot timed by its distance. Particles only: no box, no smoke-solver density (the guards' sight lines read that).
//   · THE FIREBALL. A fuller, brighter core of fat slow sparks in the hole for the first frames (they cool on the sparks' own ramp), dark pieces of the wall thrown through it, then a roll of dark soot
//     out of the same place — particle dust in a dark paint, lit like any dust.
//   · THE CAMERA KICK. A snap away from the blast that rings down inside FEEL.kickSecs, scaled by how far the look-at is from the blast, off the game clock (no
//     dice). It is written to FollowCamera.kick and applied ONLY round the frame's render (host/loop.ts: cam.kickIn() before the render, cam.kickOut() after the
//     HUD) — Game.update, the aim ray, WASD's basis, the on-screen tests and the session journal all read the camera as it was without it.
//
// LOOK AND SOUND ONLY. No collision, sight line, hearing event, damage, light or dice: the 'bang' event, the flash, the smoke and everything detonateStun and the
// destruction lane do stay to the number. It takes nothing from Math.random or the lane's hash counters (its own counter, hashed), brings its own seed with every
// particle record and impulse (the particle system's serials do not move); of its three sounds the thump and the patter bring their own rate and the crack
// brings none, so the mixer draws for it the ONE system-die number it drew for the stun can's bang this report replaces — that die stays in step too. It READS two things of play's
// and writes neither: g.wallCharge.set (which charges stand) and col.solidBlocked (where a wall stops the ring). The impulses move GPU particles only (the debris
// pool, furniture and men thrown by a blast are play, and another goal's). Not saved, not journaled: queued stages drop when the clock goes back.
//
// WHAT IT GOES BY: detonateStun carries no word of who is blowing, so — as blastLook.ts does — a burst is a wall charge's when it stands at the stun point of a
// charge that stood set last frame and has just left the list (wallcharge.ts blow(): 0.15 m off the face, 0.5 m up, + effects.ts bang.height).
//
// The switch: the destruction goal's (destructionSwitch.ts DESTRUCTION.on; `?nodestruction` = everything as it was) and its knob (chaos 0, the tour and the
// showcases: nothing of this). FEEL.on is a constant for an A/B; FEEL.kick is the one strength a player may want to turn down (Tab ▸ Destruction, kept per machine).
//
// Hooks (one line each): combat.ts detonateStun → wallReport (true: this module played the report, the stun can's is not) · game.ts update → blastFeelTick ·
// host/loop.ts stepFrame → cam.kickIn() / cam.kickOut() round the render.
import { SideMap } from '../math/side';
import type { Game } from './game';
import type { Particles, EmitOpts, PKind } from '../render/particles';
import type { FollowCamera } from './camera';
import type { SetWallCharge, WallSpot } from './wallcharge';
import { Vec3, v3 } from '../math/vec';
import { DESTRUCTION } from './destructionSwitch';
import { chaosOf, impulsesOn } from './destruction';
import { WALLCHARGE, wallPt } from './wallcharge';
import { gpuFx, emitDust } from './particleFx';
import { PLAYER_ID } from './consts';
import * as fx from './effects';

export const FEEL = {
  on: true,
  /** THE CAMERA KICK's strength: 1 = as authored, 0 = none (motion comfort — the one row on the panel) */
  kick: 1,
  /** the kick: metres the look-at is thrown at point blank · seconds until it is over · its decay constant · its ring in Hz · metres from the blast to the look-at at which it is nothing */
  kickM: 0.45, kickSecs: 0.45, kickTau: 0.14, kickHz: 7, kickReach: 28,
  sound: {
    /** gains of the three layers (the stun can's report plays at 1.0) · seconds after the crack the patter starts */
    crack: 1.0, thump: 1.0, debris: 0.6, debrisAfter: 0.1,
    /** seconds the thump comes behind the crack — one frame: sounds start on frames, and with their two peaks apart the pair at the wall sits lower against the mixer's limiter */
    thumpAfter: 1 / 60,
    /** the report CARRIES: past `carryFrom` m its gain rises to 1 + `carry` over the next `carryOver` m — far off it must still stand over a firefight */
    carry: 0.8, carryFrom: 3, carryOver: 7,
    /** m/s the report travels (and the most it is ever late, s) · metres at which the crack's own level has halved (the thump's does not: far off it is a thud) */
    c: 343, lateMax: 0.25, dullM: 14,
    /** the second ring in Sam's ears: gain at the wall · metres at which it is none */
    ring: 0.3, ringM: 7,
  },
  /** THE DUST RING per face: stages × sectors of low puffs, each stage `step` m further out and `every` s later (step ÷ every = the front's speed, 22 m/s) */
  ring: { stages: 9, sectors: 13, arc: 1.4, r0: 0.5, step: 0.55, every: 0.025, y: 0.14, speed: 5, life: 0.5, size: 0.3, color: [0.74, 0.72, 0.68] as Vec3 },
  /** THE PUSH on loose particles, per face: [seconds after the blast, radius m, strength] — three, following the ring out (the stun charge's own is 4 m · 3.0) */
  push: [[0, 3, 7], [0.075, 5.5, 4.5], [0.15, 8, 3]] as [number, number, number][], pushUp: 0.5,
  /** THE CEILING per face: spots within `reach` of the wall, each let go `after` + distance ÷ `speed` s into the blast: `puffs` of dust and `crumbs` that fall and lie */
  ceil: { spots: 13, reach: 6.5, after: 0.1, speed: 14, puffs: 3, crumbs: 3, color: [0.82, 0.81, 0.78] as Vec3 },
  /** THE FIREBALL per way out [into the room, back at the squad]: fat sparks and dark pieces of the wall at once, sparks again two frames on, soot rolling out from the second frame */
  fire: {
    core: { count: [30, 16], speed: [4.2, 3], life: 0.3, size: 0.11 },
    roll: { count: [14, 8], speed: [2.2, 1.6], life: 0.5, size: 0.15, after: 2 },
    soot: [{ after: 2, count: [12, 6], speed: 2.8, size: 0.3, life: 1.4 }, { after: 5, count: [9, 5], speed: 2.2, size: 0.38, life: 1.7 }, { after: 8, count: [8, 4], speed: 1.7, size: 0.44, life: 2.0 }, { after: 13, count: [6, 3], speed: 1.1, size: 0.54, life: 2.6 }],
    sootColor: [0.05, 0.044, 0.038] as Vec3,
    /** dark pieces of the wall thrown out through the flash on the blast's own frame: seen against it in flight, charred bits on the floor after */
    chunks: { count: [28, 14], speed: [8, 5.5], life: 7, size: 0.05, color: [0.05, 0.046, 0.042] as Vec3 },
  },
};
const LS_KEY = 'twopointsix.blastfeel';
let loaded = false;
/** the kick's strength as this machine last left it (lazily, at the first tick: nothing here runs at import) */
function loadFeel() { loaded = true; try { const s = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null; if (s) { const k = Number(JSON.parse(s).kick); if (k >= 0 && k <= 2) FEEL.kick = k; } } catch { /* a profile without storage: the authored strength */ } }
/** the kick's strength for the panel (read through here so the row shows this machine's copy before the first charge is set) */
export function feelKick(): number { if (!loaded) loadFeel(); return FEEL.kick; }
export function saveFeel() { try { localStorage.setItem(LS_KEY, JSON.stringify({ kick: FEEL.kick })); } catch { /* no storage: this session only */ } }

interface Face { o: Vec3; d: Vec3; mask: number }
interface Kick { t0: number; at: Vec3 }
interface State { seen: SetWallCharge[]; queue: { at: number; run: () => void }[]; kicks: Kick[]; serial: number; last: number; list: unknown }
const STATE = new SideMap<Game, State>('blastFeel.STATE');
const stateOf = (g: Game): State => { let s = STATE.get(g); if (!s) { s = { seen: [], queue: [], kicks: [], serial: 1, last: -1, list: null }; STATE.set(g, s); } return s; };
/** this module's own dice: a counter of its own through a hash (never the lane's, never Math.random) */
const hashU = (n: number) => { let x = Math.imul(n ^ 0x51ed270b, 0x85ebca6b) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0xc2b2ae35) >>> 0; x ^= x >>> 13; return x >>> 0; };
const dice = (S: State) => hashU(S.serial++) / 4294967296;
const FRAME = 1 / 60;
const live = (g: Game) => DESTRUCTION.on && FEEL.on && chaosOf(g) > 0;
const thick = (W: WallSpot) => 2 * (W.alongX ? W.box.h[2] : W.box.h[0]);
const near = (a: Vec3, b: Vec3, m: number) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < m;
/** where a wall charge's borrowed stun burst stands (wallcharge.ts blow() + combat.ts detonateStun) — blastLook.ts burstAt, the same three numbers */
const burstAt = (W: WallSpot): Vec3 => wallPt(W, 0, 0.15, 0.5 + fx.bang.height);
/** is the wall open at the charge (the blast made its hole)? one segment through it at the slab's height */
const holed = (g: Game, W: WallSpot) => !g.col.solidBlocked(wallPt(W, 0, 0.12, WALLCHARGE.height), wallPt(W, 0, -(thick(W) + 0.12), WALLCHARGE.height));
const later = (g: Game, S: State, secs: number, run: () => void) => { if (secs < FRAME / 2) run(); else S.queue.push({ at: g.time + secs - FRAME / 2, run }); };

/** combat.ts detonateStun, where it plays the stun can's report: true = this burst is a wall charge's and its own report is on its way (the can's is not played) —
 *  false = not this module's (the switch off, a thrown can, a door charge): the caller plays 'stunBang' as it always did. The rest of the feel starts here too. */
export function wallReport(g: Game, at: Vec3): boolean {
  if (!live(g)) return false;
  const S = STATE.get(g), set = g.wallCharge?.set; if (!S || !set) return false;
  const i = S.seen.findIndex(c => !set.includes(c) && near(burstAt(c.wall), at, 0.06)); if (i < 0) return false;
  const W = S.seen[i].wall; S.seen.splice(i, 1);
  const open = holed(g, W), n: Vec3 = W.alongX ? [0, 0, W.side] : [W.side, 0, 0];
  report(g, S, at);
  S.kicks.push({ t0: g.time, at: v3.copy(at) });
  // the ways out of the wall: back off the face it was set on, and — only through a wall that gave — into the room
  const faces: Face[] = [{ o: wallPt(W, 0, 0.35, 0), d: n, mask: 0 }];
  if (open) faces.unshift({ o: wallPt(W, 0, -(thick(W) + 0.35), 0), d: v3.scale(n, -1), mask: 0 });
  fireball(g, S, W, open, n);
  const R = FEEL.ring; for (let k = 0; k < R.stages; k++) later(g, S, FRAME + k * R.every, () => ringStage(g, S, k, faces));   // (from the frame AFTER the blast's: that one is the run's heaviest already)
  for (const [t, radius, strength] of FEEL.push) later(g, S, t, () => { const P = gpuFx(g); if (P && impulsesOn(g)) for (const F of faces) P.impulse([F.o[0], 0.25, F.o[2]], radius, strength, { up: FEEL.pushUp, occlude: true, eye: [F.o[0], 0.6, F.o[2]], seed: hashU(Math.imul(S.serial++, 2654435761)) }); });
  ceiling(g, S, faces);
  return true;
}

/** game.ts update, once a frame: the charges that stand set remembered for next frame's blast, the queued stages let go, the kick written to the camera */
export function blastFeelTick(g: Game, cam: FollowCamera) { const was = g.fogOfWar.begin(PLAYER_ID); try { blastFeelTickRaw(g, cam); } finally { g.fogOfWar.done(was); } }   // (a wall charge and every later stage of its blast — the dust ring, the roll, the soot, the crumbs — are the team's doing: fogofwar.ts FOG.ours)
function blastFeelTickRaw(g: Game, cam: FollowCamera) {
  const S0 = STATE.get(g), WC = g.wallCharge;
  if (!WC || !live(g)) { if (S0) { S0.seen.length = 0; S0.queue.length = 0; S0.kicks.length = 0; } if (cam.kick) cam.kick = null; return; }
  if (!S0 && !WC.set.length) { if (cam.kick) cam.kick = null; return; }   // (a kick left on the camera by another Game: not this one's to keep)
  const S = S0 ?? stateOf(g);
  if (!loaded) loadFeel();
  if (g.time < S.last || (S.list && S.list !== WC.set)) { S.queue.length = 0; S.kicks.length = 0; S.seen.length = 0; }   // (the clock went back — a load — or the charges' list is a new one — a restart, whose clock runs on: nothing of the old encounter's blast plays into this one)
  S.last = g.time; S.list = WC.set;
  S.seen.length = 0; for (const c of WC.set) S.seen.push(c);
  for (let i = 0; i < S.queue.length;) { const q = S.queue[i]; if (q.at <= g.time) { S.queue.splice(i, 1); q.run(); } else i++; }
  cam.kick = kickOf(g, S, cam);
}

/** THE KICK this frame: every live blast's snap away from it, ringing down — metres to add to the look-at for the render (null: none) */
function kickOf(g: Game, S: State, cam: FollowCamera): Vec3 | null {
  if (!S.kicks.length) return null;
  let x = 0, y = 0, z = 0, any = false;
  for (let i = S.kicks.length - 1; i >= 0; i--) {
    const K = S.kicks[i], age = g.time - K.t0;
    if (age > FEEL.kickSecs || age < 0) { S.kicks.splice(i, 1); continue; }
    let dx = cam.target[0] - K.at[0], dz = cam.target[2] - K.at[2]; const d = Math.hypot(dx, dz);
    if (d < 0.5) { dx = cam.forward[0]; dz = cam.forward[2]; }   // (looking straight at it: thrown back along the view)
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const far = Math.max(0, 1 - d / FEEL.kickReach), A = FEEL.kickM * FEEL.kick * far * Math.sqrt(far) * Math.exp(-age / FEEL.kickTau) * Math.min(1, (FEEL.kickSecs - age) / 0.08);
    if (!(A > 1e-4)) continue;
    const w = 2 * Math.PI * FEEL.kickHz * age, a1 = A * Math.cos(w), a2 = A * 0.45 * Math.sin(1.37 * w), a3 = A * 0.3 * Math.sin(0.81 * w + 1);
    x += dx * a1 - dz * a2; z += dz * a1 + dx * a2; y += a3; any = true;
  }
  return any ? [x, y, z] : null;
}

/** THE REPORT: crack, thump and patter from the blast, as late as the sound takes to reach Sam's head, the crack thinner the further it has come */
function report(g: Game, S: State, at: Vec3) {
  const K = FEEL.sound, ear = g.player.char.bones.head ?? v3.add(g.player.char.pos, [0, 1.6, 0]), d = v3.dist(ear, at);
  const late = Math.min(K.lateMax, d / K.c), dull = 1 / (1 + (d / K.dullM) * (d / K.dullM));
  const carry = 1 + K.carry * Math.min(1, Math.max(0, (d - K.carryFrom) / K.carryOver));
  const r2 = 0.96 + 0.06 * dice(S), r3 = 0.94 + 0.12 * dice(S);
  // (the crack passes NO rate: the mixer draws its own, off the system die — the one draw the can's bang took in its place, so that die stands where it stood)
  later(g, S, late, () => g.audio.play('wallCrack', at, K.crack * (0.25 + 0.75 * dull) * carry));
  later(g, S, late + K.thumpAfter, () => g.audio.play('wallThump', at, K.thump * carry, { rate: r2 }));
  later(g, S, late + K.debrisAfter, () => g.audio.play('wallDebris', at, K.debris * (0.4 + 0.6 * dull) * carry, { rate: r3 }));
  if (!g.player.down && d < K.ringM) later(g, S, late, () => g.audio.play('earRing', null, K.ring * (1 - d / K.ringM), { rate: 0.9 }));
}

/** one record, with a seed of this module's own (the particle system's serial stays where it was) */
function emit(S: State, P: Particles, kind: PKind, pos: Vec3, dir: Vec3, count: number, o: EmitOpts): void {
  const oo = { ...o, seed: hashU(Math.imul(S.serial++, 2654435761)) };
  if (kind === 'dust') emitDust(P, pos, dir, count, oo); else P.emit(kind, pos, dir, count, oo);
}

/** THE FIREBALL: fat slow sparks in the hole, a second smaller lot two frames on, then soot rolling out of it */
function fireball(g: Game, S: State, W: WallSpot, open: boolean, n: Vec3) {
  const B = FEEL.fire, H = WALLCHARGE.height;
  const ways: { from: Vec3; d: Vec3; k: 0 | 1 }[] = [{ from: wallPt(W, 0, 0.14, H), d: n, k: 1 }];
  if (open) ways.unshift({ from: wallPt(W, 0, -(thick(W) + 0.14), H), d: v3.scale(n, -1), k: 0 });
  const sparks = (F: { count: number[]; speed: number[]; life: number; size: number }, jit: number) => { const P = gpuFx(g); if (!P) return; for (const w of ways) { const i = open ? w.k : 0;
    emit(S, P, 'spark', w.from, v3.normalize([w.d[0], 0.15, w.d[2]]), F.count[i], { shape: 'cone', speed: F.speed[i], speedJit: 0.7, spread: 1.25, life: F.life, lifeJit: 0.5, size: F.size, sizeJit: 0.5, posJit: jit }); } };
  sparks(B.core, 0.2);
  { const P = gpuFx(g), C = B.chunks; if (P) for (const w of ways) { const i = open ? w.k : 0;
    emit(S, P, 'debris', w.from, v3.normalize([w.d[0], 0.35, w.d[2]]), C.count[i], { shape: 'cone', speed: C.speed[i], speedJit: 0.6, spread: 0.95, life: C.life, lifeJit: 0.3, size: C.size, sizeJit: 0.6, aspect: 1.7, posJit: 0.25, color: C.color }); } }
  later(g, S, B.roll.after * FRAME, () => sparks(B.roll, 0.28));
  for (const s of B.soot) later(g, S, s.after * FRAME, () => { const P = gpuFx(g); if (!P) return; for (const w of ways) { const i = open ? w.k : 0;
    emit(S, P, 'dust', v3.mad(w.from, w.d, 0.15), v3.normalize([w.d[0], 0.5, w.d[2]]), s.count[i], { shape: 'puff', speed: s.speed, speedJit: 0.5, lift: 0.5, life: s.life, lifeJit: 0.3, size: s.size, sizeJit: 0.3, posJit: 0.22, vadd: v3.scale(w.d, s.speed * 0.6), color: B.sootColor }); } });
}

/** one stage of THE DUST RING: on each face, a puff or three in every sector the wave can still reach (a sector a wall stops stays stopped) */
function ringStage(g: Game, S: State, k: number, faces: Face[]) {
  const P = gpuFx(g); if (!P) return;
  const R = FEEL.ring, r = R.r0 + k * R.step, f = 1 - k / R.stages;
  for (const F of faces) for (let j = 0; j < R.sectors; j++) {
    if (F.mask & (1 << j)) continue;
    const a = (j / (R.sectors - 1) - 0.5) * 2 * R.arc, c = Math.cos(a), s = Math.sin(a);
    const dir0: Vec3 = [F.d[0] * c - F.d[2] * s, 0, F.d[2] * c + F.d[0] * s];
    if (g.col.solidBlocked([F.o[0], 0.3, F.o[2]], [F.o[0] + dir0[0] * r, 0.3, F.o[2] + dir0[2] * r])) { F.mask |= 1 << j; continue; }
    // (each puff off its sector's line and its stage's radius by up to half a cell: a front, not a lattice of countable patches)
    const a2 = a + (dice(S) - 0.5) * 0.9 * 2 * R.arc / (R.sectors - 1), r2 = r + (dice(S) - 0.5) * 0.9 * R.step, c2 = Math.cos(a2), s2 = Math.sin(a2);
    const dir: Vec3 = [F.d[0] * c2 - F.d[2] * s2, 0, F.d[2] * c2 + F.d[0] * s2], p: Vec3 = [F.o[0] + dir[0] * r2, R.y, F.o[2] + dir[2] * r2];
    if (g.col.solidBlocked([F.o[0], 0.3, F.o[2]], [p[0], 0.3, p[2]])) continue;
    emit(S, P, 'dust', p, dir, k < 4 ? 4 : 3, { shape: 'cone', speed: R.speed * (0.5 + 0.5 * f), speedJit: 0.4, spread: 0.3, life: R.life, lifeJit: 0.3, size: R.size * (1.5 - 0.5 * f), sizeJit: 0.3, posJit: Math.min(0.1, R.y * 0.7), color: R.color });
  }
}

/** THE CEILING: spots over the room on each face the blast can see, each shaken a beat after the wave gets under it — dust that hangs, crumbs that fall and lie */
function ceiling(g: Game, S: State, faces: Face[]) {
  const C = FEEL.ceil;
  for (const F of faces) for (let j = 0; j < C.spots; j++) {
    const a = (dice(S) - 0.5) * 2 * 1.45, r = 0.7 + (C.reach - 0.7) * Math.sqrt(dice(S)), c = Math.cos(a), s = Math.sin(a);
    const x = F.o[0] + (F.d[0] * c - F.d[2] * s) * r, z = F.o[2] + (F.d[2] * c + F.d[0] * s) * r;
    if (g.col.solidBlocked([F.o[0], 1.4, F.o[2]], [x, 1.4, z])) continue;
    const up = g.col.raycast([x, 2.0, z], [0, 1, 0], 6); if (!up) continue;   // (open sky: nothing overhead to shake)
    const at: Vec3 = [x, 2.0 + up.t - 0.06, z];
    later(g, S, C.after + r / C.speed, () => { const P = gpuFx(g); if (!P) return;
      emit(S, P, 'dust', at, [0, -1, 0], C.puffs, { shape: 'puff', speed: 0.9, speedJit: 0.5, lift: -0.6, life: 1.7, lifeJit: 0.3, size: 0.13, sizeJit: 0.35, posJit: 0.12, color: C.color });
      emit(S, P, 'debris', at, [0, -1, 0], C.crumbs, { shape: 'cone', speed: 0.8, speedJit: 0.8, spread: 0.9, life: 14, lifeJit: 0.3, size: 0.012, sizeJit: 0.6, posJit: 0.1, color: C.color }); });
  }
}
