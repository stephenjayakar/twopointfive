// A BLAST IN THE SNOW (SNOW_LOOK.blast; ?snowblast=0, TPS_SNOWBLAST=1) — picture only.
//
// The maintainer, playing the snow level on his GPU (10-15): "grenades/he don't seem to really affect snow". They did not: a frag left its scorch and its smoke,
// and the snow it went off in lay as it fell. His standing notes bind what a blast must be here: "the control approach" (one event told at every grain size,
// from the chunks down to the dust) and "should really feel explosive and bang things around. both the explosion and shock wave".
//
// What one blast over lying snow now does, each a layer the level already had:
//   · THE CRATER — into the prints' map (snowTracks.ts pressCrater): a blown-out pan with a ragged lip, scoured rays, clods thrown about it. The big pieces.
//   · THE DIG    — where snow STANDS (a drift's hill, a bank against a wall: render/snowField.ts, baked once) the blast digs it out to the ground, or to
//                  whatever of it still stands solid (digSnowField). A charge that cuts a hole in a wall no longer leaves the bank drawn across the hole.
//   · THE THROW  — the loose snow about it goes up and out as a burst of the near GRAINS (particles.wgsl grainStep reads grain.c / .d: for a few frames a share
//                  of every lying grain is the blast's). The fine pieces.
//   · THE PUFF   — a ring of powder low over the ground, as wisp records with no gust length (particles.wgsl puffRec). The dust.
//   · THE AIR    — a short hard radial shove to the wind's simulation (airSim.ts airPuff): the blown snow already in the air is driven off the blast and curls
//                  back round whatever it meets. The shock wave, as the snow shows it.
// Every blast that goes through the destruction engine's feed is told (g.destr.onBlast: a frag, an HE round, a charge on a wall or a door) — nothing here asks
// what threw it. Nothing here is read by the game: no die of the game's is rolled (the crater's shape is hashed off where it is and which it was), no sense, no
// path, no sound. Off = the snow as it was: nothing subscribes, nothing is stamped or filed.
//
// NEVER SEEN ON A GPU, never seen moving (the cloud has neither): every number below is a first guess for the maintainer's eye — `__snow.blast` on the console.
import { SideMap, SideSet } from '../math/side';
import type { Game } from './game';
import type { Particles } from '../render/particles';
import { clamp } from '../math/vec';
import { SNOW_LOOK } from './weatherKinds';
import { snowFieldAt, digSnowField, restoreSnowField } from '../render/snowField';
import { pressCrater } from './snowTracks';
import { airPuff } from './airSim';
import { wispLookByte } from './snowFx';

/** The blast's numbers in snow. Authored data, not player switches — all LIVE (a blast reads them when it goes off). */
export const SNOWBLAST = {
  // ---- how big: the pan's radius = the blast's own reach × sizeK, held between the two, and less the higher over the snow it went off
  sizeK: 0.26,        // × the blast's destruction radius (a frag's 2.5 m → a pan 0.65 m across the half)
  sizeMin: 0.3,       // m
  sizeMax: 1.4,       // m
  high: 1.6,          // m over the snow at which a blast no longer marks it (0.3 m and under: the whole of it)
  // ---- the crater in the prints' map (snowTracks.ts pressCrater)
  lobe: 0.22,         // how far the pan's outline wanders off a circle (three slow lobes)
  rag: 0.07,          // … and its fine ragged edge
  floor: 1,           // how deep the pan is pressed (1 = to the prints' own floor)
  rim: 2.2,           // × a print's bank: the lip thrown up round it
  rays: 13,           // scoured grooves running out of it
  rayLen: 1.9,        // × the pan's radius: the longest of them
  rayWide: 0.17,      // × the pan's radius: their half width at the root
  clods: 46,          // lumps thrown about it
  clodFar: 3.2,       // × the pan's radius: how far the farthest lands
  clodR: 0.1,         // m: the biggest clod's radius
  // ---- the dig: the standing snow about it (snowField.ts digSnowField)
  dig: 1.5,           // × the pan's radius: a hill is dug to nothing this far out (and is itself again half as far on); 0 = hills are left standing
  digS: 1.5,          // s the dig is asked again each frame (a charge's hole takes the bank's foot a frame or more after the blast: what stood solid then no longer does); the texels are walked again only when what stands there changed
  // ---- the throw: near grains (they must be running: SNOW_LOOK.grains and wind enough to have any lying)
  throwS: 0.14,       // s the blast goes on taking lying grains
  throwShare: 0.5,    // the share of all lying grains it takes over that time
  throwR: 1.3,        // × the pan's radius: the disc they are lifted from
  out: 7,             // m/s outward, the fastest
  up: 3.2,            // m/s upward, the fastest
  // ---- the puff of powder: wisp records
  puff: 28,           // wisps a blast files (fewer when the ring is short of room)
  puffR: 1.2,         // × the pan's radius: the disc they are born over
  puffLife: 1.5,      // s
  puffSize: 0.8,      // m across
  puffOut: 4,         // m/s outward, the fastest (the air has them inside a fifth of a second)
  // ---- the shove to the wind's simulation
  air: 2.2,           // m/s of outflow at the puff's edge (× the game's air, as every source is: the grains fly at SNOWGRAINS.speedK × it)
  airR: 1.5,          // × the pan's radius: the puff's size
  airS: 0.3,          // s it lasts, falling off to nothing
  // ---- ONE SNOW IN ONE AIR (SNOW_LOOK.oneAir: there are no grains to throw): the loose snow goes up as a burst of FLAKES, the very snow that is falling, and the
  // shove above carries them out and round what they meet; they come down at a flake's own fall
  flakes: 180,        // flakes a blast throws up (fewer when the ring is short of room)
  flakeUp: 7,         // m/s upward, the fastest (a flake's own drag has it stopped inside a fifth of a second, a hand to a metre up)
  flakeLife: 3,       // s
};

/** a blast of the last half second (LIVE_S): where, how big, how low, how old. What it still owes the particle pool is the host's (SnowBlastShown) */
interface Live { x: number; z: number; size: number; hk: number; t: number; serial: number }
const LIVE_S = 0.5;
/** the read-out: the game's own tallies, and beside them the host's (`puffs`, `thrown`, `throwFrames`: records its pool took) as they stood when asked */
export interface SnowBlastStats extends Tally { puffs: number; thrown: number; throwFrames: number; live: number }
interface Tally { blasts: number; marked: number; craters: number; why: string; last: { x: number; z: number; size: number; hk: number } | null; dug: number }
interface Dig { x: number; z: number; r: number; serial: number; t: number }
interface State { live: Live[]; digs: Dig[]; restore: boolean; serial: number; stats: Tally }
const states = new SideMap<Game, State>('snowBlast.states');
const hooked = new SideSet<object>('snowBlast.hooked');
const stateOf = (g: Game): State => { let s = states.get(g); if (!s) { s = { live: [], digs: [], restore: false, serial: 0, stats: { blasts: 0, marked: 0, craters: 0, why: 'no blast yet', last: null, dug: 0 } }; states.set(g, s); } return s; };
/** WHAT A BLAST STILL OWES THE POOL IS THE HOST'S (host/api.ts `HostBooks.snowBlast`), not the game's: how much of its puff and of its thrown flakes the pool
 *  has yet to take, whose turn the grains' throw is, and the records filed all follow the particle pool (a host with none files nothing), and no rule of the
 *  game reads them. The game keeps only the blast itself for LIVE_S, on any host alike. A row here is a live blast's, known by its serial and place; a live
 *  blast the book has no row for (a fresh book after the host put the game back, the pool's ring emptied in the same call) is owed whole again. */
interface Owed { serial: number; x: number; z: number; t: number; puffLeft: number; flakeLeft: number }
export interface SnowBlastShown { owed: Owed[]; turn: number; puffs: number; thrown: number; throwFrames: number }
const shownOf = (g: Game): SnowBlastShown => (g.engine.hostBooks ??= {}).snowBlast ??= { owed: [], turn: 0, puffs: 0, thrown: 0, throwFrames: 0 };
/** the book's rows for the live blasts, in their order (a blast that is gone has its row dropped; one older than its row is another timeline's: owed afresh) */
function owedOf(B: SnowBlastShown, live: Live[]): Owed[] {
  const K = SNOWBLAST, was = B.owed;
  return B.owed = live.map((b) => { const o = was.find((o) => o.serial === b.serial && o.x === b.x && o.z === b.z && o.t <= b.t);
    if (o) { o.t = b.t; return o; }
    return { serial: b.serial, x: b.x, z: b.z, t: b.t, puffLeft: Math.max(0, Math.round(K.puff * b.hk)), flakeLeft: Math.max(0, Math.round(K.flakes * b.hk)) }; });
}
/** the live blasts beside their rows in the host's book, or null with none live (the rows of blasts that are over go then) or the switch off */
function owing(g: Game): { live: Live[]; B: SnowBlastShown; owed: Owed[] } | null {
  const s = states.get(g); if (!s || !SNOW_LOOK.blast) return null;
  if (!s.live.length) { const B = g.engine.hostBooks?.snowBlast; if (B) B.owed.length = 0; return null; }
  const B = shownOf(g); return { live: s.live, B, owed: owedOf(B, s.live) };
}
export const snowBlastStats = (g: Game): SnowBlastStats => { const s = stateOf(g), B = g.engine.hostBooks?.snowBlast; return { ...s.stats, live: s.live.length, puffs: B?.puffs ?? 0, thrown: B?.thrown ?? 0, throwFrames: B?.throwFrames ?? 0 }; };

/** hear the level's blasts (once per destruction engine: a new level's engine is heard afresh). Called every frame; costs a set lookup. */
export function attachSnowBlast(g: Game) {
  if (!SNOW_LOOK.blast) return;
  const d = (g as unknown as { destr?: { onBlast?: (fn: (b: { at: ArrayLike<number>; radius?: number }) => void) => unknown } }).destr;
  if (!d || typeof d.onBlast !== 'function' || hooked.has(d)) return;
  hooked.add(d);
  d.onBlast((b) => { snowBlastAt(g, b.at, b.radius ?? 2.5); });
}
/** a restart: nothing is left in the air (the prints' map is cleared by its own owner) */
export function clearSnowBlast(g: Game) { const s = states.get(g); if (s) { s.live.length = 0; s.digs.length = 0; s.restore = true; } }
/** Once a frame, late (game.ts, beside the prints): the hills a blast dug out. Returns the field's texels that changed, for the g-buffer, or null. A dig is asked
 *  again each frame for SNOWBLAST.digS: the snow box that stood solid under the hill when the blast went off may be taken a frame or more later. Asked again with
 *  the same boxes standing it could not lower a texel, so the field's texels are walked only on a dig's first frame and when what stands in its reach changed
 *  (snowField.ts digSnowField `keep`, the field's own notes): the field is the same field to the byte, and a wide dig costs its walk once, not every frame. */
export function stepSnowDigs(g: Game, dt: number): [number, number, number, number] | null {
  const s = states.get(g), F = g.snowField; if (!s || !F) return null;
  let out: [number, number, number, number] | null = null;
  if (s.restore) { s.restore = false; if (restoreSnowField(F)) out = [0, 0, F.w - 1, F.h - 1]; }
  if (!s.digs.length) return out;
  for (const d of s.digs) {
    const r = digSnowField(F, g.level.boxes, d.x, d.z, d.r, d.serial, true);
    if (r) { s.stats.dug++; out = out ? [Math.min(out[0], r[0]), Math.min(out[1], r[1]), Math.max(out[2], r[2]), Math.max(out[3], r[3])] : r; }
    d.t += Math.max(dt, 1e-4);
  }
  s.digs = s.digs.filter((d) => d.t < SNOWBLAST.digS);
  return out;
}

/** A blast of destruction radius `radius` at `at`: mark the snow if it went off over lying snow, low enough. True = it did. */
export function snowBlastAt(g: Game, at: ArrayLike<number>, radius: number): boolean {
  const K = SNOWBLAST; const s = stateOf(g); const S = s.stats;
  const F = g.snowField;
  if (!SNOW_LOOK.blast || !F) return false;
  S.blasts++;
  const x = at[0], z = at[2];
  const size0 = clamp(radius * K.sizeK, K.sizeMin, K.sizeMax);
  // lying snow under it: at its middle, or under most of a ring a pan's width out (a blast against a wall's foot, in a doorway)
  const mid = snowFieldAt(F, x, z);
  let lies = mid.cover >= 0.5 ? 6 : 0;
  if (!lies) for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + 0.4; if (snowFieldAt(F, x + Math.cos(a) * size0 * 0.7, z + Math.sin(a) * size0 * 0.7).cover >= 0.5) lies++; }
  if (lies < 3) { S.why = 'no lying snow under it'; return false; }
  const over = at[1] - mid.mound;
  const hk = clamp(1 - (over - 0.3) / Math.max(0.1, K.high - 0.3), 0, 1);
  if (!(hk > 0.05)) { S.why = 'too high over the snow'; return false; }
  const size = size0 * (0.55 + 0.45 * hk);
  const serial = ++s.serial;
  if (g.snowTracks) { pressCrater(g.snowTracks, x, z, size, serial, K); S.craters++; }
  if (K.dig > 0) { s.digs.push({ x, z, r: size * K.dig, serial, t: 0 }); if (s.digs.length > 16) s.digs.shift(); }
  s.live.push({ x, z, size, hk, t: 0, serial });
  if (s.live.length > 8) s.live.shift();
  airPuff(g, x, z, K.air * hk, size * K.airR, K.airS);
  S.marked++; S.why = 'marked'; S.last = { x, z, size, hk };
  return true;
}
/** once a frame (snowFx.ts, before anything is filed): the live blasts age; one is done at LIVE_S, whatever a pool took of it (the same on a host with none) */
export function stepSnowBlast(g: Game, dt: number) {
  const s = states.get(g); if (!s || !s.live.length) return;
  if (!SNOW_LOOK.blast) { s.live.length = 0; return; }
  for (const b of s.live) b.t += Math.max(0, dt);
  s.live = s.live.filter((b) => b.t < LIVE_S);
}
/** THE THROW: this frame's blast for the grains' step (render/particles.ts grainCfg floats 8‥15 = particles.wgsl grain.c / .d). One blast a frame — with two
 *  alive they take turns. No blast throwing: the rate is 0 and the step's test costs one compare. */
export function snowBlastFeed(g: Game, c: Float32Array) {
  if (c.length < 16) return;
  c[8] = 0; c[9] = 0; c[10] = 0; c[11] = 0; c[12] = 0; c[13] = 0; c[14] = 0; c[15] = 0;
  const s = states.get(g); if (!s || !SNOW_LOOK.blast) return;
  const K = SNOWBLAST; const on = s.live.filter((b) => b.t <= K.throwS);
  if (!on.length) return;
  const B = shownOf(g); const b = on[B.turn++ % on.length];
  c[8] = b.x; c[9] = b.z; c[10] = b.size * K.throwR;
  c[11] = -Math.log(1 - clamp(K.throwShare, 0, 0.98)) / Math.max(0.02, K.throwS) * b.hk * on.length;
  c[12] = K.out * (0.5 + 0.5 * b.hk); c[13] = K.up * (0.5 + 0.5 * b.hk);
  B.throwFrames++;
}
/** THE PUFF: what each live blast still owes of its powder, filed as wisp records as far as the frame's births allow. Returns how many it filed. */
export function snowBlastPuffs(g: Game, Pp: Particles, room: number): number {
  const O = owing(g); if (!O) return 0;
  const K = SNOWBLAST; let filed = 0; const { live, B, owed } = O;
  for (let i = 0; i < owed.length; i++) { const b = live[i], o = owed[i];
    const n = Math.min(o.puffLeft, Math.max(0, room - filed)); if (n <= 0) continue;
    const got = Pp.emit('rain', [b.x, 0.5, b.z], [0, -1, 0], n, { shape: 'rainDisc', radius: Math.max(0.2, b.size * K.puffR), speed: K.puffOut, speedJit: 0.5, life: K.puffLife, lifeJit: 0.35,
      size: K.puffSize, sizeJit: 0.4, lift: 0.45, aspect: 2, color: [0.04, 0.15, 0], top: wispLookByte(), seed: (0x5b1a57 + b.serial * 7919 + o.puffLeft) >>> 0 });
    o.puffLeft -= Math.max(got, 0) || n;   // (a pool that takes none this frame is not asked again: the puff is of the moment)
    filed += Math.max(got, 0);
  }
  B.puffs += filed;
  return filed;
}
/** THE THROW, ONE SNOW IN ONE AIR (snowFx.ts, when there are no grains of their own): what each live blast still owes of its loose snow, filed as FLAKE records
 *  — the flakes' own shape and size, born low over the blast's disc and going up — as far as the frame's births allow. Returns how many it filed. */
export function snowBlastThrow(g: Game, Pp: Particles, room: number, size: number, sizeJit: number): number {
  const O = owing(g); if (!O) return 0;
  const K = SNOWBLAST; let filed = 0; const { live, B, owed } = O;
  for (let i = 0; i < owed.length; i++) { const b = live[i], o = owed[i];
    const n = Math.min(o.flakeLeft, Math.max(0, room - filed)); if (n <= 0) continue;
    const got = Pp.emit('rain', [b.x, 0.45, b.z], [0, 1, 0], n, { shape: 'rainDisc', radius: Math.max(0.2, b.size * K.throwR), speed: K.flakeUp * (0.5 + 0.5 * b.hk), speedJit: 0.7, life: K.flakeLife, lifeJit: 0.3,
      size, sizeJit, lift: 0.4, seed: (0x7f1a4e + b.serial * 104729 + o.flakeLeft) >>> 0 });
    o.flakeLeft -= Math.max(got, 0) || n;   // (a pool that takes none this frame is not asked again: the throw is of the moment)
    filed += Math.max(got, 0);
  }
  B.thrown += filed;
  return filed;
}
