// DESTRUCTION (STATUS stage 3b — "a bit more destruction when going full auto with the FN2000 … stress test how much chaos we could do (Control!)", under
// the STEALTH-FIRST / LOW-VELOCITY principle and the no-unbounded-per-frame-work rule): what a burst of fire does to the office beyond the hole and the puff
// it always left. Everything here hangs off ONE knob, `tune.chaos` 0‥1 (default 0.5, Tab ▸ Sandbox ▸ chaos rows, kept per machine): 0 = the game byte
// for byte as it was — every hook below returns on its first line — and everything above 0 is BOUNDED: fixed pools, per-second caps, graceful demotion.
//
// The model. Rounds (anybody's) and stun charges pour HEAT into a coarse 2 m grid that decays with a 2 s time constant; a hit's ESCALATION E = heat × 2 ×
// chaos decides what it does on top of the marks / bursts that were always there (combat.ts fireWeapon → particleFx.impactFx / marks.bulletMark):
//   E ≥ 1    the FIRST round at chaos 0.5 (any round at chaos 1; the second in two seconds at 0.25) — a DAMAGE decal by material where one is due (a dent in
//            sheet metal, a shred in a fabric partition, a crack in a dark screen), a paper stack within reach of the hit CONVERTED into fluttering sheet
//            particles (the box hidden — NoPrimary | NoShadow — until the level resets), a monitor whose screen or housing took the round DIES (its emissive
//            off through the light targets — the OCP / round rule that was already there — a crack, a fizz of sparks);
//   E ≥ 1.5  bigger MATERIAL BURSTS (splinters = long chips off wood, gypsum dust off plaster, fluff off fabric, more sparks off metal) and DUST PUFFS into the
//            SMOKE SOLVER (a short cold 'puff' emitter: real density — the froxels light it in the torch beams and the guards' sight lines march through it,
//            one model — capped per second and by the solver's own emitter budget);
//   E ≥ 4    (the fifth round of a full-auto string at chaos 0.5; two seconds of rapid semi) small things on the desk near the hit are KNOCKED OFF as rigid debris
//            (a mug, the phone, a run of binders; a monitor housing off its stand on a direct hit) — game/debris.ts, a pool capped per tier (64 / 32) whose
//            refusals become particle bursts; a chair a round finds is spun;
//   E ≥ 9    (≈ 1.2 s of the FN2000 held on AUTO at chaos 0.5 — ten rounds a second saturate the heat at 20 — never at a deliberate semi cadence; or one stun
//            charge) a CEILING TILE above the beaten zone lets go: a tile-sized
//            slab see-saws down out of the plenum with a crumb burst and dust, lands with a knock the floor hears ('prop' 0.4); one tile per grid square, at
//            most one every couple of seconds and a handful an encounter.
// Velocity policy (docs/internal/image-quality.md §4: trail is set by shadow hardness × contrast, not speed; 64 tumbling casters cost +2 ms at high with no
// boil): knock-offs topple at walking pace at chaos ≤ 0.5 and scale toward ×2.5 at chaos 1 — the 'kinetic mode' seed, inside the same caps.
// IMPULSES ("it'd be cool if subsequent events further kicked paper sheets around"): what is already lying about is pushed again by what happens next — a
// stun charge throws the leaves within a couple of metres back up to flutter down and shoves the chunks it knocked off before (BANG: radius 4 m, gated per
// leaf by one occlusion ray from just over desk height, so the litter behind the partition stays), a round landing beside settled paper scoots it and nudges
// a chunk within half a metre (IMPACT: radius 0.6, biased along the round's travel over the surface), a body meeting the floor, a boot through a door and a
// piece of furniture knocking into something stir the litter at their feet (THUD: radius 1, subtle). One record each to the GPU particles (render/particles.ts
// impulse: ≤ 16 a frame, merged / weakest-dropped past that, applied by the update kernel — nothing at all on frames without any) and the same record over the
// rigid debris pool here (debris.ts impulse). Never from a particle: impulses come from game events only, so nothing re-triggers itself. Behind chaos > 0 AND
// tune.debrisImpulses (default on; off = the lane before this, byte for byte); strength × impK(chaos) like the knock-offs' vK.
// Guards HEAR it through the kinds that exist (debris landing = 'prop' at a level per kind; sheets and dust are silent); the dust dims their eyes by being
// smoke. Deterministic: nothing draws from Math.random — every choice hashes the module's own counter. Reset with the level (resetLevelState → reset():
// hidden statics restored, pools emptied, heat zeroed); the tour never sees any of it (chaosOf = 0 while touring).
import { Vec3, v3 } from '../math/vec';
import { Box, BoxFlag } from '../scene/boxes';
import type { Door } from './doors';
import { doorBlastReach } from './doorblast';   // (called inside doorsFor only: src/game is one import cycle)
import { WORLD } from '../scene/world';
import type { Game, LightTarget } from './game';
import type { WeaponDef } from './weapons';
import type { Prop } from './props';
import type { Character } from './character';
import { gpuFx, emitDust, paletteName, surfOf, fixtureShatterFx, lensShatterFx, type Surf } from './particleFx';
import { lampGlass } from './carlamps';
import { fireHolds, fireStir, fireStruck } from './fire';   // a blast does not put a fire out (FIRE.hardy)
import { Debris, hash01, type ChunkKind } from './debris';
import { PLAYER_ID, NOBODY_ID } from './consts';
import { chronLightShot } from './chronicle';
import { DESTRUCTION, RUBBLE } from './destructionSwitch';   // THE destruction goal's one switch (off = every line below as it was: the office's rules, the player-only fixture rule)
import { WallBreak, WALLS, wallBreakOn, type BlastOpts, type BlastResult, type BlastEvent, type WallOpening } from './wallbreak';
import { dustTint } from './dustLook';   // look only, and only with the destruction switch on: the dust's colour
import { EdgeLook, EDGE } from './edgeLook';
import { Furniture, chargeSource, type BlastSource } from './furnblast';   // furniture under a blast: thrown, broken — its own knob FURNBLAST.on (see that file's head)
import { Breaks } from './breakTable';
import { barFlags0 } from './winbars';   // (called inside flags0 only: src/game is one import cycle)
import { messBurst } from './floormess';   // what a blast leaves on the floor (CHAOS.mess; called inside blast only: src/game is one import cycle)
import { civiliansShown, civilianSeated } from './civilians';   // (kicked rubble: who is on his feet)

// ------------------------------------------------------------------ knobs
/** The lane's numbers (Tab ▸ Sandbox ▸ chaos rows edit the first block live; persisted with the switch: twopointsix.chaos). */
export const CHAOS = {
  def: 0.5,
  heatTau: 2.0,          // s: the beaten-zone memory
  cell: 2.0,             // m: heat grid cell
  // thresholds on E = heat × 2 × chaos
  tDecal: 1.0, tPaper: 1.0, tBurst: 1.5, tPuff: 1.5, tKnock: 4.0, tTile: 9.0,
  bangHeat: 9.0,         // what a stun charge pours in where it went off (→ E 9 at chaos 0.5: a tile, the desk cleared, papers up)
  // per-second caps (token buckets) and level-wide caps
  puffsPerSec: 8, puffsPerFrame: 2, papersPerSec: 6, knocksPerSec: 4, tileGapSecs: 2.2, tilesPerEncounter: 8, decalsPerSec: 12,
  paperReachM: 0.75,     // a hit within this of a stack (or through the space over it) scatters it
  knockReachM: 0.45,     // desk clutter within this of a hit goes
  sheetsPerStack: 26,    // sheet particles a converted stack becomes (× the stack's size)
  puff: { radius: 0.2, density: 3.5, ttl: 0.35, speed: 0.55, temp: 0.35, push: 6, expand: 8 },   // the smoke solver's dust puff (coarse lattice): optically THIN — a pale haze the beams light, not a sooty plume (density 11 self-shadowed black in the first captures)
  tile: { half: [0.29, 0.0075, 0.29] as Vec3, albedo: [0.66, 0.66, 0.63] as Vec3 },
  velLow: 1.0, velHighK: 2.5,   // knock-off speed scale at chaos ≤ 0.5, and the multiplier reached at chaos 1
  // IMPULSES (strength = the Δv m/s a sheet at the centre gets, radius m, up = the upward share on the radial push; game/sheetModel.ts flies the reference the numbers were
  // picked on: a charge lifts the leaves within a metre well over a metre and lands them a stride off, hops the ones at two metres knee height, shivers the ones at three
  // and a half and leaves the ones at four; a round hops the leaf beside it a few centimetres and scoots it a span; a thump twitches what lies within a stride)
  imp: {
    bang: { radius: 4.0, strength: 3.0, up: 2.0 },
    impact: { radius: 0.6, strength: 1.5, up: 0.5, biasK: 0.6, debrisM: 0.5 },   // biasK × the round's travel along the surface it struck; a chunk within debrisM is nudged
    thud: { radius: 1.0, strength: 0.8, up: 0.6, perFrame: 4 },                  // body falls / a boot through a door / furniture knocking: ≤ perFrame a frame, the rest not worth queuing
    chaosK: 1.5,                                                                 // strength × (1 at chaos ≤ 0.5 → chaosK at chaos 1), the knock-offs' velocity policy again
  },
  // THE LOUD LEVELS (read only with the destruction switch on — destructionSwitch.ts; off, nothing here is consulted). Fixtures die to ANYBODY's rounds and to blasts,
  // the panel over a beaten zone goes with the tile beside it, and all of it is capped per encounter so a long fight cannot put the whole floor in the dark.
  loud: {
    fixtureHitM: 0.18,        // a round passing this close to a fixture (or stopping in its box) is in it — the AI's rule; the player keeps combat.ts's wider aim-assisted one
    fixtureBlastM: 3.2,       // a charge this close to a fixture, with a clear line to it, breaks it (× √power): from the floor, the ceiling panel within ~1.3 m of straight overhead, a desk lamp across the room's corner
    stunFixtureM: 0.6,        // …a STUN charge only this close: the lamp it lands right beside. A flash and a report are not a blast — the room it stunned stays lit (3.2 with stunPanels on = a stun as it was: every lit fixture in the charge's reach)
    stunPanels: false,        // a stun charge shakes the light panel over it out of the ceiling like a tile (as it was). Off: a tile beside the panel may still let go, the panel stays lit
    fixturesPerEncounter: 10, // …but no more than this many die to stray fire, blasts and shaken ceilings in one encounter (the player's own aimed shots are not counted)
    fixtureGapSecs: 0.8,      // and never two inside this (blasts aside)
    blastDustFloor: 1.2,      // the puffs a charge raises off the floor it lay on (scale; the ceiling's is 1.6) …
    blastDustPuffs: 2,        // … this many (× power), spread over the next frames inside the puff caps (dustBurst)
    heatK: 2,                 // a round's heat counts this much under a scenario: a firefight between men who mostly HIT puts few rounds into the walls (6 to 20 a run, measured), so the
                              // first round into plaster already raises its dust and a short burst clears the desk — the office's own escalation (a held trigger) is left as tuned
    burstQueue: 32, burstSecs: 3,   // dustBurst: at most this many puffs waiting, none older than this
  },
  /** A BLAST'S PALL (the maintainer, 10-14: "i'd also expect much more dust/smoke from a wall charge" / "same goes for 40mm" / "and frag"). A charge's dust was the
   *  round's puff, a few times over, under the round's caps: a thin haze for a second. ON: a wall charge (wallcharge.ts blow → pallWall) and every burst that
   *  comes through blast() with its chaos (the hand grenade, the 40 mm, a bomb → pallBurst) also raise a PALL — a handful of wide, slow, seconds-long emitters
   *  into the smoke solver, on the charge's side of the wall and, through the hole, on the far side; in a ring round a burst with a darker column over it — and
   *  a slow big layer of particle dust with it. The solver's part is real density: every sight line that crosses it reads it, the player's picture and the
   *  men's eyes alike (one model), so for a few seconds neither side sees through it; it thins by the solver's own decay. `solver` false = the particle layer
   *  alone (picture only: nobody is hidden by it). Its own allowance, not the puffs': `perWindow` palls in any `windowSecs` (one more burst in the window
   *  raises the old dust alone — six, not three: his word on it, 10-14, "it should feel pretty chaotic with HE going off"; the wall charge is never the one refused, and counts), and no emitter — nor the particle layer over it — while the solver
   *  has fewer than `slack` slots free. Not under a level script's show. The dice are a hash of the place and the moment: none of the lane's are drawn, so
   *  with the solver a null object (the harness) a run is the same run with the rule on or off. An emitter keeps `clear` radii off anything solid (judged
   *  at `clearY` m), shrinking to `minRadius` of its radius at the least with its density up to `maxGain` times for it (pallEmit).
   *  Rows: `near` / `far` emitters either side of the wall (far only through a hole), `ring` round a burst (× its size: 1 = the hand grenade's 2.5 m) and
   *  one darker column over it (`coreGain` × the density, `smoke` its tint), each `radius` m wide (gaussian), `density` /s at the core for `ttl` s, thrown
   *  `speed` m/s, `temp` its lift, `push` / `expand` as any emitter's, scattered `spread` m, standing `out` m off the wall; `dust` particles (near, far |
   *  round a burst) living `dustLife` s, `dustSize` m, `dustSpeed`. Measured on the page (docs/agents/destruction.md): hidden across it for 3 to 4 s.
   *  OFF in this module and on the frozen stand; the page turns it on (?pall=0 = the dust as it was, ?pall=look = the particle layer alone). */
  pall: {
    on: false, solver: true, perWindow: 6, windowSecs: 4, slack: 8, clear: 1.8, clearY: 1.7, minRadius: 0.5, maxGain: 2,
    wall: { near: 4, far: 3, radius: 0.45, density: 0.8, ttl: 1.5, speed: 1.6, temp: 0.25, push: 5, expand: 1.2, spread: 0.9, out: 0.5, dust: [36, 24] as [number, number], dustLife: 4.5, dustSize: 0.6, dustSpeed: 1.2 },
    burst: { ring: 5, coreGain: 1.3, radius: 0.42, density: 0.85, ttl: 1.2, speed: 1.4, temp: 0.3, push: 5, expand: 1.5, spread: 0.6, dust: 48, dustLife: 3.8, dustSize: 0.5, dustSpeed: 1.8, smoke: [0.34, 0.33, 0.32] as [number, number, number] },
  },
  /** WHAT A BLAST AND A BROKEN THING LEAVE ON THE FLOOR (floormess.ts; "the office floor looks too clean"). OFF (the module's default, the frozen stand, a
   *  recording from before the key): a blast leaves its scorch and the chunks the pool still holds, and the rest of the dust is gone with the air. ON: where a
   *  blast's pall stood a pale film of settled dust and grit lies on the floor (and on the desk tops under it), shaped to the room — a heart at the burst, lobes
   *  round it, none of them across a standing wall — with the soot rayed out of its middle; a wall charge lays one each side it reached; a wall or a piece of
   *  cover that gives under fire leaves a small one at its foot; and a chunk the debris pool takes for its slot leaves the crushed mark of itself where it lay.
   *  ALL OF IT is marks laid only for the picture (decals tagged by lookDecals.ts: no ray, foot, eye, ear or die knows them; a full ring drops them first). */
  mess: {
    on: false,
    /** what STANDS in dust's way is whatever meets the band standY‥clearY (a wall, a pane, a cabinet; not a desk, a sill or a door's header) · how far a film
     *  tucks under what it meets · the least film worth laying · two films nearer than this × the smaller one's reach are one · a burst above this leaves none */
    standY: 1.05, clearY: 1.7, under: 0.06, minRadius: 0.28, crowd: 0.8, roofY: 2.2,
    /** a burst (the hand grenade = size 1; the 40 mm and a bomb by their radius): the heart's reach, how many lobes, how far out and how wide, how thick */
    burst: { core: 1.15, lobes: 6, reach: 1.25, lobe: 0.95, strength: 0.8 },
    /** a wall charge: the charge's side, and the side its wall went to (only when it went through) */
    wall: { out: 0.55, near: { core: 1.0, lobes: 4, reach: 1.1, lobe: 0.85, strength: 0.7 }, far: { core: 1.2, lobes: 5, reach: 1.4, lobe: 0.95, strength: 0.9 } },
    /** a wall / cover cell opened by fire or a fall: one patch each side of what opened */
    foot: { out: 0.32, radius: 0.5, perMetre: 0.25, strength: 0.5 },
    /** a desk top (anything flat between these heights) under a film takes its own, this much of the floor's */
    top: { lo: 0.08, hi: 1.4, strength: 0.75 },
    /** a chunk the pool took: nothing under this size · the mark's reach = its longest half extent × grow, between min and max · none within crowd × reach of another */
    rubble: { least: 0.035, grow: 1.5, min: 0.09, max: 0.42, crowd: 0.7, strength: 0.85 },
  },
};
/** the pall's own counters (a tool's: nothing in the game reads them; not in DESTR_STATS, which older digests carry whole) */
export const PALL_STATS = { palls: 0, emitters: 0, refused: 0, starved: 0, shut: 0, dust: 0 };
/** the eight ways an emitter of a pall looks for something solid near it (x, z) */
const PALL_DIRS: [number, number][] = [[1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071], [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071]];
export const CHAOS_DEFAULTS = JSON.parse(JSON.stringify(CHAOS)) as typeof CHAOS;
const LS_KEY = 'twopointsix.chaos';
type ChaosTune = { chaos?: number; debrisImpulses?: boolean };
/** the knob as the systems read it: 0 under the tour (the showcase is choreographed round the office as authored), else tune.chaos clamped — UNLESS a showcase PROGRAM of
 *  the level script has set its own for its length (director.ts c.chaos → Destruction.showChaos: the day showcase's loud minute runs at 0.8 whatever the player keeps,
 *  and it is the one thing read under `touring`; the Director nulls it as the program ends, before the encounter is restored) */
export function chaosOf(g: Game): number { const s = g.destr?.showChaos; if (s !== null && s !== undefined) return Math.max(0, Math.min(1, s)); if (g.touring) return 0; const c = (g.tune as ChaosTune).chaos; return Math.max(0, Math.min(1, c ?? 0)); }
/** impulses at all: chaos > 0 AND the switch (game.ts tune.debrisImpulses, default on, kept with the knob) */
/** THE LOUD LEVELS' rules are live: the destruction switch on AND a scenario up (the room clear, the night breach, the rescue) — the plain night floor keeps the office's
 *  own tuning and its player-only fixture rule whatever the switch says. (What is STRUCTURAL — the dressing, 'indoors' = under a roof — follows the switch alone.) */
export function loudNow(g: Game): boolean { return DESTRUCTION.on && !!(g.roomClear?.active || g.nightBreach?.active || g.rescue?.active); }
export function impulsesOn(g: Game): boolean { return chaosOf(g) > 0 && (g.tune as ChaosTune).debrisImpulses !== false; }
export function loadChaos(tune: ChaosTune) {
  tune.chaos = CHAOS.def;
  try { const raw = localStorage.getItem(LS_KEY); if (!raw) return; const o = JSON.parse(raw); if (typeof o.chaos === 'number' && isFinite(o.chaos)) tune.chaos = Math.max(0, Math.min(1, o.chaos)); if (typeof o.debrisImpulses === 'boolean') tune.debrisImpulses = o.debrisImpulses; for (const k of ['puffsPerSec', 'papersPerSec', 'knocksPerSec', 'tilesPerEncounter'] as const) if (typeof o[k] === 'number' && isFinite(o[k])) CHAOS[k] = o[k];
    const I = CHAOS.imp, oi = o.imp; if (oi && typeof oi === 'object') { for (const k of ['strength', 'radius', 'up'] as const) if (typeof oi.bang?.[k] === 'number' && isFinite(oi.bang[k])) I.bang[k] = oi.bang[k]; if (typeof oi.impact?.strength === 'number' && isFinite(oi.impact.strength)) I.impact.strength = oi.impact.strength; if (typeof oi.thud?.strength === 'number' && isFinite(oi.thud.strength)) I.thud.strength = oi.thud.strength; } } catch { /* no storage (bun) / junk */ }
}
export function saveChaos(g: Game) { try { const t = g.tune as ChaosTune; const I = CHAOS.imp; localStorage.setItem(LS_KEY, JSON.stringify({ chaos: t.chaos ?? CHAOS.def, debrisImpulses: t.debrisImpulses !== false, puffsPerSec: CHAOS.puffsPerSec, papersPerSec: CHAOS.papersPerSec, knocksPerSec: CHAOS.knocksPerSec, tilesPerEncounter: CHAOS.tilesPerEncounter, imp: { bang: { strength: I.bang.strength, radius: I.bang.radius, up: I.bang.up }, impact: { strength: I.impact.strength }, thud: { strength: I.thud.strength } } })); } catch { /* */ } }
export function resetChaosKnobs(g: Game) { const { on, solver } = CHAOS.pall, mess = CHAOS.mess.on; Object.assign(CHAOS, JSON.parse(JSON.stringify(CHAOS_DEFAULTS))); CHAOS.pall.on = on; CHAOS.pall.solver = solver; CHAOS.mess.on = mess;   // (the pall's switch is the page's, not a tuning: ↺ puts its numbers back and leaves the rule as the page opened)
  const t = g.tune as ChaosTune; t.chaos = CHAOS.def; t.debrisImpulses = true; try { localStorage.removeItem(LS_KEY); } catch { /* */ } }
/** the impulses' strength scale off the knob: 1 up to chaos 0.5, rising to CHAOS.imp.chaosK at chaos 1 (the knock-offs' vK, gentler) */
export function impK(chaos: number): number { return chaos <= 0.5 ? 1 : 1 + (CHAOS.imp.chaosK - 1) * (chaos - 0.5) * 2; }

// ------------------------------------------------------------------ the destructible statics, found by shape once
type DKind = 'paper' | 'screen' | 'housing' | 'clutter' | 'binder' | 'tv';
interface Destructible { i: number; kind: DKind; box: Box; flags0: number; /** screen ↔ housing pairing (indices into the statics) */ mate?: number; /** the light target lighting this screen, if it is a lit one */ target?: LightTarget; /** clutter standing on / against this one: knocked off with it */ group?: number[]; }
const SCREEN_OFF: Vec3 = [0.02, 0.02, 0.025];
const lum = (a: Vec3) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
const near3 = (a: Vec3, b: Vec3, e: number) => Math.abs(a[0] - b[0]) < e && Math.abs(a[1] - b[1]) < e && Math.abs(a[2] - b[2]) < e;
/** under the ceiling slab: the building's footprint (weather.ts INTERIOR [4, 4, 36, 24]) less a tile's width */
const indoors = (p: Vec3) => p[0] > 4.3 && p[0] < 35.7 && p[2] > 4.3 && p[2] < 23.7;
/** the point just over a box's top (line-of-sight targets aim here: a segment ending INSIDE the box would report the box itself as the wall in the way) */
const topOf = (b: Box): Vec3 => [b.c[0], b.c[1] + b.h[1] + 0.05, b.c[2]];

/** QA / panel counters (module totals; the probes diff them) */
export const DESTR_STATS = { rounds: 0, bangs: 0, decals: 0, papers: 0, sheets: 0, puffs: 0, puffsRefused: 0, bursts: 0, knocks: 0, knocksDemoted: 0, screens: 0, tiles: 0, tilesRefused: 0, chairSpins: 0, impBang: 0, impImpact: 0, impThud: 0, impThudDropped: 0, debrisKicked: 0, fixtures: 0, fixturesRefused: 0 };
export const DESTR_LOG: string[] = [];
function dlog(g: Game, s: string) { DESTR_LOG.push(`${g.time.toFixed(2)} ${s}`); if (DESTR_LOG.length > 200) DESTR_LOG.splice(0, 100); }

/** ≤ n() events in any one-second window, exactly: a ring of the last n stamps (a token bucket's burst would let ~2n through across a window's edge, and these caps
 *  are what the page promises) */
const ROOF_RAYS: [number, number][] = [[0, 0], [0.29, 0], [-0.29, 0], [0, 0.29], [0, -0.29]];
class RateCap {
  private ts: number[] = []; private head = 0;
  constructor(private n: () => number) {}
  take(t: number): boolean {
    const n = Math.max(0, Math.floor(this.n())); if (n === 0) return false;
    if (this.ts.length !== n) { this.ts = new Array(n).fill(-1e9); this.head = 0; }   // (the panel changed the cap: start the window afresh)
    const oldest = this.ts[this.head]; if (t - oldest < 1) return false;
    this.ts[this.head] = t; this.head = (this.head + 1) % n; return true;
  }
  reset() { this.ts.fill(-1e9); this.head = 0; }
}

export class Destruction {
  readonly debris: Debris;
  /** WALL BREAKING (game/wallbreak.ts): interior partitions, cover and door keeps coming apart under rounds and blasts — the level's own statics re-cut, one model
   *  for the picture, rays, sight, sound, feet and the nav grid, with a change feed for the AI (`walls.serial` / `walls.changes` / `walls.onChange`) */
  readonly walls: WallBreak;
  /** the look of a broken wall's edges — picture only (edgeLook.ts) */
  readonly edgeLook: EdgeLook;
  /** FURNITURE UNDER A BLAST (game/furnblast.ts): pushable furniture thrown, fixed furniture near a charge broken into rigid pieces — behind its own knob FURNBLAST.on */
  readonly furn: Furniture;
  /** the break table's hooks on the pool (game/breakTable.ts: cut pieces by material — nothing while the cut switch is off) */
  readonly breaks: Breaks;
  /** a SHOWCASE PROGRAM's own chaos for its length (director.ts c.chaos, nulled by the Director as the program ends): while set, chaosOf reads THIS — under `touring` too, where
   *  the knob itself reads 0 — so the day showcase's loud minute breaks things at 0.8 without touching the player's kept tune.chaos. Never persisted, never the panel's. */
  showChaos: number | null = null;
  /** heat per 2 m cell (rounds in the last ~2 s), decayed every frame */
  private heat: Float32Array; private hw: number; private hh: number;
  /** the destructibles by static index, and per 1 m cell the indices near it */
  private items = new Map<number, Destructible>(); private cells: number[][];
  /** statics hidden this encounter (index → original flags), restored by reset() */
  private hidden = new Map<number, number>();
  /** ceiling squares already dropped this encounter ('cx,cz' on the 0.6 m tile grid), the last drop's time, drops so far */
  private tilesDown = new Set<string>(); private lastTileT = -100; private tileCount = 0;
  /** light targets this module broke (dead screens): un-broken again by reset() so 'reset destruction' really puts the office back (a restart repairs every light anyway) */
  private broke = new Set<LightTarget>();
  /** the loud levels (the switch on): fixtures this module put out this encounter and when the last went; the roof's underside per 0.6 m square, asked once */
  private fixtureCount = 0; private lastFixtureT = -100; private roofs = new Map<number, number>(); private targetOfBox = new Map<number, LightTarget>();
  private gatherScratch = new Int32Array(32);
  /** per-second caps: strict sliding windows (≤ N in ANY one second — a token bucket lets nearly 2N through across a boundary) */
  private caps = { puff: new RateCap(() => CHAOS.puffsPerSec), paper: new RateCap(() => CHAOS.papersPerSec), knock: new RateCap(() => CHAOS.knocksPerSec), decal: new RateCap(() => CHAOS.decalsPerSec) }; private puffsThisFrame = 0;
  /** knock-offs riding on a group leader's slot this frame (a pot's plant goes with the pot without a slot of its own) */
  private freeKnocks = 0;
  /** the module's own counter every hashed choice counts off (reset with the level: a restarted encounter repeats) */
  private serial = 1;
  private W = WORLD.gridW; private cs = WORLD.gridCell;

  constructor(private g: Game) {
    this.debris = new Debris(g); this.breaks = new Breaks(g, this.debris); this.debris.breaks = this.breaks;   // (the break table: nothing while the cut switch is off)
    this.hw = Math.ceil((WORLD.max[0] - WORLD.min[0]) / CHAOS.cell); this.hh = Math.ceil((WORLD.max[2] - WORLD.min[2]) / CHAOS.cell);
    this.heat = new Float32Array(this.hw * this.hh);
    this.cells = Array.from({ length: WORLD.gridW * WORLD.gridH }, () => []);
    this.index();
    this.walls = new WallBreak(g, this); this.edgeLook = new EdgeLook(g); this.breaks.look = EDGE;
    this.furn = new Furniture(g, this);
  }

  // ---------------------------------------------------------------- index
  /** Walk the statics once: paper stacks (thin pale NoShadow slabs on furniture), dark screens + the housing behind each desk monitor's, wall TVs, and desk
   *  clutter small enough to knock off (mugs, phones, binders …) — never a fixture's box, never glass, never anything at floor level. */
  private index() {
    const g = this.g; const boxes = g.col.boxes;
    const targetOf = this.targetOfBox; targetOf.clear(); for (const t of g.targets) for (const bi of t.boxes) targetOf.set(bi, t);
    const fixtureBoxes = new Set<number>(targetOf.keys());
    for (const l of g.level.lights) if ((l as { fixtureBox?: number }).fixtureBox !== undefined && (l as { fixtureBox: number }).fixtureBox >= 0) fixtureBoxes.add((l as { fixtureBox: number }).fixtureBox);
    const screens: number[] = [];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; const h = b.h; const maxH = Math.max(h[0], h[1], h[2]), minH = Math.min(h[0], h[1], h[2]);
      if (b.flags & (BoxFlag.Glass | BoxFlag.NoPrimary)) continue;
      const bottom = b.c[1] - h[1];
      let kind: DKind | null = null;
      const dark = b.emissive[0] + b.emissive[1] + b.emissive[2] === 0;
      if ((b.flags & BoxFlag.NoShadow) && h[1] <= 0.03 && lum(b.albedo) > 0.7 && maxH >= 0.08 && maxH <= 0.2 && bottom > 0.3 && dark) kind = 'paper';
      else if (near3(b.albedo, SCREEN_OFF, 0.004) && minH <= 0.012) kind = maxH > 0.35 || (bottom > 1.2 && maxH > 0.3) ? 'tv' : 'screen';   // (lit or not: a lit one is a light target too, and dies through it)
      else if (!(b.flags & BoxFlag.NoShadow) && !fixtureBoxes.has(i) && maxH <= 0.17 && h[0] * h[1] * h[2] * 8 <= 0.02 && bottom >= 0.7 && bottom <= 1.6 && dark && lum(b.albedo) < 0.95) kind = h[1] >= 0.1 && h[1] > 2.5 * Math.min(h[0], h[2]) ? 'binder' : 'clutter';
      if (!kind) continue;
      const d: Destructible = { i, kind, box: b, flags0: b.flags };
      if (kind === 'screen' || kind === 'tv') { const t = targetOf.get(i); if (t) d.target = t; if (kind === 'screen') screens.push(i); }
      this.items.set(i, d);
    }
    // pair each desk screen with the housing slab just behind it (same yaw, a couple of centimetres back, at least as wide) — the housing is what comes off the stand
    for (const si of screens) {
      const s = boxes[si]; let best = -1, bd = 0.08;
      for (let i = Math.max(0, si - 6); i < Math.min(boxes.length, si + 6); i++) {
        if (i === si) continue; const b = boxes[i];
        if (Math.abs(b.yaw - s.yaw) > 1e-3 || b.h[0] < s.h[0] || b.h[1] < s.h[1] || b.h[2] > 0.05 || lum(b.albedo) > 0.1) continue;
        const dd = v3.dist(b.c, s.c); if (dd < bd) { bd = dd; best = i; }
      }
      if (best >= 0) {
        const sd = this.items.get(si)!; sd.mate = best;
        const hd: Destructible = this.items.get(best) ?? { i: best, kind: 'housing', box: boxes[best], flags0: boxes[best].flags };
        hd.kind = 'housing'; hd.mate = si; hd.target = sd.target; this.items.set(best, hd);
      }
    }
    // small dark parts right under a housing are the monitor's foot and neck, not clutter; a part standing under / beside a FIXTURE (the desk lamp's base under its lit
    // head, a valve head by an indicator) is that fixture's, not clutter; nothing outside the building counts (the lot's machines stay whole)
    const fixtures = [...fixtureBoxes].map(fi => boxes[fi]).filter(Boolean);
    for (const [i, d] of [...this.items]) {
      const c = d.box.c;
      if (DESTRUCTION.on ? this.roofY(c[0], c[2]) === null : (c[0] < 4 || c[0] > 36 || c[2] < 4 || c[2] > 24)) { this.items.delete(i); continue; }   // (the switch on: 'inside' is whatever has a roof over it — a loud level's buildings stand anywhere in the world; off: the office's footprint, as ever)
      if (d.kind !== 'clutter' && d.kind !== 'binder') continue;
      if (fixtures.some(f => { const ac = Math.abs(Math.cos(f.yaw)), as = Math.abs(Math.sin(f.yaw)); return Math.abs(f.c[0] - c[0]) < ac * f.h[0] + as * f.h[2] + 0.12 && Math.abs(f.c[2] - c[2]) < as * f.h[0] + ac * f.h[2] + 0.12 && Math.abs(f.c[1] - c[1]) < 0.7; })) { this.items.delete(i); continue; }
      if (lum(d.box.albedo) > 0.1) continue;
      for (const [, o] of this.items) if (o.kind === 'housing' && Math.hypot(o.box.c[0] - c[0], o.box.c[2] - c[2]) < 0.12 && o.box.c[1] > c[1]) { this.items.delete(i); break; }
    }
    // things standing on / against each other go together (a pot and its plant, the phone and its handset, a mug on a saucer): knock one, knock the group
    const smalls = [...this.items.values()].filter(d => d.kind === 'clutter' || d.kind === 'binder');
    for (const d of smalls) for (const o of smalls) {
      if (o === d) continue; const a = d.box, b = o.box;
      if (Math.abs(a.c[0] - b.c[0]) > 0.07 + Math.min(a.h[0], b.h[0]) || Math.abs(a.c[2] - b.c[2]) > 0.07 + Math.min(a.h[2], b.h[2])) continue;
      if (Math.abs(a.c[1] - b.c[1]) > a.h[1] + b.h[1] + 0.03) continue;
      (d.group ??= []).push(o.i);
    }
    for (const [i, d] of this.items) { const b = d.box; const cx = Math.floor((b.c[0] - WORLD.min[0]) / this.cs), cz = Math.floor((b.c[2] - WORLD.min[2]) / this.cs); if (cx >= 0 && cz >= 0 && cx < this.W && cz < WORLD.gridH) this.cells[cz * this.W + cx].push(i); }
  }
  /** The underside of the roof over (x, z), or null under the open sky. Switch OFF: the office's footprint rectangle and its one ceiling height, exactly as before. ON: per
   *  0.6 m square, five rays straight up from over head height (2.3 m: past shelving and door heads) at the SQUARE's centre and 0.29 m either way — roofed when at least
   *  four find something (a lamp head on its pole, a pipe: not a roof; weather.ts openSky's reason), the height the highest of them (a door's lintel, a hanging panel
   *  answer low) — remembered per square whoever asks first: roofs are never among the things that come apart. */
  private roofY(x: number, z: number): number | null {
    if (!DESTRUCTION.on) return indoors([x, 0, z]) ? WORLD.ceilingY : null;
    const key = Math.floor(x / 0.6) * 4096 + Math.floor(z / 0.6); const c = this.roofs.get(key); if (c !== undefined) return c < 0 ? null : c;
    const cx = (Math.floor(x / 0.6) + 0.5) * 0.6, cz = (Math.floor(z / 0.6) + 0.5) * 0.6; let n = 0, top = -1;
    for (const [dx, dz] of ROOF_RAYS) { const hit = this.g.col.raycast([cx + dx, 2.3, cz + dz], [0, 1, 0], WORLD.max[1] - 2.3); if (hit) { n++; top = Math.max(top, 2.3 + hit.t); } }
    const y = n >= 4 ? top : -1;
    this.roofs.set(key, y); return y < 0 ? null : y;
  }
  /** destructibles registered in the 3×3 cells round p */
  private near(p: Vec3, out: Destructible[]) {
    out.length = 0;
    const cx = Math.floor((p[0] - WORLD.min[0]) / this.cs), cz = Math.floor((p[2] - WORLD.min[2]) / this.cs);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= this.W || z >= WORLD.gridH) continue; for (const i of this.cells[z * this.W + x]) { const d = this.items.get(i); if (d && !this.hidden.has(i)) out.push(d); } }
    return out;
  }
  /** counts by kind (the panel / the probes) */
  inventory(): Record<string, number> { const m: Record<string, number> = {}; for (const d of this.items.values()) m[d.kind] = (m[d.kind] ?? 0) + 1; m.hidden = this.hidden.size; return m; }
  itemOf(i: number): Destructible | undefined { return this.items.get(i); }

  // ---------------------------------------------------------------- heat
  private hidx(p: Vec3): number { const x = Math.min(this.hw - 1, Math.max(0, Math.floor((p[0] - WORLD.min[0]) / CHAOS.cell))), z = Math.min(this.hh - 1, Math.max(0, Math.floor((p[2] - WORLD.min[2]) / CHAOS.cell))); return z * this.hw + x; }
  /** add heat at p (a round = 1, a bang = CHAOS.bangHeat) and return the escalation there AFTER it: heat × 2 × chaos */
  private stoke(p: Vec3, amount: number, chaos: number): number { const i = this.hidx(p); this.heat[i] += amount; return this.heat[i] * 2 * chaos; }
  heatAt(p: Vec3): number { return this.heat[this.hidx(p)]; }
  escalationAt(p: Vec3): number { return this.heatAt(p) * 2 * chaosOf(this.g); }
  private hash(): number { return hash01(this.serial++ * 2654435761); }
  private take(k: keyof Destruction['caps']): boolean { if (k === 'knock' && this.freeKnocks > 0) { this.freeKnocks--; return true; } return this.caps[k].take(this.g.time); }

  // ---------------------------------------------------------------- per frame
  update(dt: number) {
    const g = this.g;
    if (RUBBLE.on && (!g.touring || this.showChaos !== null)) { const men = this.onFoot(); if (this.debris.list.length) this.debris.feet(men, RUBBLE); this.edgeLook.feet(men, RUBBLE, dt); }   // kicked rubble (debris.ts feet; the blown walls' own fragments through edgeLook.ts feet): off = not called; nor under the tour, bar a showcase program running its own chaos (as chaosOf)
    if (this.debris.list.length) this.debris.update(dt);
    this.breaks.tick();
    this.edgeLook.update(dt);
    this.thudsThisFrame = 0;
    if (chaosOf(g) <= 0 && !this.anyHeat) return;
    const k = Math.exp(-dt / CHAOS.heatTau); let any = false;
    for (let i = 0; i < this.heat.length; i++) { const h = this.heat[i] * k; this.heat[i] = h < 0.02 ? 0 : h; if (h >= 0.02) any = true; }
    this.puffsThisFrame = 0; this.freeKnocks = 0;
    if (chaosOf(g) <= 0) this.dustQueue.length = 0;   // (chaos 0 / the tour: nothing more goes into the solver, whatever was waiting)
    this.anyHeat = any || this.dustQueue.length > 0;
    // queued dust (dustBurst): as many as this frame's and this second's caps allow, oldest first; what waited too long is let go
    while (this.dustQueue.length) { const q = this.dustQueue[0]; if (g.time - q.t > CHAOS.loud.burstSecs) { this.dustQueue.shift(); DESTR_STATS.puffsRefused++; continue; } if (this.puffsThisFrame >= CHAOS.puffsPerFrame) break; const r0 = DESTR_STATS.puffsRefused; if (!this.dustPuff(q.p, q.n, q.scale, q.surf)) { DESTR_STATS.puffsRefused = r0; break; } this.dustQueue.shift(); }   // (a puff the caps hold back this frame WAITS: not counted refused until it is let go)
  }
  /** the men on their feet this frame (who shoves the furniture, game.ts updateProps — bar the calm civilian, who is no contact for a chair but does step through rubble) */
  private onFoot(): Character[] {
    const g = this.g; const men: Character[] = g.player.down ? [] : [g.player.char];
    for (const gd of g.guards) if (gd.state !== 'dead') men.push(gd.char);
    for (const cv of civiliansShown(g)) if (cv.state !== 'dead' && !civilianSeated(cv)) men.push(cv.char);
    return men;
  }
  private anyHeat = false; private thudsThisFrame = 0;
  private dustQueue: { p: Vec3; n: Vec3; scale: number; surf: Surf; t: number }[] = [];
  boxes(out: Box[]) { this.debris.boxes(out); this.edgeLook.boxes(out); }

  /** Level reset (resetLevelState): every hidden static back as authored, the pools emptied, heat and caps and the counter back to the start. */
  reset() {
    for (const [i, f] of this.hidden) this.g.col.boxes[i].flags = f;
    this.hidden.clear(); this.debris.clear(); this.heat.fill(0); this.anyHeat = false; this.tilesDown.clear(); this.lastTileT = -100; this.tileCount = 0; this.serial = 1;
    for (const c of Object.values(this.caps)) c.reset(); this.freeKnocks = 0;
    for (const t of this.broke) t.broken = false; this.broke.clear();   // (the screens THIS module put out come back with the stacks; a restart repairs every light besides)
    this.fixtureCount = 0; this.lastFixtureT = -100; this.dustQueue.length = 0; this.pallAt.length = 0;
    this.breaks.reset();
    this.edgeLook.clear();
    this.walls.reset(); this.furn.reset();   // …and every holed wall / chewed crate back as authored, the appended pieces cut off, the nav grid re-baked (nothing at all when nothing broke)
  }
  /** the tour's cuts / clearAftermath: nothing tumbling carries over into the next shot (hidden statics stay hidden until the level resets) */
  clearMoving() { this.debris.clear(); this.dustQueue.length = 0; }

  // ---------------------------------------------------------------- the sites
  /** A round from `shooter` stopped at `hitP` travelling `dir` in a static (`index` as col.raycast reports it; ≥ 1e6 = a leaf), a piece of furniture (`prop`)
   *  or nothing solid (both undefined: flesh / sky — nothing here). combat.ts fireWeapon calls it right after the marks and the particle burst it always made. */
  round(shooter: Character, hitP: Vec3, dir: Vec3, hit: { n: Vec3; index?: number; prop?: Prop; box?: Box }, def: WeaponDef) {
    const g = this.g; const chaos = chaosOf(g); if (chaos <= 0) return;
    if (hit.index === undefined && !hit.prop) return;
    DESTR_STATS.rounds++;
    const E = this.stoke(hitP, loudNow(g) ? CHAOS.loud.heatK : 1, chaos); this.anyHeat = true;
    const rifle = def.cls !== 'pistol'; const k = rifle ? 1.4 : 1;
    const n = v3.normalize(hit.n);
    // what was hit
    let surf: Surf = 'concrete'; let albedo: Vec3 = [0.5, 0.5, 0.5]; let mat: string | undefined; let box: Box | null = null; let bi = -1;
    if (hit.prop) { surf = hit.prop.def.kind === 'chair' ? 'fabric' : hit.prop.def.kind === 'cardboard' ? 'cardboard' : hit.prop.def.kind === 'bin' ? 'metal' : 'foliage'; box = hit.box ?? hit.prop.boxes[0] ?? null; albedo = box?.albedo ?? albedo; }   // (the very PART the round met: a shred aimed at a chair back lands on the back, not the seat's rim)
    else if (hit.index !== undefined && hit.index >= 1e6) { surf = 'wood'; box = g.col.dynamicBoxes[hit.index - 1e6] ?? null; albedo = box?.albedo ?? albedo; }
    else if (hit.index !== undefined) { bi = hit.index; box = g.col.boxes[bi] ?? null; if (box) { albedo = box.albedo; mat = paletteName(albedo); surf = surfOf(albedo); if (mat === 'partRed' || mat === 'partBlue' || mat === 'partTan') surf = 'fabric'; } }
    const item = bi >= 0 ? this.items.get(bi) : undefined;
    // (1) damage decals by material
    if (E >= CHAOS.tDecal && box) this.damageDecal(hitP, n, surf, box, !!hit.prop || (hit.index !== undefined && hit.index >= 1e6), rifle, item);
    // (2) a monitor / TV that took the round: dead, cracked, a fizz of sparks (any shooter: the round is in it)
    if (item && (item.kind === 'screen' || item.kind === 'housing' || item.kind === 'tv')) this.killScreen(item, hitP, n, shooter.id === PLAYER_ID);
    // (3) paper near the hit (or whose air the round crossed) flies
    if (E >= CHAOS.tPaper) this.papersNear(hitP, dir, E, chaos, k, v3.dist(shooter.muzzle, hitP));
    // (4) bigger material bursts + (5) dust into the smoke solver
    if (E >= CHAOS.tBurst) this.burst(hitP, dir, n, surf, albedo, E, k, shooter.id);
    if (E >= CHAOS.tPuff && (surf === 'drywall' || surf === 'concrete' || surf === 'wood' || surf === 'cardboard' || surf === 'fabric')) this.dustPuff(v3.mad(hitP, n, 0.05), n, Math.min(2, 0.7 + 0.2 * E), surf);
    // (6) knock-offs: the housing on a direct hit, clutter near the hit; a chair a round finds is spun
    const who = shooter.id;   // whose doing every knock this round causes is (debris.ts Chunk.who: heard and chronicled as Sam's only if it was)
    if (E >= CHAOS.tKnock) {
      if (item && item.kind === 'housing') this.knockOff(item, dir, chaos, 'housing', who);
      else if (item && item.kind === 'screen' && item.mate !== undefined) { const hd = this.items.get(item.mate); if (hd) this.knockOff(hd, dir, chaos, 'housing', who); }
      if (item && (item.kind === 'clutter' || item.kind === 'binder')) this.knockOff(item, dir, chaos, item.kind === 'binder' ? 'binder' : 'clutter', who);
      this.clutterNear(hitP, dir, chaos, who);
      if (hit.prop && hit.prop.def.kind === 'chair') { hit.prop.w += (this.hash() < 0.5 ? -1 : 1) * (4 + 5 * chaos); hit.prop.wake(); DESTR_STATS.chairSpins++; }
    }
    // (7) the ceiling over a beaten zone
    if (E >= CHAOS.tTile) this.tileDrop(hitP, chaos, false, who);
    // (8) what already lies about the hit is scooted along (every round, whatever the heat: the leaf beside the hole jumps)
    this.impactImpulse(hitP, dir, n, chaos, who);
    // (9) WALL BREAKING: the round's work on the partition / the cover / the leaf it stopped in — a cell that has taken its share goes (wallbreak.ts)
    if (hit.index !== undefined && DESTRUCTION.on) this.walls.round(who, hitP, dir, hit.index, def, chaos);
  }

  /** THE BLAST ENTRY POINT — what any charge or grenade calls to break the level where it went off. In order:
   *    1. the CALL LIST, before anything of the level is judged (the doors come next: a leaf torn off is from then a slab lying at its frame to everything below): every `onBlast` subscriber, then
   *       the doors' own `g.doors.blast(at, tearM, who)` where the doors carry one (tearM = WALLS.blast.doorK × the breaking radius). A subscriber adds what it
   *       took to the event's `res` (res.doors, res.panes). The GLASS's own blast joins here too (its goal's line; today glass.ts still drives it off the 'bang'
   *       hearing event, so it is not called from here — that would star every pane twice);
   *    2. the WALLS and COVER (wallbreak.ts WallBreak.blast): partitions within reach holed (a hole a man fits through when it lay against the wall) or ported,
   *       cover destroyed, the nav grid re-baked, the AI's feed written;
   *    3. unless `opts.chaos === false`, the lane's bang() chaos — dust, tiles, clutter, papers.
   *  It hurts nobody, flashes nothing and files no hearing event: the caller does its own. With THE ONE SWITCH off it is the old bang(at, who) and nothing else
   *  (returns zeros; nothing at all with `chaos: false` or at chaos 0), so a grenade that calls this is the grenade it was before the engine;
   *  with only tune.wallBreak off, steps 1 and 3 still run. */
  blast(at: Vec3, opts: BlastOpts = {}): BlastResult { return this.g.fogOfWar.doing(opts.who, () => this.blastRaw(at, opts)); }   // (what it throws is its cause's doing: fogofwar.ts FOG.ours)
  private blastRaw(at: Vec3, opts: BlastOpts): BlastResult {
    const g = this.g; const chaos = chaosOf(g); const res: BlastResult = { walls: 0, cover: 0, doors: 0, panes: 0, opened: 0, serial: this.walls.serial };
    if (chaos <= 0 || !DESTRUCTION.on) { if (opts.chaos !== false) this.bang(at, opts.who); return res; }   // (off: a caller that used to call bang() and now calls blast() — a grenade — gets exactly the bang() it had; at chaos 0 that returns on its first line)
    const power = opts.power ?? 1, radius = (opts.radius ?? WALLS.blast.radius) * power, who = opts.who || NOBODY_ID;
    const ev: BlastEvent = { at, radius, power, who, res };
    for (const fn of [...this.blastListeners]) fn(ev);
    const doors = (g.doors as unknown as { blast?: (at: Vec3, tearM: number, who: number) => unknown[] }).blast?.(at, radius * WALLS.blast.doorK, who); if (Array.isArray(doors)) res.doors += doors.length;   // (the doors goal's method: not on this build yet — optional, so the merge needs no edit here)
    if (wallBreakOn(g)) { const w = this.walls.blast(at, opts); res.walls = w.walls; res.cover = w.cover; res.opened = w.opened; }
    this.furn.blast(at, opts.chaos === false ? chargeSource(radius) : 'frag', who, chaos);   // the furniture round it (after the walls: a hole this blast opened lets it through; a charge that brings its own bang is a breaching charge — a wall's, or by its small radius a door's)
    if (opts.chaos !== false) (this.bang as (at: Vec3, who?: number, power?: number) => void).call(this, at, who, 2 * power);   // (the chaos part gives bang() a third argument, power: 1 = a stun charge, about 2 = a frag or a breaching charge; ignored until it lands)
    if (opts.chaos !== false) { this.pallBurst(at, radius / 2.5); messBurst(this.g, at, radius / 2.5); }   // (a burst that brings the lane's chaos — the hand grenade, the 40 mm, a bomb: its pall. A charge that brings its own bang calls its own: wallcharge.ts)
    res.serial = this.walls.serial;
    return res;
  }
  /** THE DOOR LEAVES a blast() here would take off their hinges, by blast()'s own gates and reach — nothing is touched. What a man reckoning his cover from a burst
   *  that has not gone off yet is told (frag.ts): a door it is about to take is no cover. */
  doorsFor(at: Vec3, opts: { radius?: number; power?: number } = {}): Door[] {
    const g = this.g; if (chaosOf(g) <= 0 || !DESTRUCTION.on) return [];
    return doorBlastReach(g, at, (opts.radius ?? WALLS.blast.radius) * (opts.power ?? 1) * WALLS.blast.doorK).map(x => x.d);
  }
  /** THE WALLS AND COVER a blast() here would open, by blast()'s own plan — nothing is touched (wallbreak.ts `wouldOpen`: what each row holds, and its limits).
   *  The twin of `doorsFor` for the same asker: a partition a burst is about to hole is no cover. Asked with the level as it stands, door leaves in — so ask it
   *  OUTSIDE any view that takes leaves out, and use the answer on the frame it was asked (the rows hold the wall's boxes of that frame). BY DESIGN it forecasts
   *  a plain burst only: no `breach` is passed, so an outer wall — which takes THE charge set on it — is never listed, and a wall charge's own hole is not this
   *  ask's (wallcharge.ts `settle` / `farFloor` are). Beside a door the same burst tears off the real blast can open a little other than this says: it takes
   *  doors first and its wall pass meets that leaf lying as a slab. [] wherever blast() opens no wall. */
  wallsFor(at: Vec3, opts: { radius?: number; power?: number } = {}): WallOpening[] {
    const g = this.g; if (chaosOf(g) <= 0 || !DESTRUCTION.on || !wallBreakOn(g)) return [];
    return this.walls.wouldOpen(at, { radius: opts.radius, power: opts.power });
  }
  /** Run `fn` with the level's LINE TESTS as they would be once `walls` — rows of `wallsFor` — had opened: what stands for each is nothing to a line for the
   *  call (NoShadow, as the engine hides a static), what would be left of it stands in its place among `col.dynamicBoxes`. Everything is put back before it
   *  returns, whatever `fn` throws; nothing is added to the world, no serial moves, the picture never sees it.
   *  FOR YES / NO LINES ONLY (`segmentBlocked`, `solidBlocked`, `shotBlocked`, and whether a `raycast` hit at all), and inside `fn` ask nothing else:
   *   · no feet, standing room or walks — `collideCircle` / `gather` skip the hidden boxes and never meet dynamic ones, so a listed wall is not there AT ALL
   *     to a body, and the walk grid still has it whole;
   *   · no sound route (`col.sound.propagate`, `hearPath`): its half-second cache would keep an answer made inside the view;
   *   · not the INDEX a `raycast` returns: a piece of `left` answers past the end of the frame's own dynamic boxes;
   *   · no query that EMPTIES `col.dynamicBoxes` for its own call (most 'leaves out' helpers do): the `left` pieces go with the leaves and the wall reads all
   *     open. One that FILTERS the list (frag.ts `withoutLeaves`) keeps them, and nests with this either way round — each puts back what it found. */
  withWallsOpen<T>(walls: readonly WallOpening[], fn: () => T): T {
    if (!walls.length) return fn();
    const col = this.g.col; const keep = col.dynamicBoxes; const was: [Box, number][] = []; const extra: Box[] = [];
    for (const w of walls) { for (const b of w.standing) { was.push([b, b.flags]); b.flags |= BoxFlag.NoShadow; } for (const b of w.left) extra.push(b); }
    col.dynamicBoxes = extra.length ? keep.concat(extra) : keep;
    try { return fn(); } finally { col.dynamicBoxes = keep; for (let i = was.length - 1; i >= 0; i--) was[i][0].flags = was[i][1]; }
  }
  /** FURNITURE UNDER A BLAST for a charge that does not come through blast() (combat.ts detonateStun's BORROWED bang: the door charge — and the wall charge's own,
   *  which lands on the frame blast() already ran and is merged there). Nothing with THE ONE SWITCH off or at chaos 0. */
  furnBlast(at: Vec3, src: BlastSource, who: number = NOBODY_ID) { const chaos = chaosOf(this.g); if (chaos > 0 && DESTRUCTION.on) this.furn.blast(at, src, who, chaos); }
  /** the flags static `i` was AUTHORED with if this lane has hidden it (its own items, the walls' boxes and what hung from them), else undefined */
  flags0(i: number): number | undefined { return this.hidden.get(i) ?? this.walls.flags0(i) ?? barFlags0(this.g, i); }   // (…or a window bar a round took: winbars.ts)
  /** Be told of every blast (the plain call list for whatever else a blast should reach): called first, before doors, glass and walls are judged. Returns the unsubscribe. */
  onBlast(fn: (b: BlastEvent) => void): () => void { this.blastListeners.push(fn); return () => { const i = this.blastListeners.indexOf(fn); if (i >= 0) this.blastListeners.splice(i, 1); }; }
  private blastListeners: ((b: BlastEvent) => void)[] = [];
  /** WALL BREAKING's hand on this lane's things: static `i` (one of the indexed destructibles) has lost what it stood on / hung from — a stack scatters, a screen dies
   *  and its housing goes, clutter drops; `quiet` (a checkpoint being applied) = just gone. false = not one of ours. */
  dropItem(i: number, dirn: Vec3, who: number = NOBODY_ID, quiet = false): boolean {
    const d = this.items.get(i); if (!d) return false; if (this.hidden.has(i)) return true;
    if (quiet) { if (d.target) this.breakTarget(d.target); this.hide(d); return true; }
    const chaos = Math.max(chaosOf(this.g), 0.25);
    if (d.kind === 'paper') { if (!this.convertPaper(d, dirn, 1.5, chaos)) this.hide(d); return true; }
    this.freeKnocks++;   // (a fall is not a knock off the per-second budget: the desk under it is gone)
    if (d.target) this.breakTarget(d.target);
    if (!this.knockOff(d, dirn, chaos, d.kind === 'binder' ? 'binder' : d.kind === 'clutter' ? 'clutter' : 'housing', who) && !this.hidden.has(i)) { if (d.target) this.breakTarget(d.target); this.hide(d); }
    return true;
  }
  /** …and a light fixture's box that fell with its wall / desk: its light goes with it (un-broken again by reset()) */
  breakFixtureBox(i: number) { for (const t of this.g.targets) if (t.boxes.includes(i) && !t.broken) { if (this.breakTarget(t)) this.g.audio.play('lightBreak', t.pos, 0.6); } }

  /** The stun charge went off at `at` (combat.ts detonateStun), thrown by `who` (blamed for what its knock-offs / tile / shoved chunks are heard doing): a lot of
   *  heat where it lies — the desk over it cleared, papers up in a wide ring, the tile above down, dust off the ceiling — all through the same capped paths.
   *  `stun` (the loud levels; only detonateStun's own canister passes it): the lights are judged by CHAOS.loud.stunFixtureM / stunPanels, not as a blast's. */
  bang(at: Vec3, who: number = NOBODY_ID, power = 1, stun = false) {
    const g = this.g; const chaos = chaosOf(g); if (chaos <= 0) return;
    if (!who) who = NOBODY_ID;   // (a sandbox-dropped can carries the item default 0 — the dropped-gun 'Sam's clatter' convention elsewhere; here nobody threw it)
    DESTR_STATS.bangs++;
    const loud = loudNow(g); const pw = loud ? Math.max(0.25, Math.min(4, power)) : 1; const reach = Math.sqrt(pw);   // `power` (the loud levels only): 1 = a stun charge; a bigger blast pours in more heat and reaches √power further
    const E = this.stoke(at, CHAOS.bangHeat * pw, chaos); this.anyHeat = true;
    // papers within a couple of metres, thrown out and up from the blast
    const list: Destructible[] = []; const wide: Destructible[] = [];
    const span = reach > 1 ? 2 * Math.ceil((2.6 * reach - 2) / 2) : 2;   // (power 1: the 3×3 cells round each of the nine points, as ever; a bigger blast gathers as far as it reaches)
    for (let dz = -span; dz <= span; dz += 2) for (let dx = -span; dx <= span; dx += 2) for (const d of this.near([at[0] + dx, at[1], at[2] + dz], list)) if (!wide.includes(d)) wide.push(d);
    const eye: Vec3 = [at[0], Math.max(at[1] + 0.3, 0.95), at[2]];   // (the blast's reach judged from just over desk height: a can on the floor still clears the desk it lies under the edge of)
    for (const d of wide) {
      const dd = v3.dist(d.box.c, at); const over = topOf(d.box);   // (aim OVER the thing, not at its centre: a segment ending inside a mug reports the mug as the wall in the way)
      if (d.kind === 'paper' && dd < 2.6 * reach && !g.col.solidBlocked(eye, over)) this.convertPaper(d, v3.normalize(v3.add(v3.sub(d.box.c, at), [0, 0.8, 0])), 2.5 + 2 * chaos, chaos);
      else if ((d.kind === 'clutter' || d.kind === 'binder' || d.kind === 'housing') && dd < 1.6 * reach && E >= CHAOS.tKnock && !g.col.solidBlocked(eye, over)) this.knockOff(d, v3.normalize(v3.sub(d.box.c, at)), chaos, d.kind === 'housing' ? 'housing' : d.kind === 'binder' ? 'binder' : 'clutter', who);
    }
    const panels = !stun || !loud || CHAOS.loud.stunPanels;   // (`stun`: the caller is a stun canister itself — combat.ts detonateStun — not a frag, nor a door or wall charge borrowing its report: the blast's rules for light fixtures, here and below, are not its own. What it knocks off a desk it still knocks off, a lit screen's housing with it)
    if (E >= CHAOS.tTile) { let ok = this.tileDrop(at, chaos, true, who, panels); if (loud) { const r0 = DESTR_STATS.tilesRefused; for (let k = 0; k < 3 && !ok && this.tileCount < CHAOS.tilesPerEncounter; k++) ok = this.tileDrop(at, chaos, true, who, panels); DESTR_STATS.tilesRefused = r0; } }   // (the loud levels: a charge under a wall's top course or a tall shelf tries the next squares — the ceiling over a blast answers when any square within one of it can)
    const roof = this.roofY(at[0], at[2]);
    if (roof !== null) { const cp: Vec3 = [at[0], roof - 0.15, at[2]]; if (loud) this.cellDust(cp, [0, -1, 0], 1.6, 'drywall'); else this.dustPuff(cp, [0, -1, 0], 1.6, 'drywall'); }   // the shock shakes dust out of the ceiling grid over it (there is no grid over the lot)
    if (loud) {   // the loud levels: …and off the floor round where it lay (over the next frames, inside the puff caps), and the fixtures it went off beside go dark
      this.dustBurst([at[0], Math.max(0.06, at[1]), at[2]], [0, 1, 0], Math.round(CHAOS.loud.blastDustPuffs * pw), CHAOS.loud.blastDustFloor * Math.min(1.5, reach), 'concrete', 0.5 * reach);
      const R = (stun ? CHAOS.loud.stunFixtureM : CHAOS.loud.fixtureBlastM) * reach;
      for (const t of g.targets) { const fire = fireHolds(t); if (!(fire || this.fixtureLive(t)) || v3.dist(t.pos, at) > R) continue; const to = v3.sub(t.pos, eye), L = v3.len(to);
        if (L > 0.3) { const hit = g.col.raycast(eye, v3.scale(to, 1 / L), L); if (hit && hit.t < L - 0.06 && !(hit.index !== undefined && t.boxes.includes(hit.index))) continue; }   // (the first solid thing on the line is the fixture itself, or nothing: a lamp on the far side of a partition stays lit)
        if (fire) fireStir(g, t); else this.killFixture(t, at, 'blast', true); }   // (fire.ts FIRE.hardy: a blast stirs a fire — a crack and a throw of embers — and does not put it out; a fire whose own box is blown away still goes with it, breakFixtureBox)
    }
    this.bangImpulse(at, eye, chaos, who);   // …and everything already lying within a few metres — the leaves of the LAST burst, the chips, the mug it knocked off before — goes up again
  }

  // ---------------------------------------------------------------- impulses (render/particles.ts impulse + debris.ts impulse; game/sheetModel.ts is the reference)
  /** The blast's push on what already lies about: one record over the GPU particles (radius CHAOS.imp.bang.radius, gated per particle by an occlusion ray from `eye`)
   *  and the same over the debris pool (gated by the sight test the stacks use). */
  private bangImpulse(at: Vec3, eye: Vec3, chaos: number, who: number) {
    const g = this.g; if (!impulsesOn(g)) return;
    const B = CHAOS.imp.bang; const strength = B.strength * impK(chaos);
    DESTR_STATS.impBang++;
    const P = gpuFx(g); if (P) P.impulse(at, B.radius, strength, { up: B.up, occlude: true, eye });
    DESTR_STATS.debrisKicked += this.debris.impulse({ pos: at, radius: B.radius, strength, up: B.up, bias: [0, 0, 0] }, p => g.col.solidBlocked(eye, [p[0], p[1] + 0.05, p[2]]), who);
  }
  /** A round stopped at `hitP` travelling `dir` in a face of normal `n`: the leaf beside the hole jumps and scoots on along the round's travel over that surface, a chunk
   *  within CHAOS.imp.impact.debrisM is nudged. Every solid hit, whatever the heat. */
  private impactImpulse(hitP: Vec3, dir: Vec3, n: Vec3, chaos: number, who: number) {
    const g = this.g; if (!impulsesOn(g)) return;
    const I = CHAOS.imp.impact; const strength = I.strength * impK(chaos);
    const dn = v3.dot(dir, n); const bias: Vec3 = [(dir[0] - n[0] * dn) * I.biasK, (dir[1] - n[1] * dn) * I.biasK, (dir[2] - n[2] * dn) * I.biasK];   // the round's travel along the surface (a grazing round scoots things further than a square one)
    const at = v3.mad(hitP, n, 0.03);
    DESTR_STATS.impImpact++;
    const P = gpuFx(g); if (P) P.impulse(at, I.radius, strength, { up: I.up, bias });
    if (this.debris.list.length) DESTR_STATS.debrisKicked += this.debris.impulse({ pos: at, radius: I.debrisM, strength, up: I.up, bias }, undefined, who);
  }
  /** Panel / hook / QA: the IMPULSE of a `kind` event at `at` alone — no heat, nothing converted, knocked off or dropped: only what already lies about moves (a bang's is
   *  judged for reach from just over desk height like the real one; an impact's takes `dir` as the round's travel and pushes off an up face). */
  testImpulse(at: Vec3, kind: 'bang' | 'impact' | 'thud' = 'bang', dir: Vec3 = [1, 0, 0], who: number = NOBODY_ID) {
    const chaos = chaosOf(this.g);
    if (kind === 'bang') this.bangImpulse(at, [at[0], Math.max(at[1] + 0.3, 0.95), at[2]], chaos, who);
    else if (kind === 'impact') this.impactImpulse(at, v3.normalize(dir), [0, 1, 0], chaos, who);
    else this.thud(at, 1, who);
  }
  /** A thump on the floor at `pos` — a body landing (game.ts bodyThud), a boot through a door (onDoorEvent 'kick'), furniture knocking into something (onPropEvent
   *  'thud'): the litter within a stride twitches. `scale` 0.5‥1.5 by how hard; `who` = whose thump it was (provenance only: a rocked chunk keeps its blame). Subtle by design; ≤ CHAOS.imp.thud.perFrame a frame. */
  thud(pos: Vec3, scale = 1, who: number = NOBODY_ID) {
    const g = this.g; if (!impulsesOn(g)) return;
    const T = CHAOS.imp.thud;
    if (this.thudsThisFrame >= T.perFrame) { DESTR_STATS.impThudDropped++; return; }
    this.thudsThisFrame++; DESTR_STATS.impThud++;
    const strength = T.strength * Math.max(0.5, Math.min(1.5, scale)) * impK(chaosOf(g));
    const at: Vec3 = [pos[0], Math.min(pos[1], 0.3) + 0.03, pos[2]];   // at the FLOOR under whatever reported it (a leaf's centre is a metre up, a prop's knock half its height, a trunk on a desk at desk height): the litter is on the floor, and desk-top leaves half a metre over a floored centre still twitch
    const P = gpuFx(g); if (P) P.impulse(at, T.radius, strength, { up: T.up });
    if (this.debris.list.length) DESTR_STATS.debrisKicked += this.debris.impulse({ pos: at, radius: T.radius * 0.5, strength, up: T.up, bias: [0, 0, 0] });   // (a thump rocks a chunk, it does not re-blame it: whoever put it there is still who is heard if it falls — `who` is only the record's provenance)
  }

  // ---------------------------------------------------------------- pieces
  private damageDecal(p: Vec3, n: Vec3, surf: Surf, box: Box, dynamic: boolean, rifle: boolean, item?: Destructible) {
    const g = this.g;
    let look = -1, r = 0.04, s = 0.75;
    if (item && (item.kind === 'screen' || item.kind === 'tv')) { look = 2; r = rifle ? 0.11 : 0.085; s = 0.9; }
    else if (surf === 'metal') { look = 0; r = rifle ? 0.045 : 0.036; s = rifle ? 0.9 : 0.7; }
    else if (surf === 'fabric') { look = 1; r = rifle ? 0.075 : 0.06; s = 0.85; }
    if (look < 0) return;
    if (box.flags & (BoxFlag.NoPrimary | BoxFlag.NoShadow) && look !== 2) return;
    const rj = this.hash(); if (!this.take('decal')) return;   // (the counter and the bucket move the same whether decals are drawn or not: a fight with decals off is the same fight — the identity probes)
    DESTR_STATS.decals++;
    if (!g.decals.enabled) return;
    g.decals.add('damage', p, n, r * (0.85 + 0.3 * rj), { param: look + Math.min(0.999, s), clampTo: box, attach: dynamic ? box : undefined });
  }

  /** a lit screen's light target out (the OCP / round rule's own bit: updateTargets takes its emissive and its markings' gain to 0 the same frame), remembered for reset() */
  private breakTarget(t: LightTarget): boolean { if (t.broken) return false;  const wasLit = t.interactive && (t.on || t.factor > 0); t.broken = true; this.broke.add(t); if (wasLit) this.g.lightEvent(t); return wasLit; }   // (→ whether a LIGHT went out: a dark / dead screen breaks silently — nobody notices a light that was not on, combat.ts's fixture rule)

  private killScreen(item: Destructible, hitP: Vec3, n: Vec3, byPlayer: boolean) {
    const g = this.g;
    const t = item.target;
    if (t && !t.broken) { const lit = this.breakTarget(t); g.audio.play('lightBreak', t.pos, lit ? 0.8 : 0.4); if (lit) { g.engine.lights.flash(t.pos, [0.6, 0.75, 1], 4, 3, 0.1, 0); dlog(g, `screen ${t.name} shot dead`); if (byPlayer) { g.msg(`shot out ${t.name}`); chronLightShot(g, t); } } }   // (the player's line and debrief row that combat.ts's near-miss rule would have written for a LIT screen — it skips a fixture already broken)
    DESTR_STATS.screens++;
    const P = gpuFx(g);
    if (P) P.emit('spark', v3.mad(hitP, n, 0.02), v3.normalize(v3.add(n, [0, 0.3, 0])), t ? 22 : 8, { speed: 3.5, speedJit: 0.7, spread: 1.2, life: 0.45, lifeJit: 0.5, size: 0.0028 });
  }

  /** paper stacks within reach of the hit point — or whose column of air over the desk the round passed through — become sheets */
  private papersNear(hitP: Vec3, dir: Vec3, E: number, chaos: number, k: number, segLen: number) {
    const list: Destructible[] = [];
    for (const d of this.near(hitP, list)) {
      if (d.kind !== 'paper') continue;
      const b = d.box; const dd = Math.hypot(b.c[0] - hitP[0], (b.c[1] - hitP[1]) * 0.5, b.c[2] - hitP[2]);
      let hitIt = dd < CHAOS.paperReachM * (0.6 + 0.4 * Math.min(1, E / 3)) && !this.g.col.solidBlocked(v3.mad(hitP, dir, -0.05), [b.c[0], b.c[1] + b.h[1] + 0.05, b.c[2]]);   // (near, and not through the partition the round stopped in: the stack on the far desk stays)
      if (!hitIt) {   // the segment through the air just over the stack (the round itself never meets a NoShadow slab): closest approach of the ray to the stack's centre
        const to = v3.sub(b.c, hitP); const along = -v3.dot(to, dir);   // (hitP is the END of the segment; walk back along −dir)
        if (along > 0 && along < segLen) {   // (inside the segment the round actually flew: a stack behind the muzzle stays put)
          const q = v3.mad(hitP, dir, -along);
          if (Math.hypot(q[0] - b.c[0], q[2] - b.c[2]) < Math.max(b.h[0], b.h[2]) + 0.06 && q[1] > b.c[1] - 0.05 && q[1] < b.c[1] + 0.35) hitIt = true;
        }
      }
      if (!hitIt) continue;
      const away = v3.normalize([b.c[0] - hitP[0] + dir[0] * 0.6, 0.9, b.c[2] - hitP[2] + dir[2] * 0.6]);
      this.convertPaper(d, away, (1.6 + 0.5 * Math.min(3, E)) * (0.8 + 0.3 * k), chaos);
    }
  }
  /** hide the stack's box and throw its sheets: `dirn` = mean throw direction, `speed` m/s */
  private convertPaper(d: Destructible, dirn: Vec3, speed: number, chaos: number): boolean {
    const g = this.g; if (this.hidden.has(d.i) || !this.take('paper')) return false;
    this.hide(d);
    DESTR_STATS.papers++; dlog(g, `paper ${d.i} scattered`);
    const P = gpuFx(g); const b = d.box;
    const count = Math.round(CHAOS.sheetsPerStack * Math.min(1.6, Math.max(0.5, (b.h[0] * b.h[2]) / (0.11 * 0.15))) * (0.7 + 0.6 * chaos));
    DESTR_STATS.sheets += count;
    if (!P) return true;
    const w = Math.min(0.22, Math.max(0.12, 2 * Math.min(b.h[0], b.h[2]) * 0.95)); const asp = Math.max(1, Math.max(b.h[0], b.h[2]) / Math.max(0.04, Math.min(b.h[0], b.h[2])));
    const pj = Math.max(b.h[0], b.h[2]) * 0.8;
    P.emit('sheet', [b.c[0], b.c[1] + b.h[1] + pj + 0.02, b.c[2]], dirn, count, { shape: 'cone', spread: 0.9, speed, speedJit: 0.75, life: 60, lifeJit: 0.25, size: w, sizeJit: 0.06, aspect: Math.min(1.5, asp), tumble: 5 + 4 * chaos, nrmJit: 0.55, posJit: pj, color: v3.copy(b.albedo) });   // (born in a box sitting ON the stack: the emit kernel's jitter is isotropic, and a leaf born inside the desk slab is culled)
    // a little puff of the dust that lay on it
    emitDust(P, [b.c[0], b.c[1] + 0.08, b.c[2]], [0, 1, 0], 3, { shape: 'puff', speed: 0.6, speedJit: 0.5, lift: 0.2, life: 1.2, lifeJit: 0.3, size: 0.12, sizeJit: 0.3, posJit: 0.1, color: [0.7, 0.68, 0.64] });
    return true;
  }
  private hide(d: Destructible) { const b = this.g.col.boxes[d.i]; this.hidden.set(d.i, b.flags); b.flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow; if (d.mate !== undefined && d.kind === 'housing') { const s = this.g.col.boxes[d.mate]; if (!this.hidden.has(d.mate)) { this.hidden.set(d.mate, s.flags); s.flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow; } }
    this.g.smoke.obstaclesChanged?.(b.c, Math.hypot(b.h[0], b.h[1], b.h[2]) + 0.6); }   // the smoke solver's obstacle field round it is stale now (the thing, and a housing's screen 0.3 m off, are no longer solid): live bricks there re-bake (smoke.ts)

  /** the escalated material burst on top of impactFx's: splinters (long chips) off wood / laminate / cardboard, gypsum dust + chips off plaster, fluff off fabric,
   *  a bigger spark shower off metal, grit off concrete — scaled by E, × the rifle factor */
  /** the escalated burst by hand at a point on an up-facing surface (Tab ▸ Effects ▸ Dust puffs 'drywall burst': what sustained fire into that material throws, at tier +1.5) — effects only, no heat, no marks */
  testBurst(at: Vec3, surf: Surf = 'drywall', albedo: Vec3 = [0.82, 0.8, 0.76]) { this.burst(at, [0, -1, 0], [0, 1, 0], surf, albedo, CHAOS.tBurst + 1.5, 1, 0); }
  private burst(hitP: Vec3, dir: Vec3, n: Vec3, surf: Surf, albedo: Vec3, E: number, k: number, owner: number) {
    const P = gpuFx(this.g); DESTR_STATS.bursts++; if (!P) return;
    const s = Math.min(3, 0.5 + 0.5 * (E - CHAOS.tBurst)) * k;
    const at = v3.mad(hitP, n, 0.015); const dn = v3.dot(dir, n); const refl = v3.normalize(v3.sub(dir, v3.scale(n, 2 * dn)));
    const out = v3.normalize(v3.add(n, v3.scale(refl, 0.35)));
    if (surf === 'wood' || surf === 'cardboard') {
      P.emit('debris', at, out, Math.round(7 * s), { speed: 2.4, speedJit: 0.7, spread: 0.9, life: 20, lifeJit: 0.3, size: 0.0055, sizeJit: 0.4, aspect: 3.2, color: surf === 'wood' ? [0.66, 0.52, 0.34] : v3.copy(albedo), owner });
      emitDust(P, v3.mad(hitP, n, 0.07), n, Math.round(1 + s), { shape: 'puff', speed: 0.3, speedJit: 0.5, lift: 0.25, life: 1.0, lifeJit: 0.3, size: 0.11, sizeJit: 0.35, posJit: 0.06, vadd: v3.scale(n, 0.2), color: [0.62, 0.54, 0.42] });   // (08-12: fewer, slower, shorter puffs that rise a little where the round went in — the solver's puff carries the volume; a ring of discs sailing out read fake)
    } else if (surf === 'drywall') {
      P.emit('debris', at, out, Math.round(8 * s), { speed: 2.0, speedJit: 0.7, spread: 1.1, life: 18, lifeJit: 0.3, size: 0.008, sizeJit: 0.6, color: v3.lerp(albedo, [0.86, 0.85, 0.82], 0.55), owner });
      emitDust(P, v3.mad(hitP, n, 0.08), n, Math.round(2 + s), { shape: 'puff', speed: 0.35, speedJit: 0.5, lift: 0.25, life: 1.2, lifeJit: 0.3, size: 0.13, sizeJit: 0.35, posJit: 0.08, vadd: v3.scale(n, 0.25), color: [0.82, 0.8, 0.76] });
    } else if (surf === 'fabric') {
      emitDust(P, v3.mad(hitP, n, 0.05), out, Math.round(9 * s), { shape: 'cone', spread: 1.0, speed: 1.3, speedJit: 0.7, life: 2.6, lifeJit: 0.4, size: 0.022, sizeJit: 0.5, posJit: 0.03, color: v3.lerp(albedo, [0.8, 0.78, 0.72], 0.5) });   // fluff: small slow motes of the covering
      P.emit('debris', at, out, Math.round(3 * s), { speed: 1.5, speedJit: 0.7, spread: 1.0, life: 14, lifeJit: 0.3, size: 0.006, sizeJit: 0.5, aspect: 2, color: v3.copy(albedo), owner });
    } else if (surf === 'metal') {
      P.emit('spark', at, v3.normalize(v3.add(v3.scale(refl, 0.6), v3.scale(n, 0.4))), Math.round(14 * s), { speed: 6.5, speedJit: 0.6, spread: 1.0, life: 0.42, lifeJit: 0.4, size: 0.003 });
    } else if (surf === 'concrete') {
      P.emit('debris', at, out, Math.round(6 * s), { speed: 2.2, speedJit: 0.7, spread: 1.0, life: 18, lifeJit: 0.3, size: 0.007, sizeJit: 0.5, color: [0.45, 0.44, 0.42], owner });
      emitDust(P, v3.mad(hitP, n, 0.08), n, Math.round(1 + s), { shape: 'puff', speed: 0.3, speedJit: 0.5, lift: 0.25, life: 1.1, lifeJit: 0.3, size: 0.12, sizeJit: 0.35, posJit: 0.06, vadd: v3.scale(n, 0.2), color: [0.55, 0.54, 0.52] });
    } else if (surf === 'glass') {
      P.emit('debris', at, out, Math.round(6 * s), { speed: 2.0, speedJit: 0.7, spread: 1.0, life: 16, lifeJit: 0.3, size: 0.005, sizeJit: 0.5, color: [0.1, 0.11, 0.12], owner });
    }
  }

  /** A cold short cloud of dust into the smoke solver at p, thrown along n: real density (σt like any smoke), on the coarse lattice. Bounded: ≤ puffsPerFrame a
   *  frame, ≤ puffsPerSec a second, and only while the solver's own emitter budget has slack. Returns whether it went. */
  dustPuff(p: Vec3, n: Vec3, scale: number, surf: Surf): boolean {
    const g = this.g;
    if (this.puffsThisFrame >= CHAOS.puffsPerFrame || (g.smoke.budget ? g.smoke.budget() : 8) < 4 || !this.take('puff')) { DESTR_STATS.puffsRefused++; return false; }   // (WHERE dust may be is not rationed here: the solver has one pool for the whole level, and who gives way when it runs short is its own business)
    this.puffsThisFrame++; DESTR_STATS.puffs++;
    const K = CHAOS.puff; const dens = K.density * (surf === 'drywall' ? 1 : surf === 'concrete' ? 0.7 : surf === 'fabric' ? 0.35 : 0.5) * Math.min(2, scale);
    const dir = v3.normalize([n[0], n[1] + 0.25, n[2]]);
    g.smoke.emit({ pos: v3.mad(p, n, 0.1), dir, speed: K.speed, radius: K.radius * Math.sqrt(scale), density: dens, temperature: K.temp, ttl: K.ttl, age: 0, kind: 'puff', push: K.push, expand: K.expand, attack: 0.03, jitter: 0.35, lattice: 'coarse', prio: 0, minVoxels: 2, anchor: v3.mad(p, n, 0.6), tint: DESTRUCTION.on ? dustTint(surf) : undefined });
    return true;
  }

  // ---------------------------------------------------------------- a blast's pall (CHAOS.pall)
  private pallAt: number[] = [];   // (the moments of the last palls: the allowance)
  /** may one more pall go now (the rule on, the switch on, chaos up, no show running, the window not full)? Counts it when it may. `always`: the wall charge's —
   *  the player's own set piece is never the one the window refuses, and still counts in it. */
  private pallTake(always = false): boolean {
    const g = this.g, K = CHAOS.pall; if (!K.on || !DESTRUCTION.on || this.showChaos !== null || chaosOf(g) <= 0) return false;   // (a level script's show keeps the picture its cameras were set on: no pall under a Director program's own chaos)
    this.pallAt = this.pallAt.filter(t => g.time - t < K.windowSecs && t <= g.time);
    if (!always && this.pallAt.length >= K.perWindow) { PALL_STATS.refused++; return false; }
    this.pallAt.push(g.time); PALL_STATS.palls++; return true;
  }
  /** the pall's dice: a hash of the place, the moment and `k` — none of the lane's own are drawn */
  private pallHash(at: Vec3, k: number): number { return hash01((Math.imul(Math.round(at[0] * 64), 73856093) ^ Math.imul(Math.round(at[2] * 64), 19349663) ^ Math.imul(Math.round(this.g.time * 60), 83492791) ^ Math.imul(k + 1, 2654435761)) >>> 0); }
  /** One emitter of a pall into the solver; whether the solver was asked for it. WHERE IT MAY STAND: the solver lays an emitter down as a gaussian with no
   *  regard for what stands between (it masks the solid cells and nothing more), so a wide one beside a thin wall would lay its dust in the next room. So a place
   *  with something solid between it and `from` is mirrored through `from` into the room the blast is in — and left out where that is shut too (never moved
   *  onto `from`: a ring's blocked half would all land on the one spot and stack there); it is then pushed off whatever stands within `clear` radii of it
   *  (eight ways, twice, judged over the furniture — `clearY`, or its own height where that is higher — and never into what stands at its own height); and
   *  where it still has no such room its radius comes down, to `minRadius` of its own at the least, its density up for it (never past `maxGain`): by a wall
   *  the pall is a tighter, thicker knot that the solver then carries on into the room it is in. */
  private pallEmit(R: { radius: number; density: number; ttl: number; speed: number; temp: number; push: number; expand: number }, from: Vec3, pos: Vec3, dir: Vec3, j: number, tint: Vec3, gain = 1): boolean {
    const g = this.g, K = CHAOS.pall; if ((g.smoke.budget?.() ?? 64) < K.slack) { PALL_STATS.starved++; return false; }
    let p: Vec3 = v3.copy(pos), d = dir;
    if (g.col.solidBlocked(from, p)) { p = [2 * from[0] - pos[0], pos[1], 2 * from[2] - pos[2]]; d = [-dir[0], dir[1], -dir[2]]; if (g.col.solidBlocked(from, p)) { PALL_STATS.shut++; return false; } }
    p[1] = Math.max(0.2, p[1]); const Y = Math.max(K.clearY, p[1]);
    const near = (r: number) => PALL_DIRS.filter(w => g.col.solidBlocked([p[0], Y, p[2]], [p[0] + w[0] * r, Y, p[2] + w[1] * r]));
    for (let round = 0; round < 2; round++) for (const w of near(R.radius * K.clear)) { const qx = p[0] - w[0] * R.radius * 0.5, qz = p[2] - w[1] * R.radius * 0.5; if (!g.col.solidBlocked([p[0], Y, p[2]], [qx, Y, qz]) && !g.col.solidBlocked(p, [qx, p[1], qz])) { p[0] = qx; p[2] = qz; } }
    let radius = R.radius; while (radius > R.radius * K.minRadius && near(radius * K.clear).length) radius = Math.max(R.radius * K.minRadius, radius * 0.8);
    const ttl = R.ttl * (0.8 + 0.4 * j), density = R.density * gain * Math.min(K.maxGain, Math.pow(R.radius / radius, 1.5));
    g.smoke.emit({ pos: p, dir: d, speed: R.speed * (0.75 + 0.5 * j), radius, density, temperature: R.temp, ttl, age: 0, kind: 'puff', push: R.push, expand: R.expand, attack: 0.05, jitter: 0.35, lattice: 'coarse', prio: 1, minVoxels: 3, tint });
    PALL_STATS.emitters++; return true;
  }
  /** A WALL CHARGE'S PALL: `p` on the wall's face at the charge (the floor), `n` off that face toward the charge's side, `t` along the wall, the wall `thick` m,
   *  `through` whether the blast opened a way through (the far side's part goes only then); `gain` on the density asked of the solver and on the picture's own
   *  dust with it (the charge's WALLSHOT.pall: 1 = the table's own). Called once by the charge (wallcharge.ts blow). */
  pallWall(p: Vec3, n: Vec3, t: Vec3, thick: number, through: boolean, surf: Surf = 'drywall', gain = 1) {
    if (!this.pallTake(true)) return; const K = CHAOS.pall, R = K.wall, tint = dustTint(surf), P = gpuFx(this.g);
    for (const side of [1, -1]) {
      if (side < 0 && !through) break; const N = side > 0 ? R.near : R.far, base = v3.mad(p, n, side > 0 ? 0.08 : -(thick + 0.08)), nn = v3.scale(n, side); let took = 0;
      if (K.solver) for (let k = 0; k < N; k++) {
        const j = this.pallHash(p, k * 2 + (side > 0 ? 0 : 41)), j2 = this.pallHash(p, k * 2 + (side > 0 ? 1 : 42)), du = N > 1 ? (k / (N - 1) - 0.5) * 2 * R.spread : 0;
        const pos: Vec3 = [base[0] + nn[0] * R.out * (0.6 + 0.8 * j2) + t[0] * du, 0.45 + 1.1 * j, base[2] + nn[2] * R.out * (0.6 + 0.8 * j2) + t[2] * du];
        if (this.pallEmit(R, [base[0] + nn[0] * 0.1, 1.0, base[2] + nn[2] * 0.1], pos, v3.normalize([nn[0] + t[0] * du * 0.35, 0.3, nn[2] + t[2] * du * 0.35]), j2, tint, gain)) took++;
      }
      const count = Math.round(R.dust[side > 0 ? 0 : 1] * gain);   // (the picture's own layer goes with the solver's part or — its part switched off — alone; never over a solver that took none of it: a cloud nobody is hidden by)
      if (P && count > 0 && (took > 0 || !K.solver)) PALL_STATS.dust += emitDust(P, [base[0] + nn[0] * 0.3, 0.9, base[2] + nn[2] * 0.3], v3.normalize([nn[0], 0.25, nn[2]]), count, { shape: 'puff', speed: R.dustSpeed, speedJit: 0.7, lift: 0.12, life: R.dustLife, lifeJit: 0.35, size: R.dustSize, sizeJit: 0.4, posJit: 0.6, color: v3.scale(tint, 0.8) });
    }
  }
  /** A BURST'S PALL: the dust it kicks up in a ring round `at` and the smoke that stands over it; `size` 1 = the hand grenade's. Called by blast(). */
  pallBurst(at: Vec3, size = 1) {
    if (!this.pallTake()) return; const K = CHAOS.pall, R = K.burst, s = Math.max(0.6, Math.min(1.6, size)), tint = dustTint('concrete'), P = gpuFx(this.g);
    const c: Vec3 = [at[0], Math.max(0.3, at[1]), at[2]], ring = Math.max(0, Math.round(R.ring * s)), a0 = this.pallHash(at, 97) * Math.PI * 2; let took = 0;
    if (K.solver) {
      for (let k = 0; k < ring; k++) {
        const j = this.pallHash(at, k * 2), j2 = this.pallHash(at, k * 2 + 1), a = a0 + (k + 0.5 * j) * Math.PI * 2 / ring, d: Vec3 = [Math.sin(a), 0, Math.cos(a)], r = R.spread * s * (0.7 + 0.6 * j2);
        if (this.pallEmit(R, c, [c[0] + d[0] * r, c[1] + 0.1 + 0.5 * j, c[2] + d[2] * r], v3.normalize([d[0], 0.45, d[2]]), j2, tint)) took++;
      }
      if (this.pallEmit({ ...R, temp: R.temp * 2.5 }, c, [c[0], c[1] + 0.45, c[2]], [0, 1, 0], this.pallHash(at, 201), R.smoke, R.coreGain)) took++;   // the darker column over it: the charge's own smoke
    }
    if (P && R.dust > 0 && (took > 0 || !K.solver)) PALL_STATS.dust += emitDust(P, [c[0], c[1] + 0.2, c[2]], [0, 1, 0], Math.round(R.dust * s), { shape: 'puff', speed: R.dustSpeed, speedJit: 0.8, lift: 0.18, life: R.dustLife, lifeJit: 0.35, size: R.dustSize, sizeJit: 0.4, posJit: 0.5 * s, color: v3.scale(tint, 0.75) });
  }

  /** A broken wall / cover CELL's dust (wallbreak.ts shed): the puff now when this frame's and this second's caps allow, else it WAITS in the burst queue below — a
   *  blast opens several cells on one frame and two puffs a frame would lose the rest. No dice drawn either way (one cell broken by fire is the puff it always was). */
  cellDust(p: Vec3, n: Vec3, scale: number, surf: Surf) {
    if (chaosOf(this.g) <= 0) return;
    const r0 = DESTR_STATS.puffsRefused; if (this.dustPuff(p, n, scale, surf)) return;
    if (this.dustQueue.length >= CHAOS.loud.burstQueue) return;   // (counted refused by dustPuff)
    DESTR_STATS.puffsRefused = r0; this.dustQueue.push({ p: v3.copy(p), n: v3.copy(n), scale, surf, t: this.g.time }); this.anyHeat = true;
  }

  /** A LOT of dust from one event — a blast, a wall or a piece of cover coming apart: `count` puffs scattered within `spread` metres of `at` (across the plane normal to
   *  `n`), thrown along `n`, let out over the next frames as the puff caps allow (≤ puffsPerFrame a frame, ≤ puffsPerSec a second — the same caps as every other puff; the
   *  queue holds CHAOS.loud.burstQueue and forgets what has waited burstSecs). Nothing at chaos 0. The seam for whatever else breaks things: one call, bounded here. */
  dustBurst(at: Vec3, n: Vec3, count: number, scale: number, surf: Surf, spread = 0.5) {
    const g = this.g; if (chaosOf(g) <= 0) return;
    const nn = v3.normalize(n); const a: Vec3 = Math.abs(nn[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; const u = v3.normalize(v3.cross(nn, a)), w = v3.cross(nn, u);
    for (let k = 0; k < count; k++) {
      const r = spread * Math.sqrt(this.hash()), th = this.hash() * Math.PI * 2;   // (the dice move whether or not the queue has room: the same events are the same fight)
      if (this.dustQueue.length >= CHAOS.loud.burstQueue) { DESTR_STATS.puffsRefused++; continue; }
      const p = v3.add(at, v3.add(v3.scale(u, Math.cos(th) * r), v3.scale(w, Math.sin(th) * r))); p[1] = Math.max(0.06, p[1]);
      this.dustQueue.push({ p, n: nn, scale, surf, t: g.time });
    }
    this.anyHeat = true;   // (update() runs on while anything waits)
  }

  /** small statics near the hit come off the desk */
  private clutterNear(hitP: Vec3, dir: Vec3, chaos: number, who: number) {
    const list: Destructible[] = [];
    for (const d of this.near(hitP, list)) {
      if (d.kind !== 'clutter' && d.kind !== 'binder') continue;
      const b = d.box; if (Math.hypot(b.c[0] - hitP[0], (b.c[1] - hitP[1]) * 0.7, b.c[2] - hitP[2]) > CHAOS.knockReachM + Math.max(b.h[0], b.h[2])) continue;
      if (this.g.col.solidBlocked(v3.mad(hitP, dir, -0.05), topOf(b))) continue;   // (not through the partition the round stopped in)
      this.knockOff(d, v3.normalize([b.c[0] - hitP[0] + dir[0] * 0.5, 0, b.c[2] - hitP[2] + dir[2] * 0.5]), chaos, d.kind === 'binder' ? 'binder' : 'clutter', who);
    }
  }
  /** hide the static and hand its box to the debris pool with a shove along `dirn`, its landing blamed on `who`; over the pool's cap it becomes a burst of chips instead (Control's demotion) */
  private knockOff(d: Destructible, dirn: Vec3, chaos: number, kind: ChunkKind, who: number = NOBODY_ID): boolean {
    const g = this.g; if (this.hidden.has(d.i) || !this.take('knock')) return false;
    const b = d.box;
    const vK = CHAOS.velLow * (chaos <= 0.5 ? 1 : 1 + (CHAOS.velHighK - 1) * (chaos - 0.5) * 2);
    const hz = v3.normalize([dirn[0], 0, dirn[2]]);
    const v: Vec3 = [hz[0] * vK * (0.8 + 0.6 * this.hash()), Math.sqrt(vK) * (0.9 + 0.8 * this.hash()), hz[2] * vK * (0.8 + 0.6 * this.hash())];   // (the hop grows slower than the shove: kinetic, not launched)
    const w: Vec3 = [(this.hash() - 0.5) * 10 * vK, (this.hash() - 0.5) * 6, (this.hash() - 0.5) * 10 * vK];
    const c = this.debris.spawn(kind, b, v, w, who);
    this.hide(d);
    if (!c) {   // the pool is full of moving chunks: the thing still goes (it is hidden) but as a burst of chips of its colour
      DESTR_STATS.knocksDemoted++;
      const P = gpuFx(g); if (P) P.emit('debris', v3.copy(b.c), v3.normalize([hz[0], 1, hz[2]]), 24, { speed: 2.5, speedJit: 0.7, spread: 1.2, life: 16, lifeJit: 0.3, size: Math.max(0.008, Math.min(b.h[0], b.h[1], b.h[2]) * 0.6), sizeJit: 0.5, aspect: 1.5, posJit: Math.min(b.h[0], b.h[2]), color: v3.copy(b.albedo) });
    }
    if (kind === 'housing' && d.target) this.breakTarget(d.target);   // (chunk or chip burst, the light is off the desk either way)
    DESTR_STATS.knocks++; dlog(g, `${kind} ${d.i} knocked off${c ? '' : ' (demoted)'}`);
    if (d.group) for (const oi of d.group) { const o = this.items.get(oi); if (o && !this.hidden.has(oi)) { this.freeKnocks++; this.knockOff(o, dirn, chaos, o.kind === 'binder' ? 'binder' : 'clutter', who); } }   // (its group rides on the same slot: a pot and its plant are one thing to the cap)
    return true;
  }

  /** A tile of the ceiling grid over `p` lets go (one per 0.6 m square per encounter, ≥ tileGapSecs apart, ≤ tilesPerEncounter): a slab spawned just under the
   *  ceiling with a slight tilt rate, a crumb burst, dust off the grid (particles + a smoke puff), the knock when it lands (debris.ts) blamed on `who`. Indoors only. */
  private tileDrop(p: Vec3, chaos: number, force = false, who: number = NOBODY_ID, panels = true): boolean {
    const g = this.g;
    if (!force && g.time - this.lastTileT < CHAOS.tileGapSecs) return false;
    if (this.tileCount >= CHAOS.tilesPerEncounter) { DESTR_STATS.tilesRefused++; return false; }
    if (this.roofY(p[0], p[2]) === null) return false;
    // the square over the beaten spot, jittered a square either way so a long burst walks the drops about
    const jx = Math.round((this.hash() - 0.5) * 2.4), jz = Math.round((this.hash() - 0.5) * 2.4);
    const tx = Math.floor(p[0] / 0.6) + jx, tz = Math.floor(p[2] / 0.6) + jz; const key = `${tx},${tz}`;
    if (this.tilesDown.has(key)) return false;
    const cx = (tx + 0.5) * 0.6, cz = (tz + 0.5) * 0.6; const roof = this.roofY(cx, cz);
    if (roof === null) return false;   // (the jitter walked it out through the wall)
    const top = DESTRUCTION.on ? Math.max(roof, this.roofY(p[0], p[2]) ?? roof) : WORLD.ceilingY; const y = top - 0.03;   // (the switch on: the slab's own underside there — a light panel hanging in the square answers the roof ray 4 cm low, so the higher of the square's and the beaten spot's)
    { const n = g.col.gather(cx - 0.29, cz - 0.29, cx + 0.29, cz + 0.29, top - 0.14, top - 0.001, this.gatherScratch);   // anything in the tile's own slot under the slab — a light panel's box, a wall's top course: that square is not a free tile (the beacons' bases are NoShadow: invisible here, and harmless — nothing rasterises or traces them)
      for (let k = 0; k < n; k++) {   // (gather is cell-granular: re-test the footprint, or every square sharing a metre cell with a panel would be refused)
        const b = g.col.boxes[this.gatherScratch[k]]; const ac = Math.abs(Math.cos(b.yaw)), as = Math.abs(Math.sin(b.yaw)); const ex = ac * b.h[0] + as * b.h[2], ez = as * b.h[0] + ac * b.h[2];
        if (Math.abs(b.c[0] - cx) < ex + 0.29 && Math.abs(b.c[2] - cz) < ez + 0.29) {
          if (panels && loudNow(g)) { const t = this.targetOfBox.get(this.gatherScratch[k]); if (t && this.fixtureLive(t)) { const ok = this.killFixture(t, p, 'shaken', force); if (ok) this.lastTileT = g.time; return ok; } }   // (a shaken panel is the ceiling's answer: it takes the tile gap like a tile)   // the loud levels: the square is a light panel's — no tile lets go there, the PANEL does (its tube out, its glass down): the ceiling has answered
          return false;
        }
      } }
    if (g.col.solidBlocked([cx, y - 0.05, cz], [cx, y - 0.6, cz])) return false;   // …nor with something standing right under it
    const T = CHAOS.tile;
    const box: Box = { c: [cx, y, cz], h: v3.copy(T.half), yaw: 0, albedo: v3.copy(T.albedo), emissive: [0, 0, 0], flags: BoxFlag.Dynamic, owner: 0, cutHeight: 1e6 };
    const c = this.debris.spawn('tile', box, [(this.hash() - 0.5) * 0.4, -0.2, (this.hash() - 0.5) * 0.4], [(this.hash() - 0.5) * 3, (this.hash() - 0.5) * 1, (this.hash() - 0.5) * 3], who);
    if (!c) { DESTR_STATS.tilesRefused++; return false; }
    this.tilesDown.add(key); this.lastTileT = g.time; this.tileCount++; DESTR_STATS.tiles++; dlog(g, `tile ${key} dropped`);
    const P = gpuFx(g);
    if (P) {
      P.emit('debris', [cx, y - 0.05, cz], [0, -1, 0], 18, { speed: 1.2, speedJit: 0.8, spread: 1.3, life: 20, lifeJit: 0.3, size: 0.009, sizeJit: 0.6, posJit: 0.25, color: [0.8, 0.79, 0.75] });   // crumbs of the tile's edge
      emitDust(P, [cx, y - 0.12, cz], [0, -1, 0], 10, { shape: 'puff', speed: 0.7, speedJit: 0.5, lift: -0.3, life: 2.2, lifeJit: 0.3, size: 0.2, sizeJit: 0.35, posJit: 0.3, color: [0.78, 0.76, 0.72] });
    }
    this.dustPuff([cx, y - 0.2, cz], [0, -1, 0], 1.4, 'drywall');
    return true;
  }

  // ---------------------------------------------------------------- fixtures under fire (the loud levels: the destruction switch on)
  /** a fixture a stray round, a blast or a shaken ceiling can put out: a lit, interactive lamp or panel — never the breaker (a blackout stays somebody's decision), never a
   *  device (cameras and beam emitters die by devices.ts's own rules), never scenery, never one already dead */
  private fixtureLive(t: LightTarget): boolean { return !t.broken && t.interactive && (t.kind === 'emissive' || t.kind === 'analytic') && (t.on || t.factor > 0 || lampGlass(t)) && !fireHolds(t); }   // (carlamps.ts: a vehicle's lamp is glass whether it burns or not — the same word the player's own round is given, combat.ts)
  /** put `t` out: the light target's own broken bit (updateTargets takes its light and its emissive the same frame; guards with a line to it notice — lighting.ts
   *  lightEvent), the tube's glass coming down, counted against the encounter's cap (`force`: a blast ignores the gap, not the cap). Returns whether it went. */
  private killFixture(t: LightTarget, from: Vec3, why: string, force = false): boolean {
    const g = this.g; const L = CHAOS.loud;
    if (this.fixtureCount >= L.fixturesPerEncounter || (!force && g.time - this.lastFixtureT < L.fixtureGapSecs)) { DESTR_STATS.fixturesRefused++; return false; }
    if (!this.breakTarget(t)) { if (lampGlass(t) && t.broken) { g.audio.play('lightBreak', t.pos, 0.8); lensShatterFx(g, t, from); dlog(g, `lens ${t.name} broken (${why})`); } return false; }   // (carlamps.ts: a vehicle's dark lens — its glass and its sound, and no light gone out: not counted, nobody told)
    this.fixtureCount++; this.lastFixtureT = g.time; DESTR_STATS.fixtures++; dlog(g, `fixture ${t.name} out (${why})`);
    g.engine.lights.flash(t.pos, [0.7, 0.8, 1], 6, 4, 0.12, 0); g.audio.play('lightBreak', t.pos, 1); if (lampGlass(t)) lensShatterFx(g, t, from); else fixtureShatterFx(g, t, from);
    return true;
  }
  /** A round that is NOT the player's flew muzzle → muzzle + dir × tHit and stopped in static `index` (combat.ts fireWeapon, only with the switch on — the player's own
   *  aim-assisted rule stands beside it untouched): a fixture whose box it stopped in, or that its flight passed within CHAOS.loud.fixtureHitM of, goes dark. */
  fixtureRound(muzzle: Vec3, dir: Vec3, tHit: number, index: number | undefined) {
    const g = this.g; if (!loudNow(g) || chaosOf(g) <= 0) return;
    if (index !== undefined && index < 1e6) { const t = this.targetOfBox.get(index); if (t && fireHolds(t)) { fireStir(g, t); return; } if (t && this.fixtureLive(t)) { this.killFixture(t, muzzle, 'round'); return; }
      const at = v3.mad(muzzle, dir, tHit), fire = g.targets.find(x => fireHolds(x) && fireStruck(g, x, at, index)); if (fire) { fireStir(g, fire); return; } }   // (… or in the drum it burns in, which is no box of the fire's)
    const R = CHAOS.loud.fixtureHitM;
    for (const t of g.targets) {
      if (!this.fixtureLive(t)) continue;
      const toT = v3.sub(t.pos, muzzle); const depth = v3.dot(toT, dir); if (depth < 0 || depth > tHit + R) continue;
      const along = Math.min(depth, tHit); if (v3.len(v3.sub(toT, v3.scale(dir, along))) < R) { this.killFixture(t, muzzle, 'round'); return; }
    }
  }

  summary(): string {
    const s = DESTR_STATS; const inv = this.inventory();
    const P = gpuFx(this.g); const ps = P ? ` · particle impulses ${P.stats.impQueued} queued / ${P.stats.impMerged} merged / ${P.stats.impDropped} dropped, ${P.stats.kicked} kicks` : '';
    return `chaos ${chaosOf(this.g).toFixed(2)}${impulsesOn(this.g) ? '' : ' (impulses off)'} · heat max ${Math.max(0, ...this.heat).toFixed(1)} · ${this.debris.summary()} · papers ${s.papers} (${s.sheets} sheets) · puffs ${s.puffs} (−${s.puffsRefused}) · knocks ${s.knocks} (${s.knocksDemoted} demoted) · screens ${s.screens} · tiles ${s.tiles}${DESTRUCTION.on ? ` · fixtures ${s.fixtures} (−${s.fixturesRefused})` : ''} · decals ${s.decals} · impulses bang ${s.impBang} / impact ${s.impImpact} / thud ${s.impThud} (−${s.impThudDropped}), ${s.debrisKicked} chunks kicked${ps} · index ${JSON.stringify(inv)}`;
  }
}
