// EACH GUN IS FED ITS OWN WAY (gunlook.ts GUNLOOK: nothing here is read with that switch off, or of a row with no `own`). Until now every reload was a
// magazine change — the support hand to the well ahead of the grip, 'magOut', 'magIn', 'rack', an empty box on the floor — whatever the gun: a belt-fed gun
// swapped a rifle magazine, the tube guns had no hands at all. With the switch on a row's model says how it is fed (FEED below):
//   belt    the Mk 46: the feed cover up, the box off (an empty one falls), a full one out of his pouch and on, the belt laid in the tray, the cover slapped
//           shut, and the cocking handle run if nothing was chambered. Six sounds where three were, the hand at five stations.
//   shells  the M1014 and the big slot's pump gun: ONE AT A TIME — a trip of the support hand per shell from the side of the receiver to the loading port and a
//           'shellIn' for each, as many as the gun gains; the M1014 begun with nothing in it gets its first one straight into the ejection port and the bolt
//           dropped on it. Nothing falls. The pump gun's own rack is the pump: the old 'rack', slowed.
//   mag     the Mk 12, the MP7, the HK45 and the Glock 18: a magazine change as it was, heard as it was — with a magazine of the gun's own size in the hand
//           and on the floor, and the MP7's hand going to the foot of the pistol grip, where its magazine goes in.
// NEVER A PLAY NUMBER: a reload's length is the beat's it was begun on, the stages (out / in / rack) stand where the weapon has them, and the books — which
// rounds end up where — are weapons.ts Firearm's, untouched. Everything here is WHEN something is heard and WHERE a hand is inside that length. (So a tube gun
// takes its row's seconds whether one shell goes in or seven: the trips are spread over the feeding part of it. A length by the shell would be a play number.)
// NO STATE: what is shown is worked out each frame from the beat the animator's support hand is on (CharacterAnimator.feedClock) and what the Firearm said the
// reload puts in (Firearm.feedN / feedPort, written by startReload). The dice are touched once more than before by nobody: a thing that falls is the magazine
// that fell before, drawn as what it is.
// WHO GETS WHAT. You: all of it (player.ts reloadInHand). A teammate: the sounds on his beat wherever his reload has a clock (guards.ts tickReloadBeat, the
// room fight's reloadUntil, gunslots.ts taking his long gun up again), the hand's stations where the movement pass shows his change (game.ts deals his clock),
// always as a gun run dry — a full belt, a full tube, the first shell in the port; and his empty falls only where one fell before (tickReloadBeat).
import type { Game } from './game';
import type { Character, CharacterAnimator } from './character';
import type { Box } from '../scene/boxes';
import type { Vec3 } from '../math/vec';
import type { Firearm, GunModelId, WeaponDef, WeaponId } from './weapons';
import { WEAPONS } from './weapons';   // (read inside functions only: the game's one import cycle)
import { gunOwn, gunLookOn } from './gunlook';   // (the same)
import { magBoxL } from './rigProps';   // (the same)

export type FeedKind = 'mag' | 'belt' | 'shells';
/** a beat as the support hand has it (character.ts rlB): seconds on the weapon's clock; `pull` = nothing was chambered, the handle is run at `rack` */
export interface FeedBeat { dur: number; out: number; in_: number; rack: number; pull: boolean }
/** one sound inside a reload: when, which (audio/sfx.ts), how loud, how fast */
export interface FeedCue { t: number; sfx: string; gain: number; rate: number }
/** one station of the support hand: when its WRIST is there, where — a point in the gun's frame off the trigger wrist (x his left, y up out of the receiver,
 *  z the bore: character.ts MV2.reload's own space), or the pouch the fresh ones come from — how the hand lies (round a thing from its front · flat on top of
 *  the gun · fingers down in a pouch) and how closed it is, 0‥1 */
export interface FeedKey { t: number; at: Vec3 | 'pouch'; how: 'mag' | 'top' | 'pouch'; grip: number }
/** a magazine gun's own marks for the hand (character.ts reloadArm's `K`: MV2.reload.box is the carbine's) */
export interface FeedMarks { mag: Vec3; strip: Vec3; handle: Vec3; pull: Vec3; hf: Vec3; hb: Vec3 }

/** the gun group's origin (the bore above the trigger: rigProps.ts RIG.sc20k.adj / RIG.carbine.adj, the same numbers) off the trigger wrist — what turns a
 *  point of gunlook.ts MODEL_POINTS into the hand's own space */
const GROUP: Vec3 = [0.06, 0.08, 0.09];
const g2w = (p: Vec3, d: Vec3 = [0, 0, 0]): Vec3 => [p[0] + GROUP[0] + d[0], p[1] + GROUP[1] + d[1], p[2] + GROUP[2] + d[2]];
/** HOW EACH MODEL IS FED. `hand`: half extents of what the support hand carries [across, along, deep] and its colour; `drop`: the fill of the 'mag' item that
 *  falls when an EMPTY one leaves the gun (throwables.ts draws 4‥7 as these; null: nothing falls); the stations are WRISTS, worked out from where the thing is
 *  on the model (gunlook.ts MODEL_POINTS, in the group's axes) and how a hand takes it. First numbers: set against the carbine's tuned marks, never seen. */
const FEED: Record<GunModelId, { kind: FeedKind; hand: Vec3; col: Vec3; drop: number | null; marks?: FeedMarks; portFirst?: boolean; pump?: boolean }> = {
  mk12: { kind: 'mag', hand: [0.012, 0.055, 0.03], col: [0.03, 0.03, 0.033], drop: 6 },   // the short twenty-round box, where the carbine's thirty goes: the carbine's marks
  // the MP7's forty goes up the PISTOL GRIP: the hand under the trigger hand, round what stands out of the grip's foot; the cocking handle is the T at the receiver's rear
  mp7: { kind: 'mag', hand: [0.008, 0.095, 0.013], col: [0.03, 0.03, 0.033], drop: 7,
    marks: { mag: g2w([0, -0.135, -0.045], [0.025, -0.15, -0.05]), strip: g2w([0, -0.135, -0.045], [0.03, -0.24, -0.07]), handle: [0.05, 0.09, -0.02], pull: [0.05, 0.09, -0.1], hf: [-0.7, 0.6, 0.1], hb: [0.5, -0.5, 0.6] } },
  mk46: { kind: 'belt', hand: [0.035, 0.045, 0.06], col: [0.16, 0.17, 0.1], drop: 5 },
  m1014: { kind: 'shells', hand: [0.01, 0.035, 0.01], col: [0.5, 0.05, 0.04], drop: null, portFirst: true },
  m870: { kind: 'shells', hand: [0.01, 0.035, 0.01], col: [0.5, 0.05, 0.04], drop: null, pump: true },
  hk45: { kind: 'mag', hand: [0.009, 0.055, 0.018], col: [0.05, 0.05, 0.055], drop: 0 },
  g18: { kind: 'mag', hand: [0.008, 0.11, 0.016], col: [0.05, 0.05, 0.055], drop: 4 },
};
/** the Mk 46's stations (wrists): flat on the feed cover · the cover held up · round the belt box from under its left · clear of the gun with it · laying the
 *  belt across the tray · the cocking handle on the right, reached under the gun, and drawn */
const BELT = { cover: g2w([0, 0.04, 0.07], [0.07, 0.03, -0.03]), lifted: g2w([0, 0.04, 0.07], [0.07, 0.1, -0.08]), box: g2w([0.02, -0.085, 0.06], [0.03, -0.13, -0.04]), strip: g2w([0.02, -0.085, 0.06], [0.04, -0.225, -0.03]),
  tray: g2w([0, 0.04, 0.07], [0.06, 0.01, 0]), handle: [0.04, -0.06, 0.1] as Vec3, pull: [0.04, -0.06, 0.0] as Vec3 };
/** a tube gun's stations (wrists): at the spare shells on the receiver's left · under the loading port · the thumb run home · under the gun at the ejection port */
const TUBE = { saddle: g2w([0.024, 0, 0], [0.08, -0.03, -0.02]), port: g2w([0, -0.047, 0.06], [0.03, -0.11, -0.04]), home: g2w([0, -0.047, 0.06], [0.03, -0.09, -0.015]), eject: g2w([-0.02, 0.005, 0.03], [0.04, -0.15, 0]) };

/** this row is fed its own way right now (the switch on, the row with a model): how — null: a magazine change as it always was */
export function feedOf(def: WeaponDef): (typeof FEED)[GunModelId] | null { const o = gunOwn(def); return o ? FEED[o.model] ?? null : null; }
/** … by the model (the animator's `feed`, which is only ever dealt from feedOf) */
const feedBy = (m: GunModelId) => FEED[m];

/** THE BELT's moments inside a beat: the cover up before the box comes off at the beat's `out`, a full box on between that and the belt laid at its `in_`,
 *  the cover down after it and before the handle (`rack`, a chamber with nothing in it) or the end */
export function beltTimes(B: FeedBeat): { up: number; off: number; pouch: number; on: number; lay: number; down: number; charge: number } {
  const o = B.out, i = B.in_, end = B.pull ? B.rack : B.dur - 0.3;
  const up = Math.max(0.1, o * 0.45), on = o + (i - o) * 0.62, down = i + Math.min(0.5, Math.max(0.12, (end - i) * 0.5));
  return { up, off: o, pouch: o + (on - o) * 0.5, on, lay: i, down, charge: B.pull ? B.rack : -1 };
}
/** THE SHELLS' moments: `n` of them, the last home at the beat's `in_` (where the weapon books them), spread evenly from its `out` */
export function shellTimes(B: FeedBeat, n: number): number[] { const out: number[] = []; for (let k = 0; k < n; k++) out.push(B.out + (k + 1) * (B.in_ - B.out) / n); return out; }
/** (a shell's own pitch: dealt off its place in the tube, never drawn) */
const shellRate = (k: number): number => 0.94 + ((k * 5) % 7) * 0.02;

/** WHAT IS HEARD, in order, of a reload of this row on this beat that puts `n` rounds in (`port`: begun with nothing in the gun) — null: a magazine gun, heard
 *  as it always was (the weapon's own magOut / magIn / rack) */
export function feedCues(def: WeaponDef, B: FeedBeat, n: number, port: boolean): FeedCue[] | null {
  const F = feedOf(def); if (!F || F.kind === 'mag') return null;
  const out: FeedCue[] = [];
  if (F.kind === 'belt') {
    const T = beltTimes(B);
    out.push({ t: T.up, sfx: 'beltCoverUp', gain: 0.8, rate: 1 }, { t: T.off, sfx: 'beltBoxOff', gain: 0.8, rate: 1 }, { t: T.on, sfx: 'beltBoxOn', gain: 0.85, rate: 1 },   // (sounds: beltCoverUp) (sounds: beltBoxOff) (sounds: beltBoxOn)
      { t: T.lay, sfx: 'beltLay', gain: 0.8, rate: 1 }, { t: T.down, sfx: 'beltCoverDown', gain: 0.9, rate: 1 });   // (sounds: beltLay) (sounds: beltCoverDown)
    if (B.pull) out.push({ t: T.charge, sfx: 'chargeLmg', gain: 0.9, rate: 1 });   // (sounds: chargeLmg)
  } else {
    const T = shellTimes(B, n), first = port && !!F.portFirst;
    for (let k = 0; k < n; k++) {
      out.push({ t: T[k], sfx: 'shellIn', gain: first && k === 0 ? 0.6 : 0.8, rate: shellRate(k) });   // (sounds: shellIn)
      if (first && k === 0) out.push({ t: Math.min(T[0] + 0.12, n > 1 ? T[1] - 0.02 : B.in_ + 0.12), sfx: 'boltDrop', gain: 0.9, rate: 1 });   // (sounds: boltDrop) — the first one dropped in the port and the bolt let go on it
    }
    if (B.pull && !first) out.push(F.pump ? { t: B.rack, sfx: 'rack', gain: 0.85, rate: 0.7 } : { t: B.rack, sfx: 'boltDrop', gain: 0.9, rate: 1 });   // (the pump gun's rack is the pump: the old 'rack', slowed; the gas gun's is its bolt run and let go)
  }
  return out.sort((a, b) => a.t - b.t);
}
/** WHERE THE SUPPORT HAND IS over a reload of this model (character.ts reloadArm): its stations in order — or a magazine gun's own marks (`marks` null: the
 *  carbine's, its well ahead of the grip) — or null: the switch is off, the magazine change as ever. Times are kept in order and clear of each other whatever beat it is handed. */
export function feedPath(model: GunModelId, B: FeedBeat, n: number, port: boolean): { keys: FeedKey[] } | { marks: FeedMarks | null } | null {
  const F = gunLookOn() ? feedBy(model) : null; if (!F) return null;   // (a model dealt before the switch went down mid-run: the carbine's change, as ever)
  if (F.kind === 'mag') return { marks: F.marks ?? null };   // (null: a well ahead of the grip — the carbine's marks, whatever the issue rifle's are)
  const K: FeedKey[] = [], put = (t: number, at: Vec3 | 'pouch', how: FeedKey['how'], grip: number) => { K.push({ t, at, how, grip }); };
  if (F.kind === 'belt') {
    const T = beltTimes(B), S = BELT;
    put(T.up - 0.08, S.cover, 'top', 0.3); put(T.up + 0.14, S.lifted, 'top', 0.5);
    put(T.off - 0.12, S.box, 'mag', 0.3); put(T.off, S.box, 'mag', 1); put(T.off + 0.14, S.strip, 'mag', 1);
    put(T.pouch - 0.08, 'pouch', 'pouch', 0.2); put(T.pouch + 0.08, 'pouch', 'pouch', 1);
    put(T.on - 0.14, S.strip, 'mag', 1); put(T.on, S.box, 'mag', 1); put(T.on + 0.1, S.box, 'mag', 0.3);
    put(T.lay - 0.1, S.tray, 'top', 0.6); put(T.lay + 0.06, S.tray, 'top', 0.3);
    put(T.down - 0.14, S.lifted, 'top', 0.4); put(T.down, S.cover, 'top', 0.2); put(T.down + 0.06, S.cover, 'top', 0.2);
    if (B.pull) { put(T.charge - 0.1, S.handle, 'mag', 0.9); put(T.charge, S.handle, 'mag', 1); put(T.charge + 0.08, S.pull, 'mag', 1); put(T.charge + 0.17, S.handle, 'mag', 0.4); }
  } else {
    const T = shellTimes(B, n), per = n > 0 ? (B.in_ - B.out) / n : 0, S = TUBE, first = port && !!F.portFirst;
    for (let k = 0; k < n; k++) {
      const half = Math.min(per * 0.5, 0.3), to = first && k === 0 ? S.eject : S.port, home = first && k === 0 ? S.eject : S.home;
      put(T[k] - half - Math.min(0.06, per * 0.12), S.saddle, 'mag', 0.4); put(T[k] - half, S.saddle, 'mag', 0.9);   // (a shell plucked off the receiver's side)
      put(T[k] - Math.min(0.07, per * 0.2), to, 'mag', 0.9); put(T[k], home, 'mag', 0.7);                            // (to the port, and the thumb run home)
    }
    if (B.pull && !first && !F.pump) { put(B.rack - 0.12, S.eject, 'mag', 0.6); put(B.rack, S.eject, 'mag', 0.9); }   // (shells in under a chamber with nothing in it: the bolt handle run, on the right, reached under the gun. The pump gun's is the pump, where the hand comes back to)
  }
  // (in order, a frame apart at the least, and done before the hand's own way back to the gun)
  let last = 0.06; for (const k of K) { k.t = Math.min(Math.max(k.t, last + 0.02), B.dur - 0.1); last = k.t; }
  return { keys: K.filter((k, i) => i === 0 || k.t > K[i - 1].t + 1e-6) };
}

/** DEALT to a man's animator — you: every frame, beside `reloadMag` (player.ts armRifle); a teammate, a defender: as his reload begins and on every tick of its
 *  clock (guards.ts, roomfight.ts, gunslots.ts) — the long gun in his hands, or null (a pistol, nothing): how the support hand is to feed it. `dry`: a man whose reload is a beat and not a Firearm's books (a teammate, a defender): the gun ran dry, so all of it goes in. */
export function feedDeal(an: CharacterAnimator, gun: Firearm | null, dry = false) {
  const o = gun ? gunOwn(gun.def) : null, F = o ? FEED[o.model] : null;
  if (!gun || !o || !F) { an.feed = null; return; }
  an.feed = o.model; an.feedN = dry ? gun.def.magCapacity : gun.feedN; an.feedPort = dry ? true : gun.feedPort;
}
/** the switch is up (character.ts mvArms: a tube gun had no hands in its reload — `reloadMag` false — and with a model dealt it has a trip a shell) */
export const feedLive = (): boolean => gunLookOn();

// ------------------------------------------------------------------ the player: reloadInHand's plan
/** What your reload of `gun` on `row` (the beat it is about to begin on) is to sound like and to drop — asked BEFORE Firearm.startReload, off the gun as it
 *  stands. null: the switch off or a row with nothing of its own. `cues` null: a magazine gun (its three sounds are the weapon's own, as ever). */
export function feedPlan(gun: Firearm, row: WeaponDef['reload']): { cues: FeedCue[] | null; times: number[]; drop: number | null } | null {
  const F = feedOf(gun.def); if (!F) return null;
  // (what startReload is about to book — the same sums: the fullest spare, as much of it as the gun may hold, less what is in it)
  const best = Math.min(gun.spare.length ? Math.max(...gun.spare) : gun.def.magCapacity, gun.magRoom), n = Math.max(0, best - (gun.mag ?? 0)), port = gun.chamber === 0 && !gun.mag;
  const cues = feedCues(gun.def, beatOf(row, gun.chamber === 0), n, port);
  return { cues, times: cues ? cues.map(c => c.t) : [], drop: F.drop };
}
/** a weapon's reload row as a beat (a row that gives only its length does everything at the end: the weapon's own rule) */
export const beatOf = (R: WeaponDef['reload'], pull: boolean): FeedBeat => ({ dur: R.dur, out: R.out ?? R.dur, in_: R.in_ ?? R.dur, rack: R.rack ?? R.dur, pull });
/** one of them, played at him */
export function feedPlay(g: Game, at: Vec3, c: FeedCue, vol = 1) { g.audio.play(c.sfx, at, c.gain * vol, { rate: c.rate }); }

// ------------------------------------------------------------------ a teammate, a defender: the sounds on his beat
/** His reload's clock went from `before` to `now` seconds into his row's beat (guards.ts tickReloadBeat, the room fight's reloadUntil, gunslots.ts taking the
 *  long gun up again): the sounds of his gun's own feeding that fall between are played at him. Nothing for a magazine gun or with the switch off. */
export function feedTick(g: Game, c: Character, def: WeaponDef, before: number, now: number, vol = 0.7) {
  const F = feedOf(def); if (!F || F.kind === 'mag' || !(now > before)) return;
  const cues = feedCues(def, beatOf(def.reload, true), def.magCapacity, true); if (!cues) return;
  for (const q of cues) if (q.t > before && q.t <= now) feedPlay(g, c.pos, q, vol);
}
/** …and what falls out of it when his beat crosses `out` (guards.ts tickReloadBeat's 'mag' item): the fill it is drawn by — null: nothing falls (a tube gun);
 *  undefined: the row has nothing of its own, the box that always fell */
export function feedDrop(def: WeaponDef): number | null | undefined { const F = feedOf(def); return F ? F.drop : undefined; }
/** his reload begins (guards.ts startReloadBeat's clack): true — this gun's first sound is its own, on its beat, and nothing is played here */
export function feedStarts(def: WeaponDef): boolean { const F = feedOf(def); return !!F && F.kind !== 'mag'; }

// ------------------------------------------------------------------ the drawer's half (rigProps.ts asks both of a man with a model in his hands)
/** (the row's feeding, for the gun that is IN HIS HANDS: a long gun's row asked of a man with his pistol up — the one on his back — shows nothing) */
const ownOf = (c: Character, id: WeaponId) => { const d = WEAPONS[id]; return d && (d.cls === 'pistol') !== c.anim.longGun ? feedOf(d) : null; };
/** WHAT THE DRAWER SHOWS of a reload under way on this man's gun of row `id`: `noMag` — its magazine / belt box is off the gun this frame; `cover` — the
 *  Mk 46's feed cover lifted, 0‥1. null: no change is being shown on him, the switch is off, or the row has nothing of its own. */
export function reloadShow(c: Character, id: WeaponId): { noMag: boolean; cover: number } | null {
  const F = ownOf(c, id); if (!F) return null;
  const B = c.anim.feedClock; if (!B) return null;
  const t = B.t;
  if (F.kind === 'belt') { const T = beltTimes(B); return { noMag: t >= T.off && t < T.on, cover: Math.min(sstep(T.up, T.up + 0.18, t), 1 - sstep(T.down - 0.12, T.down, t)) }; }
  if (F.kind === 'shells') return { noMag: false, cover: 0 };
  return { noMag: t >= B.out && t < B.in_, cover: 0 };
}
const sstep = (a: number, b: number, x: number): number => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
/** THE THING IN HIS SUPPORT HAND this frame — a magazine of the row's own size (the kept one on its way to the pouch, the fresh one on its way to the gun), a
 *  full belt box on its way from the pouch, a shell between the receiver's side and the port — as one box in the fist, appended to `out`. Nothing with the
 *  switch off, no change shown, or the hand empty this frame. */
export function reloadHandBoxes(c: Character, id: WeaponId, out: Box[]): void {
  const F = ownOf(c, id); if (!F) return;
  const B = c.anim.feedClock; if (!B) return;
  const t = B.t; let held = false;
  if (F.kind === 'belt') { const T = beltTimes(B); held = t >= T.pouch + 0.04 && t < T.on; }
  else if (F.kind === 'shells') {
    const n = c.anim.feedN, T = shellTimes(B, n), per = n > 0 ? (B.in_ - B.out) / n : 0, half = Math.min(per * 0.5, 0.3);
    for (let k = 0; k < n && !held; k++) held = t >= T[k] - half && t < T[k];
  } else held = (B.keep >= 0 && t >= B.out && t < B.keep) || (t >= B.fresh + 0.04 && t < B.in_);
  if (held) magBoxL(c, out, F.hand[1] > 0.07 ? 'rifle' : 'pistol', true, F.hand, F.col);
}
