// THE GRAB DISARMS HIM — the maintainer, 10-23: "we should also make the grab super satisfying. cool animation where sam disarms him and satisfying sounds",
// and of the whole close-in: "it should feel very smooth and slick and almost like a rhythm game".
//
// A man taken from behind with a gun in his hand used to have it knocked out on the grab's first frame (HOLD.dropGun: an item thrown clear with a roll of the
// dice, a magazine's clatter at half voice). With HOLD.disarm on, the grab is three beats:
//   THE CATCH   frame 0, as ever: the left arm goes round his throat (player.ts startGrab; the hold's own clock and phases are untouched — he is `held` on the
//               frame he always was). Its voice is `grabCatch`.
//   THE STRIP   HOLD.strip.take seconds in: Sam's right hand is on the gun and it is out of the man's fist — an item from that frame, `carried` in Sam's hand
//               (throwables.ts: placed here every frame, no physics); the man's hands are empty (Guard.gunLostAt, as HOLD.dropGun always stamped it). Voice
//               `gunStrip`. The pistol hold (Sam's right hand has his own gun) raps it out with the frame instead: it falls from where the man held it.
//   THE GUN DOWN  HOLD.strip.drop: he lets it fly from a straight arm out at his right. It turns flat as it goes (a fixed rate), lands most of a metre clear of
//               the pair with next to no bounce, and lies there: no dice. Voice `gunDown`, once, as it lands.
// then the hand comes back up behind the man's shoulder and onto its station on him (character.ts holdLayer; the knife is in that fist only from
// HOLD.strip.knife on — combat.ts asks disarmHand).
//
// WHAT THE ROOM HEARS is what it heard before: the grab's one 'prop' event at player.ts GRAB_NOISE, on the grab's frame. The strip and the gun on the floor
// are voices for the player's ears and no event of their own, as the gun knocked out of his hand never was one (combat.ts dropFromHand, quiet).
//
// However the hold ends under the move, nothing is left hanging: before the take the gun is still his (killGuard drops it, a freed man keeps it); after it the
// item is his `dropped` like any gun lost at a grab (a freed man has it back: guards.ts gunBack), and one still in Sam's hand with no hold to carry it for
// falls from where it is. A checkpoint is not written with an item off the floor (savestate.ts), and a hold is not filed at all.
//
// State: Hold.strip (player.ts), gone with the hold; Item.carried. No module state, no dice of its own (an item's spawn draws the four it always draws).
import type { Game, Guard } from './game';
import type { Hold } from './player';
import type { Item } from './throwables';
import { GRAVITY } from './throwables';
import type { Character, StripPose } from './character';
import type { DropKind } from './weapons';
import { HOLD } from './character';
import { inHand } from './guards';
import { Vec3, v3 } from '../math/vec';

/** the move while it runs: its own clock, s (the hold's, but for HOLD.stripFirst, which runs it ahead until the gun is let go) · what he had (the item's kind, and whether it wore a can) · the man's gun hand as last posed
 *  (WORLD; held where it was once the gun is taken) · the gun while it is in Sam's hand · the pistol hold's (rapped out, never carried) · it has left him */
export interface Strip { t: number; kind: DropKind; supp: boolean; at: Vec3; item: Item | null; rap: boolean; gone: boolean; yaw: number; }
/** the three voices' gains (audio/sfx.ts grabCatch, gunStrip, gunDown) and the rate a long gun's strip and fall are played at (one buffer each: lower = heavier) */
export const DISARM_GAIN = { catch: 0.5, strip: 0.45, down: 0.4, long: 0.8 };
/** a dropped gun lies as long as any (combat.ts GUN_ITEM_LIFE) */
const LIFE = 240;
const DEG = Math.PI / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t, sstep = (a: number, b: number, t: number) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

/** player.ts startGrab, once the hold exists: the gun still in his hand is the disarm's to take (HOLD.disarm, under HOLD.dropGun — with either off, nothing) */
export function disarmBegin(g: Game): void {
  const H = g.player.holding; if (!H || !HOLD.disarm || !HOLD.dropGun) return;
  const gd = H.g; if (inHand(gd) !== 'weapon') return;
  H.strip = { t: 0, kind: gd.weapon.def.drop, supp: gd.weapon.def.suppressed, at: handOf(gd), item: null, rap: H.variant === 'gun', gone: false, yaw: v3.yawOf(gd.char.gunDir) };
  if (leads(H.strip)) g.player.catchDue = g.time + HOLD.first.catch;
}
/** the grab's first voice (player.ts startGrab, every grab): the catch with the move's two keys on, the scuffle it always was without — so one condition
 *  decides all three voices. Its rate is pinned: the beat does not wander */
export function disarmCatch(g: Game, at: Vec3): void {
  if (leads(g.player.holding?.strip)) return;   // (HOLD.stripFirst: the strip is heard first, and the catch as the arm lands — disarmTick)
  if (HOLD.disarm && HOLD.dropGun) g.audio.play('grabCatch', at, DISARM_GAIN.catch, { rate: 1 }); else g.audio.play('grabScuffle', at, 0.4);
}
/** THE DISARM LEADS (HOLD.stripFirst) for this move: a gun to take with an empty hand (the pistol hold's rap comes down with the frame, as it did) */
const leads = (S: Strip | null | undefined): boolean => !!S && HOLD.stripFirst && !S.rap;
/** …the rate its clock runs at: ahead of the hold's, so that the take falls `first.take` s in and the let-go at `first.drop`, and the hold's own pace from there */
function lead(S: Strip): number {
  if (!leads(S)) return 1;
  const K = HOLD.strip, F = HOLD.first;
  return S.t < K.take ? K.take / Math.max(0.02, F.take) : S.t < K.drop ? (K.drop - K.take) / Math.max(0.02, F.drop - F.take) : 1;
}
/** what both figures' hold layers are told of it this frame (player.ts holdTail) */
export function disarmPose(S: Strip): StripPose { return { t: S.t, at: S.at }; }
/** Sam's right fist is the gun's, not yet the knife's (combat.ts handProps: no blade is drawn in it) */
export function disarmHand(H: Hold): boolean { return !!H.strip && H.strip.t < HOLD.strip.knife; }

/** once a frame, after everybody has been posed (game.ts): the move's clock, the take, the gun carried, the gun let go */
export function disarmTick(g: Game, dt: number): void {
  const pl = g.player, H = pl.holding, S = H?.strip ?? null;
  for (const it of g.items.items) if (it.carried && it !== S?.item) letGo(g, it, pl.char);   // (a gun in his hand and no hold to carry it for — however that ended — falls from where it is)
  if (pl.catchDue !== undefined && (!H || !S || g.time >= pl.catchDue || H.phase !== 'grab')) {   // (HOLD.stripFirst: the catch's voice as the arm lands — or now, if the hold or the move ended first: a grab is never silent)
    pl.catchDue = undefined; g.audio.play('grabCatch', v3.add((H?.g.char ?? pl.char).pos, [0, 1.4, 0]), DISARM_GAIN.catch, { rate: 1 }); }
  if (!H || !S) return;
  const K = HOLD.strip, gd = H.g;
  S.t += dt * lead(S) * (S.gone && H.phase !== 'grab' && H.phase !== 'held' ? 2 : 1);   // (a choke or the knife begun at once: the hand is home in half the time, ahead of what that move asks of it)
  if (!S.item && !S.gone) {
    if (inHand(gd) !== 'weapon') { H.strip = undefined; return; }   // (something else has had it out of his hand since the grab: nothing left to take)
    S.at = handOf(gd);
    if (S.t >= K.take) take(g, H, S);
  }
  if (S.item) { if (S.t < K.drop) carry(S, pl.char); else { letGo(g, S.item, pl.char, K.fall > 0 ? K.fall + (leads(S) ? Math.round((K.drop - HOLD.first.drop) * 60) / 60 : 0) : 0); S.item = null; S.gone = true; } }   // (HOLD.stripFirst lets it go sooner: the fall is longer by that many whole steps, and the knock on the frame it was)
  if (S.t >= K.home) H.strip = undefined;
}

const handOf = (gd: Guard): Vec3 => v3.copy(gd.char.bones.handR ?? v3.add(gd.char.pos, [0, 1.05, 0]));
const long = (kind: string) => kind === 'rifle';

/** the gun leaves his hand: an item from here on, his `dropped`, his hands empty (as HOLD.dropGun stamps a gun lost at the grab) — in Sam's hand, or, rapped out
 *  by the pistol hold, falling from where it was */
function take(g: Game, H: Hold, S: Strip): void {
  const gd = H.g, K = HOLD.strip;
  const it = g.items.spawn(S.kind, S.at, [0, 0, 0], { who: gd.char.id, fill: S.supp ? 1 : 0, heading: S.yaw, yaw: S.yaw, life: LIFE, spin: 0, tumbleRate: 0, tumble: K.pitch[0] * DEG, restitution: K.rest });
  it.onBounce = gunDown;
  gd.dropped = it; gd.gunLostAt = g.time;
  g.audio.play('gunStrip', S.at, DISARM_GAIN.strip, { rate: (long(S.kind) ? DISARM_GAIN.long : 1) * (S.rap ? 1.12 : 1) });
  if (S.rap) { letGo(g, it, gd.char); S.gone = true; } else { it.carried = true; S.item = it; carry(S, g.player.char); }
}
/** the gun in Sam's hand this frame: a hand's length ahead of his wrist along the hand, swung out to his right and muzzle-down as he tears it clear */
function carry(S: Strip, sam: Character): void {
  const it = S.item!, K = HOLD.strip, b = sam.bones, w = b.handR; if (!w) return;
  const tip = b.fingerR ?? w, d = v3.sub(tip, w), L = v3.len(d), ahead = K.hold[long(S.kind) ? 1 : 0];
  it.pos = L > 1e-4 ? v3.mad(w, d, ahead / L) : v3.copy(w); it.vel = [0, 0, 0];
  const u = sstep(K.take, K.out, S.t), v = sstep(K.out, K.drop, S.t);
  it.yaw = it.heading = S.yaw - (70 * u + 20 * v) * DEG; it.tumble = lerp(lerp(K.pitch[0], K.pitch[1], u), K.pitch[2], v) * DEG;
}
/** let go of: it falls from where it is with the pair's own motion and a little push out to that man's right — dead, no spin; never from inside a wall (a
 *  hand can be posed through one: the item is brought back to the near face) */
function letGo(g: Game, it: Item, by: Character, fall = 0): void {
  const K = HOLD.strip, y = by.bodyYaw, from: Vec3 = [by.pos[0], Math.max(0.3, it.pos[1]), by.pos[2]];
  const d: Vec3 = [it.pos[0] - from[0], 0, it.pos[2] - from[2]], L = Math.hypot(d[0], d[2]);
  let push = K.push[0];
  if (L > 1e-3) { const dir: Vec3 = [d[0] / L, 0, d[2] / L], hit = g.col.raycast(from, dir, L + it.radius + 0.05); if (hit) { it.pos = v3.mad(from, dir, Math.max(0, hit.t - it.radius - 0.03)); push = 0; } }
  it.carried = false; it.settled = false; it.spin = push > 0 ? K.spin : 0; it.tumbleRate = 0;   // (thrown: it turns flat as it goes — a fixed rate, no dice; stopped at a wall: dead, as it was)
  // THE THROW'S FALL IS TIMED (HOLD.strip.fall): thrown at a fixed speed down, the gun landed a frame sooner or later with the height of the hand that let it
  // go (a pistol or a carbine, Sam crouched or standing, either stand's poses) — and the knock is a beat. He throws it down just hard enough to be on what
  // lies under its landing place `fall` seconds on, from wherever the hand is; no dice. A gun stopped at a wall, rapped out, or let fall with no hold: as before.
  // With the disarm leading (HOLD.stripFirst) he lets go sooner by `strip.drop - first.drop`, and the fall is longer by that in whole steps: the knock stays on its frame
  let down = K.push[1], vx = by.vel[0] - Math.cos(y) * push, vz = by.vel[2] + Math.sin(y) * push;
  if (fall > 0 && push > 0) {
    // (…and never INTO a wall: one in the way of the throw within its reach, and he throws it that much shorter — a gun that rubs down a wall is slowed, and its knock late)
    const T = fall, sp = Math.hypot(vx, vz), wall = sp > 1e-3 ? g.col.raycast(it.pos, [vx / sp, 0, vz / sp], sp * T + it.radius + 0.08) : null;
    if (wall) { const k = Math.max(0, wall.t - it.radius - 0.08) / (sp * T); vx *= k; vz *= k; }
    const under = g.col.raycast([it.pos[0] + vx * T, it.pos[1], it.pos[2] + vz * T], [0, -1, 0], it.pos[1] + 0.1), D = (under ? under.t : it.pos[1]) - it.radius;
    if (D > 0.3) down = Math.min(4, Math.max(-1.5, D / T - 0.5 * GRAVITY * T));   // (below zero it leaves his hand going up a little: a long fall from a low hand is a lob)
  }
  it.vel = [vx, -down, vz];
}
/** the gun on the floor: one dull knock, the first time it lands (Item.onBounce — it keeps nothing of its own but the item's count) */
function gunDown(sp: number, p: Vec3, g: Game, it: Item, n: Vec3): void {
  if (n[1] < 0.6) return;   // (thrown, it may touch a wall or a table's edge on its way: the knock is for what it LANDS on — a floor, a step, a pallet's top — by the face it struck. It was a height, 0.25 m: a gun thrown down harder met a wall under that and knocked there, and one landing on a low slab would have said nothing)
  if (sp < 0.7 || (it.clatters = (it.clatters ?? 0) + 1) > 1) return;
  g.audio.play('gunDown', p, DISARM_GAIN.down * Math.min(1, 0.5 + sp / 8), { rate: long(it.kind) ? DISARM_GAIN.long : 1 });
}
