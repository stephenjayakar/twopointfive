// ROUNDS THROUGH THIN WALLS AND DOORS — what a partition, a low screen and a wooden door leaf are to a ROUND (the maintainer, 10-16: "a rifle round carries on
// through drywall, partitions and wooden doors with the energy it has left, as it already does through glass"). Until this a round stopped dead in the first built
// thing it met (combat.ts fireWeapon → col.raycast), a sheet of plasterboard as surely as a concrete wall — and the only way through a partition was the wall
// engine's count (wallbreak.ts: the sixth rifle round into one half-metre cell knocks it out), the nearest thing in the game to hit points. Behind ONE switch,
// `WALLPEN.on` (OFF here and on the frozen stand, `TPS_WALLPEN=1` raises it there; ON in the page — src/host/profile.ts pageSwitches — `?wallpen=0` = rounds stop
// in walls and doors as they did; Tab ▸ Renderer fx ▸ Glass has the row): off — or a showcase running (Game.touring: their choreography was laid with rounds
// stopping in walls) — = every entry point answers on its first line and the game is the base's, digest for digest.
//
//   THE RULE (one for Sam, the squad and the defenders — fireWeapon asks nobody whose round it is):
//   • a round carries the ENERGY the glass rule gave it (glasspen.ts roundEnergy: 1 = a rifle round at the muzzle, 9 mm 0.5, one pellet of buck 0.3);
//   • a THIN THING is an upright sheet of a stuff a round goes through, no thicker across than that stuff's `thinMax`: plasterboard (the wall paints) to 17 cm,
//     and only with ceiling over BOTH its faces — the wall engine's own test for a partition (wallbreak.ts index), asked of a sill or a header as of a wall —
//     so a building's shell is structure whatever its paint; wood to 12 cm, a fabric screen to 13 cm, cardboard, a plant; and a DOOR
//     LEAF that is not steel and still hangs. Concrete, stone, steel, glass that is no sheet, anything that lights, anything tilted, a leaf off its hinges: the
//     round stops in it, as ever;
//   • it takes   toll = base[stuff] + perM[stuff] × (metres of the round's path inside the box)   — its skins, and what is between them by the length actually
//     crossed, so a slant pays more with no rule of its own — and a path longer than `maxThru[stuff]` is a round running along inside the sheet: spent in it;
//   • what is left < minEnergy, or the (maxThings + 1)th thing: spent in it — exactly the old stop (the mark, the chips, the wall engine's count, nothing beyond);
//   • otherwise it goes ON from the far face, turned inside a cone of half-angle deflectDeg × (toll ∕ energy in), its bearing HASHED off where it went in
//     (glass.ts hitSeed: the same shot bends the same way; never Math.random);
//   • every thing crossed gets, where the round went in AND where it came out, what a round that stops there gets: the mark, the chips and dust, and — where it
//     went in — the destruction lane's call (destruction.ts round: the heat, the wall engine's count — a partition still opens under sustained fire, it just no
//     longer has to before a round gets through).
//   So a rifle round goes through four or five partitions square-on and three doors; a 9 mm through two partitions or one door; a pellet through one partition
//   and no door (the lock rule, shotgun.ts, still reads every pellet that MET a leaf — one that goes through is booked on it where it went in).
//   A round that is through is a round: one-shot both ways as ever (no hit points anywhere — what the wall took decides only whether it gets through the NEXT
//   thing, and how hard it shoves the furniture it meets: propImpulse × what is left).
//
//   WITH GLASS: one flight (thinPath below) over panes and thin things in whatever order they stand — a pane pays glasspen.ts's toll while that rule is live and
//   stops the round while it is not, exactly as before; this module adds no state (nothing is remembered between rounds: no hole makes the next one cheaper), so
//   nothing rides in a checkpoint, and the switch rides in session journals (journal.ts knobTables; a recording from before the table replays with it off).
//
//   THE MEN ACT ON IT (`WALLPEN.men`, a row of the same rule): a man who KNOWS an enemy is behind a thin thing — his own sighting, a few seconds old at most —
//   asks `thinLine` whether his gun's round gets to the place and, if it does, puts a short burst through (coverfire.ts ask: both sides, the fight AI and a
//   teammate under an order; a wooden leaf too, which cover fire alone refuses; never on a mate's word, never with a friend in the lane or past it as far as
//   the round would fly); and a man picking cover from a gun takes a place a rifle round does not reach before one that is only hidden (suppression.ts
//   coverFrom). NOT here: the line of fire a man asks about an enemy he SEES (StaticCollision.shotBlocked) still ends at a partition and a shut door — only
//   cover fire's eyes-on hook fires through for him; where a team stacks at a door; firing at a sound.
//
//   TWO FLIGHTS, ON PURPOSE: with this rule off the round flies glasspen.ts roundPath, untouched — the frozen stand's digests are that code's. `thinPath` is
//   the same loop with thin things added; over glass alone the two answer alike (the check sweeps it), and a mend to one is a mend to the other.
import { Vec3, v3, clamp } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import { lineBox } from '../scene/collision';
import { cutConfig } from '../scene/cut';
import { WORLD } from '../scene/world';
import { isSheet, hitSeed } from './glass';
import { GLASSPEN, glassPenLive, paneCrossing, type PaneCross, type RoundPath, type RoundSeg } from './glasspen';
import { paletteName, surfOf, impactFx } from './particleFx';
import { bulletMark, staticSurface } from './marks';
import { pelletEnd, type Shell } from './shotgun';
import { WALLS } from './wallbreak';
import type { Game } from './game';
import type { Character } from './character';
import type { WeaponDef } from './weapons';

/** the stuffs a round goes through */
export type ThinStuff = 'drywall' | 'wood' | 'fabric' | 'cardboard' | 'foliage';
/** the numbers (constants until somebody has played it) */
export const WALLPEN = {
  on: false,
  /** energy a thing takes from a round crossing it: its skins … */
  base: { drywall: 0.1, wood: 0, fabric: 0.03, cardboard: 0.02, foliage: 0 } as Record<ThinStuff, number>,
  /** … + this per metre of the round's path inside the box (plasterboard is two sheets and air; a leaf is wood right through: 5 cm square-on takes 0.225) */
  perM: { drywall: 0.5, wood: 4.5, fabric: 1, cardboard: 1, foliage: 0.3 } as Record<ThinStuff, number>,
  /** m: how thick across (its thin level axis) an upright thing of each stuff may be and still be a thin thing — plasterboard's is the wall engine's own */
  thinMax: { drywall: 0.17, wood: 0.12, fabric: 0.13, cardboard: 0.7, foliage: 2 } as Record<ThinStuff, number>,
  /** m: the longest path through one a round survives (longer: it is running along inside the sheet, and is spent in it) */
  maxThru: { drywall: 0.4, wood: 0.14, fabric: 0.3, cardboard: 0.8, foliage: 2.5 } as Record<ThinStuff, number>,
  /** under this much left on the far side the round is spent in the thing; things one round can cross */
  minEnergy: 0.12, maxThings: 5,
  /** the scatter cone's half-angle in degrees at toll = all the round had (× toll ∕ energy in) */
  deflectDeg: 4,
  /** THE MEN ACT ON IT (a row of the one rule, nothing by itself: it is read only while `on` is up — false = rounds go through and nobody reckons with
   *  it, the arm a measurement is read against): a man who KNOWS an enemy is behind a thin thing fires through it (coverfire.ts ask), and a man picking
   *  cover from a gun takes a place a rifle round does not reach before one it does (suppression.ts coverFrom) */
  men: true,
  /** m from the first face crossed to the place he knows, beyond which the man is not 'behind it' · rounds he puts through on one sighting · s before the same
   *  thing is his to fire through again */
  behindM: 4, thruRounds: 4, thruRestSecs: 6,
};
/** whoever wants every crossing (a probe; whatever throws more off the far face): called once per thin thing a round goes THROUGH, after its marks */
export const WALLPEN_HOOKS: { crossed: ((g: Game, x: WallCross, who: number) => void) | null } = { crossed: null };
/** rounds: things crossed · of them door leaves · rounds spent in a thin thing · the men: lines asked · answered 'through' · places passed over for harder cover */
export const WALLPEN_STATS = { crossed: 0, leaves: 0, spent: 0, asked: 0, through: 0, harder: 0 };
const LOG: string[] = [];

/** the one gate: the switch, and no showcase running (the tour / the breach were choreographed with rounds stopping in walls and doors) */
export function wallPenLive(g: Game): boolean { return WALLPEN.on && !g.touring; }

// ---------------------------------------------------------------- what a box is to a round
/** the thin level axis of a box in the world (unit; sign arbitrary) */
function thinN(b: Box): Vec3 { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); return b.h[0] < b.h[2] ? [cs, 0, -sn] : [sn, 0, cs]; }
/** the face of `b` the point `p` lies on (unit, outward): the axis it is farthest out along, in the box's own frame */
function faceN(b: Box, p: Vec3): Vec3 {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), dx = p[0] - b.c[0], dy = p[1] - b.c[1], dz = p[2] - b.c[2];
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; const ax = Math.abs(lx) / b.h[0], ay = Math.abs(dy) / b.h[1], az = Math.abs(lz) / b.h[2];
  if (ay >= ax && ay >= az) return [0, Math.sign(dy) || 1, 0];
  return ax >= az ? [cs * (Math.sign(lx) || 1), 0, -sn * (Math.sign(lx) || 1)] : [sn * (Math.sign(lz) || 1), 0, cs * (Math.sign(lz) || 1)];
}
/** ceiling over the point (the lights' interior cells — game.ts reachInterior; none built: everywhere, as the wall engine reads it) */
function roofed(g: Game, x: number, z: number): boolean {
  const I = g.reachInterior; if (!I) return true;
  const cx = Math.floor(x - WORLD.min[0]), cz = Math.floor(z - WORLD.min[2]);
  return cx >= 0 && cz >= 0 && cx < WORLD.gridW && cz < WORLD.gridH && I[cz * WORLD.gridW + cx] === 1;
}
/** The stuff of static `index` if a round goes through such a thing at all, else null — by its paint and where it stands. ASKED AFRESH EVERY TIME (nothing is
 *  kept per box: what a lamp, a cut or a knob changes is read as it stands, and a replay with nothing warm answers as the recording did). How THICK it is is
 *  thinToll's. The wall engine's own exclusions (wallbreak.ts index): no sheet of glass, nothing that is only a picture, nothing tilted, lit or metal, no
 *  fixture, no destruction item, nothing off the world; PLASTERBOARD — the wall paints, at any height: a sill or a header as much as a wall — only with
 *  ceiling over both its faces at most of three places along it, so a building's shell is structure whatever its paint. */
function stuffOf(g: Game, index: number, b: Box): ThinStuff | null {
  if (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary | BoxFlag.NoShadow | BoxFlag.Dynamic) || b.rot || b.metal || b.emissive[0] + b.emissive[1] + b.emissive[2] > 0) return null;
  if (b.c[0] < WORLD.min[0] || b.c[0] > WORLD.max[0] || b.c[2] < WORLD.min[2] || b.c[2] > WORLD.max[2] || g.destr.itemOf(index)) return null;
  for (const t of g.targets) if (t.boxes.includes(index)) return null;
  const surf = surfOf(b.albedo);
  if (surf === 'wood' || surf === 'cardboard' || surf === 'fabric' || surf === 'foliage') return surf;
  if (surf !== 'drywall') return null;
  const name = paletteName(b.albedo); if (!name) return null;   // (a pale paint of no name: nobody's plasterboard — the wall engine indexes none either)
  const part = name === 'partRed' || name === 'partBlue' || name === 'partTan'; const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1], full = y0 <= 0.1 && y1 >= WALLS.wallMinTop;
  if (full && name !== 'wall' && !part) return null;
  if (!full && part && Math.min(b.h[0], b.h[2]) * 2 <= WALLPEN.thinMax.fabric) return 'fabric';   // (a low screen in the partition paints is the cubicle's fabric: wallbreak.ts, destruction.ts)
  const n = thinN(b), L = Math.max(b.h[0], b.h[2]); const ax: Vec3 = [-n[2], 0, n[0]]; let in2 = 0;
  for (const u of [-0.6, 0, 0.6]) { const px = b.c[0] + ax[0] * u * L, pz = b.c[2] + ax[2] * u * L; if (roofed(g, px + n[0] * 0.6, pz + n[2] * 0.6) && roofed(g, px - n[0] * 0.6, pz - n[2] * 0.6)) in2++; }
  return in2 * 2 > 3 ? 'drywall' : null;
}
/** the box behind an index a raycast reports (≥ 1e6: a door leaf), and its stuff: a hung wooden leaf is wood, a static by stuffOf, anything else null */
function thingAt(g: Game, index: number): { b: Box; stuff: ThinStuff } | null {
  if (index >= 1e6) { const b = g.col.dynamicBoxes[index - 1e6]; return b && !b.metal && !b.rot && (b.name ?? '').startsWith('door_') ? { b, stuff: 'wood' } : null; }
  const b = g.col.boxes[index]; if (!b) return null; const stuff = stuffOf(g, index, b); return stuff ? { b, stuff } : null;
}
/** QA / the panel: what static (or leaf) `index` is to a round — its stuff and how thick it stands, or null: a round stops in it */
export function thinThing(g: Game, index: number): { stuff: ThinStuff; thick: number } | null {
  const T = thingAt(g, index); if (!T) return null; const thick = Math.min(T.b.h[0], T.b.h[2]) * 2;
  return thick <= WALLPEN.thinMax[T.stuff] ? { stuff: T.stuff, thick } : null;
}

// ---------------------------------------------------------------- the toll
export interface ThinToll { stuff: ThinStuff; take: number; eOut: number; /** metres of the round's path inside the box */ thru: number }
/** What thing `index` takes from a round of energy `e` meeting it at `at` flying `d` (unit) — or null: the round is spent in it (not a thin thing, too long a
 *  path through, too little left). Pure: fireWeapon's path and the line-of-fire question read this one function. */
export function thinToll(g: Game, index: number, at: Vec3, d: Vec3, e: number): ThinToll | null {
  const T = thingAt(g, index); if (!T) return null; const b = T.b;
  if (Math.min(b.h[0], b.h[2]) * 2 > WALLPEN.thinMax[T.stuff] || (b.cut !== undefined && cutConfig.on && b.cut.length > 0)) return null;
  const s = lineBox(at, d, b); if (!s || s.t1 <= 0) return null;
  const thru = s.t1; if (thru > WALLPEN.maxThru[T.stuff]) return null;
  const take = WALLPEN.base[T.stuff] + WALLPEN.perM[T.stuff] * thru, eOut = e - take; if (eOut < WALLPEN.minEnergy) return null;
  // NOTHING ELSE STANDS IN THE SPAN (a ray from inside the box sees every other one): the post a leaf closes on, a planter under its plant, a cabinet set into
  // the wall — the round is spent here, as it always was. What stands flush against the far face is the next leg's (bornIn).
  if (thru > 4e-4) { const in0 = v3.mad(at, d, 2e-4); if (bornIn(g, in0, d, index) >= 0) return null; const inner = g.col.raycast(in0, d, thru - 4e-4); if (inner && inner.index !== index) return null; }   // (…one it is already inside where it goes in — two walls sharing a corner — or one it meets on the way through)
  return { stuff: T.stuff, take, eOut, thru };
}

/** one thin thing a round went through */
export interface WallCross extends ThinToll {
  /** the static's index, or a leaf's (≥ 1e6) */
  index: number;
  /** metres along the round's path (from the muzzle) to where it went in */
  t: number;
  /** where it went in and the face it met (unit, toward the shooter), where it came out, the direction in and out (unit), energy in */
  at: Vec3; nIn: Vec3; exit: Vec3; dirIn: Vec3; dirOut: Vec3; eIn: number;
  /** the face it came out by (unit, outward): the far face square-on, an end or the top for a round that ran out of the sheet's edge */
  nOut: Vec3;
  /** what the round is INSIDE as it leaves this one (something flush against its far face: a static's index, a leaf's), or −1 */
  into: number;
}
/** the next leg is born this far past the face the round left by: clear of the sheet, and deep enough in anything standing flush against it to be found */
const EXIT_EPS = 1e-3;
const embedScratch = new Int32Array(64);
/** What a round leaving a thing at `p` along `d` is born INSIDE (a ray cast from there would never see that box — rayBox answers null from inside): −1 = open
 *  air, else the index of the static or the leaf (≥ 1e6) — a cabinet flush against the wall's far face, the frame a leaf closes on, a leaf swung flat to a wall. */
function bornIn(g: Game, p: Vec3, d: Vec3, self: number): number {
  const n = g.col.gather(p[0] - 0.02, p[2] - 0.02, p[0] + 0.02, p[2] + 0.02, p[1] - 0.02, p[1] + 0.02, embedScratch);
  for (let i = 0; i < n; i++) {
    const bi = embedScratch[i]; if (bi === self) continue; const b: Box = g.col.boxes[bi]; if (b.flags & BoxFlag.NoShadow) continue;
    const s = lineBox(p, d, b); if (!s || s.depth < 0 || s.t1 <= 0) continue;
    if ((b.flags & BoxFlag.Glass) && g.col.glassOpen && g.col.glassOpen(bi, p)) continue;
    return bi;
  }
  const dyn = g.col.dynamicBoxes;
  for (let i = 0; i < dyn.length; i++) { if (1e6 + i === self) continue; const s = lineBox(p, d, dyn[i]); if (s && s.depth >= 0 && s.t1 > 0) return 1e6 + i; }
  return -1;
}
/** the turn: a hashed scatter inside the cone the toll opens — unit vector out */
function deflect(index: number, at: Vec3, d: Vec3, take: number, eIn: number): Vec3 {
  const A = WALLPEN.deflectDeg * Math.PI / 180 * clamp(take / Math.max(eIn, 1e-6), 0, 1); if (A < 1e-6) return d;
  let s = hitSeed(index % 1e6, at); s = (Math.imul(s ^ (s >>> 15), 0x2C1B3C6D) + 0x297A2D39) >>> 0;
  const u1 = (s & 0xffff) / 65535, u2 = (s >>> 16) / 65535;
  const up: Vec3 = Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]; const e1 = v3.normalize(v3.cross(up, d)), e2 = v3.cross(d, e1);
  const r = Math.tan(A * Math.sqrt(u1)), phi = u2 * Math.PI * 2;
  return v3.normalize([d[0] + (e1[0] * Math.cos(phi) + e2[0] * Math.sin(phi)) * r, d[1] + (e1[1] * Math.cos(phi) + e2[1] * Math.sin(phi)) * r, d[2] + (e1[2] * Math.cos(phi) + e2[2] * Math.sin(phi)) * r]);
}
function crossing(g: Game, index: number, o: Vec3, d: Vec3, t: number, n: Vec3, e: number): WallCross | null {
  const at = v3.mad(o, d, t); const T = thinToll(g, index, at, d, e); if (!T) return null;
  const exit = v3.mad(at, d, T.thru + EXIT_EPS); const b = index >= 1e6 ? g.col.dynamicBoxes[index - 1e6] : g.col.boxes[index];
  return { ...T, index, t, at, nIn: t > 0 ? n : faceN(b, at), nOut: faceN(b, v3.mad(at, d, T.thru)), exit, dirIn: d, dirOut: deflect(index, at, d, T.take, e), eIn: e, into: bornIn(g, exit, d, index) };   // (t = 0: met where the round was born inside it — no ray gave a face)
}

// ---------------------------------------------------------------- the round's flight
/** a round's flight over panes AND thin things: glasspen.ts's RoundPath (legs, the panes crossed, where it stopped) + the thin things crossed */
export interface ThinPath extends RoundPath { walls: WallCross[] }
type StaticHit = { t: number; index: number; n: Vec3 } | null;
/** The flight of a round of energy `energy` from `from` along `dir` (unit) for at most `range` metres over statics and leaves: every pane (while the glass rule
 *  is live) and every thin thing it goes through, and the legs between them. Null = it crosses nothing (it stops in the first thing it meets, or flies clear) —
 *  the caller's old straight line stands, untouched. `first` = the caller's own col.raycast(from, dir, range) if it has one; `nth0` = panes its arm is already
 *  through (glasspen.ts armThroughGlass). PURE: nothing is filed until commitWalls / commitCrossings — a body on the near side stops the round before the wall
 *  ever hears of it. */
export function thinPath(g: Game, from: Vec3, dir: Vec3, range: number, energy: number, first?: StaticHit, nth0 = 0): ThinPath | null {
  let hit: StaticHit = first === undefined ? g.col.raycast(from, dir, range) : first; if (!hit) return null;
  const glass = glassPenLive(g); let segs: RoundSeg[] | null = null; const cross: PaneCross[] = [], walls: WallCross[] = [];
  let o = from, d = dir, t0 = 0, e = energy;
  for (;;) {
    if (!hit) { segs!.push({ o, d, t0, len: range - t0, e }); return { segs: segs!, cross, walls, st: null, len: range }; }
    let x: PaneCross | null = null, w: WallCross | null = null;
    if (hit.index < 1e6 && isSheet(g.col.boxes[hit.index])) { if (glass) x = paneCrossing(g, hit.index, o, d, hit.t, e, nth0 + cross.length); }
    else if (walls.length < WALLPEN.maxThings) w = crossing(g, hit.index, o, d, hit.t, hit.n, e);
    if (!x && !w) {
      if (!segs) return null;   // (the common round: it stops in the first thing it meets — not one allocation more than before)
      segs.push({ o, d, t0, len: hit.t, e }); return { segs, cross, walls, st: { t: t0 + hit.t, index: hit.index, n: hit.n }, len: t0 + hit.t };
    }
    (segs ??= []).push({ o, d, t0, len: hit.t, e });
    let into: number;
    if (x) { x.t = t0 + hit.t; cross.push(x); t0 = x.t + x.thru; o = x.exit; d = x.dirOut; e = x.eOut; into = x.into; }
    else { w!.t = t0 + hit.t; walls.push(w!); t0 = w!.t + w!.thru + EXIT_EPS; o = w!.exit; d = w!.dirOut; e = w!.eOut; into = w!.into; }
    if (t0 >= range) return { segs, cross, walls, st: null, len: range };
    hit = into >= 0 ? { t: 0, index: into, n: v3.scale(d, -1) } : g.col.raycast(o, d, range - t0);   // (born inside what stands flush against the far face — a ray from there would not see it: it is met where the round stands)
  }
}

/** The round got as far as `tHit` metres of path: every thin thing it crossed before that is filed — where it went in and where it came out, the mark and the
 *  chips a round that stops there leaves; where it went in, the destruction lane's call (the wall engine's count) — and a pellet's leaf for the lock rule.
 *  `lead` / `third`: fireWeapon's own (a shell's later pellets are quiet, and every third is the one that heats the room). */
export function commitWalls(g: Game, walls: WallCross[], tHit: number, shooter: Character, def: WeaponDef, lead: boolean, third: boolean, pel: Shell | null) {
  for (const x of walls) {
    if (x.t > tHit + 1e-6) break;   // (a man, a prop on the near side: the round never reached this thing)
    WALLPEN_STATS.crossed++; if (x.index >= 1e6) WALLPEN_STATS.leaves++;
    const s = staticSurface(g, x.index), nOut = x.nOut, out = v3.mad(x.at, x.dirIn, x.thru);
    bulletMark(g, out, nOut, s, def); bulletMark(g, x.at, x.nIn, s, def);   // (the far face first: where the wall engine counts the round, its wear look — wallwear.ts — takes the round's NEWEST mark at the place it went in, and the ring's count stays the same with that look on or off)
    impactFx(g, x.at, x.dirIn, { n: x.nIn, index: x.index }, def);
    impactFx(g, out, v3.scale(x.dirOut, -1), { n: nOut, index: x.index }, def);   // (what it knocks off the far face goes on into the room it flies into)
    if (lead) g.audio.play('bulletImpact', x.at, 0.6);
    if (pel && x.index >= 1e6) pelletEnd(pel, x.index, x.t, x.at);   // (shotgun.ts, the lock: a pellet through the leaf by its keep is a pellet into it)
    if (third) g.destr.round(shooter, x.at, x.dirIn, { n: x.nIn, index: x.index }, def);
    WALLPEN_HOOKS.crossed?.(g, x, shooter.id);
    LOG.push(`${g.time.toFixed(1)}s ${x.index >= 1e6 ? 'leaf' : 'static'} ${x.index % 1e6} (${x.stuff}, ${(x.thru * 100).toFixed(0)} cm of path) crossed: energy ${x.eIn.toFixed(2)} → ${x.eOut.toFixed(2)} (who ${shooter.id})`); if (LOG.length > 24) LOG.shift();
  }
}
// ---------------------------------------------------------------- the men (WALLPEN.men)
/** the men's gate: the rule live and their row up */
export function wallMenLive(g: Game): boolean { return WALLPEN.men && wallPenLive(g); }
/** what a line of fire through thin things is: every thing crossed, in order, panes on the way, the energy the round still has at the place */
export interface ThinLine { walls: WallCross[]; panes: number; e: number }
/** THE LINE OF FIRE THROUGH THIN THINGS: would a round of `energy` leaving `from` for `to` get there — 'clear' = nothing stands in it · a ThinLine = it gets
 *  there through at least one thin thing (and whatever panes) · null = it is stopped, or only glass stands in it (the glass rule's own question), or the rule
 *  is not live. The flight asked is the round's own (thinPath): the answer is yes exactly when the round fired down that line arrives. `short`: metres short
 *  of `to` the line ends (a man's own depth). Reads only. */
export function thinLine(g: Game, from: Vec3, to: Vec3, energy: number, short = 0.3, first?: { t: number; index: number; n: Vec3 } | null): ThinLine | 'clear' | null {
  if (!wallPenLive(g)) return null;
  const d = v3.sub(to, from), L = v3.len(d), reach = L - short; if (reach <= 1e-3) return 'clear';
  const dir = v3.scale(d, 1 / L); const hit = first === undefined ? g.col.raycast(from, dir, reach) : first; if (!hit) return 'clear';
  WALLPEN_STATS.asked++;
  const P = thinPath(g, from, dir, reach, energy, hit); if (!P || P.st || !P.walls.length) return null;
  WALLPEN_STATS.through++;
  return { walls: P.walls, panes: P.cross.length, e: P.segs[P.segs.length - 1].e };
}
/** the hardest round any gun in the game fires (a place judged as cover is judged against that: nobody picking it knows which gun will be laid on it) */
export function topEnergy(): number { return Math.max(GLASSPEN.defaultEnergy, ...Object.values(GLASSPEN.energy), ...Object.values(GLASSPEN.byClass)); }
/** how far a round of `energy` flies from `from` along `dir` (unit), `range` at most: to the first thing that STOPS it (the rule not live: the first thing) */
export function flightLen(g: Game, from: Vec3, dir: Vec3, range: number, energy: number): number {
  const first = g.col.raycast(from, dir, range); if (!first) return range;
  if (!wallPenLive(g)) return first.t;
  const P = thinPath(g, from, dir, range, energy, first); return P ? P.len : first.t;
}

/** fireWeapon: the round STOPPED in something a weaker or shallower round would have gone through (counted for the panel and the checks; nothing else) */
export function spentInWall(g: Game, index: number) { if (thingAt(g, index)) WALLPEN_STATS.spent++; }

/** panel / console line */
export function wallPenSummary(g: Game): string {
  const st = WALLPEN_STATS;
  return `rounds through thin walls and doors ${WALLPEN.on ? (wallPenLive(g) ? 'ON' : 'on — inert while a showcase runs') : 'off (a round stops in the first thing it meets)'} ▸ ${st.crossed} crossed (${st.leaves} door leaves) · ${st.spent} spent in one${LOG.length ? ` · last: ${LOG[LOG.length - 1]}` : ''}`;
}
/** QA: the last crossings filed, oldest first */
export function wallPenLog(): readonly string[] { return LOG; }
