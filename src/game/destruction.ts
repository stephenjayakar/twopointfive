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
import { WORLD } from '../scene/world';
import type { Game, LightTarget } from './game';
import type { WeaponDef } from './weapons';
import type { Prop } from './props';
import type { Character } from './character';
import { gpuFx, emitDust, paletteName, surfOf, type Surf } from './particleFx';
import { Debris, hash01, type ChunkKind } from './debris';
import { PLAYER_ID, NOBODY_ID } from './consts';
import { chronLightShot } from './chronicle';

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
  puffsPerSec: 8, puffsPerFrame: 2, puffDomains: 6, papersPerSec: 6, knocksPerSec: 4, tileGapSecs: 2.2, tilesPerEncounter: 8, decalsPerSec: 12,   // puffDomains: past this many live smoke domains a puff only thickens one it is inside (2 of the solver's 8 left for canisters / muzzle gas)
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
};
export const CHAOS_DEFAULTS = JSON.parse(JSON.stringify(CHAOS)) as typeof CHAOS;
const LS_KEY = 'twopointsix.chaos';
type ChaosTune = { chaos?: number; debrisImpulses?: boolean };
/** the knob as the systems read it: 0 under the tour (the showcase is choreographed round the office as authored), else tune.chaos clamped — UNLESS a showcase PROGRAM of
 *  the level script has set its own for its length (director.ts c.chaos → Destruction.showChaos: the day showcase's loud minute runs at 0.8 whatever the player keeps,
 *  and it is the one thing read under `touring`; the Director nulls it as the program ends, before the encounter is restored) */
export function chaosOf(g: Game): number { const s = g.destr?.showChaos; if (s !== null && s !== undefined) return Math.max(0, Math.min(1, s)); if (g.touring) return 0; const c = (g.tune as ChaosTune).chaos; return Math.max(0, Math.min(1, c ?? 0)); }
/** impulses at all: chaos > 0 AND the switch (game.ts tune.debrisImpulses, default on, kept with the knob) */
export function impulsesOn(g: Game): boolean { return chaosOf(g) > 0 && (g.tune as ChaosTune).debrisImpulses !== false; }
export function loadChaos(tune: ChaosTune) {
  tune.chaos = CHAOS.def;
  try { const raw = localStorage.getItem(LS_KEY); if (!raw) return; const o = JSON.parse(raw); if (typeof o.chaos === 'number' && isFinite(o.chaos)) tune.chaos = Math.max(0, Math.min(1, o.chaos)); if (typeof o.debrisImpulses === 'boolean') tune.debrisImpulses = o.debrisImpulses; for (const k of ['puffsPerSec', 'papersPerSec', 'knocksPerSec', 'tilesPerEncounter'] as const) if (typeof o[k] === 'number' && isFinite(o[k])) CHAOS[k] = o[k];
    const I = CHAOS.imp, oi = o.imp; if (oi && typeof oi === 'object') { for (const k of ['strength', 'radius', 'up'] as const) if (typeof oi.bang?.[k] === 'number' && isFinite(oi.bang[k])) I.bang[k] = oi.bang[k]; if (typeof oi.impact?.strength === 'number' && isFinite(oi.impact.strength)) I.impact.strength = oi.impact.strength; if (typeof oi.thud?.strength === 'number' && isFinite(oi.thud.strength)) I.thud.strength = oi.thud.strength; } } catch { /* no storage (bun) / junk */ }
}
export function saveChaos(g: Game) { try { const t = g.tune as ChaosTune; const I = CHAOS.imp; localStorage.setItem(LS_KEY, JSON.stringify({ chaos: t.chaos ?? CHAOS.def, debrisImpulses: t.debrisImpulses !== false, puffsPerSec: CHAOS.puffsPerSec, papersPerSec: CHAOS.papersPerSec, knocksPerSec: CHAOS.knocksPerSec, tilesPerEncounter: CHAOS.tilesPerEncounter, imp: { bang: { strength: I.bang.strength, radius: I.bang.radius, up: I.bang.up }, impact: { strength: I.impact.strength }, thud: { strength: I.thud.strength } } })); } catch { /* */ } }
export function resetChaosKnobs(g: Game) { Object.assign(CHAOS, JSON.parse(JSON.stringify(CHAOS_DEFAULTS))); const t = g.tune as ChaosTune; t.chaos = CHAOS.def; t.debrisImpulses = true; try { localStorage.removeItem(LS_KEY); } catch { /* */ } }
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
export const DESTR_STATS = { rounds: 0, bangs: 0, decals: 0, papers: 0, sheets: 0, puffs: 0, puffsRefused: 0, bursts: 0, knocks: 0, knocksDemoted: 0, screens: 0, tiles: 0, tilesRefused: 0, chairSpins: 0, impBang: 0, impImpact: 0, impThud: 0, impThudDropped: 0, debrisKicked: 0 };
export const DESTR_LOG: string[] = [];
function dlog(g: Game, s: string) { DESTR_LOG.push(`${g.time.toFixed(2)} ${s}`); if (DESTR_LOG.length > 200) DESTR_LOG.splice(0, 100); }

/** ≤ n() events in any one-second window, exactly: a ring of the last n stamps (a token bucket's burst would let ~2n through across a window's edge, and these caps
 *  are what the page promises) */
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
  private gatherScratch = new Int32Array(32);
  /** per-second caps: strict sliding windows (≤ N in ANY one second — a token bucket lets nearly 2N through across a boundary) */
  private caps = { puff: new RateCap(() => CHAOS.puffsPerSec), paper: new RateCap(() => CHAOS.papersPerSec), knock: new RateCap(() => CHAOS.knocksPerSec), decal: new RateCap(() => CHAOS.decalsPerSec) }; private puffsThisFrame = 0;
  /** knock-offs riding on a group leader's slot this frame (a pot's plant goes with the pot without a slot of its own) */
  private freeKnocks = 0;
  /** the module's own counter every hashed choice counts off (reset with the level: a restarted encounter repeats) */
  private serial = 1;
  private W = WORLD.gridW; private cs = WORLD.gridCell;

  constructor(private g: Game) {
    this.debris = new Debris(g);
    this.hw = Math.ceil((WORLD.max[0] - WORLD.min[0]) / CHAOS.cell); this.hh = Math.ceil((WORLD.max[2] - WORLD.min[2]) / CHAOS.cell);
    this.heat = new Float32Array(this.hw * this.hh);
    this.cells = Array.from({ length: WORLD.gridW * WORLD.gridH }, () => []);
    this.index();
  }

  // ---------------------------------------------------------------- index
  /** Walk the statics once: paper stacks (thin pale NoShadow slabs on furniture), dark screens + the housing behind each desk monitor's, wall TVs, and desk
   *  clutter small enough to knock off (mugs, phones, binders …) — never a fixture's box, never glass, never anything at floor level. */
  private index() {
    const g = this.g; const boxes = g.col.boxes;
    const targetOf = new Map<number, LightTarget>(); for (const t of g.targets) for (const bi of t.boxes) targetOf.set(bi, t);
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
      if (c[0] < 4 || c[0] > 36 || c[2] < 4 || c[2] > 24) { this.items.delete(i); continue; }
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
    if (this.debris.list.length) this.debris.update(dt);
    this.thudsThisFrame = 0;
    if (chaosOf(g) <= 0 && !this.anyHeat) return;
    const k = Math.exp(-dt / CHAOS.heatTau); let any = false;
    for (let i = 0; i < this.heat.length; i++) { const h = this.heat[i] * k; this.heat[i] = h < 0.02 ? 0 : h; if (h >= 0.02) any = true; }
    this.anyHeat = any;
    this.puffsThisFrame = 0; this.freeKnocks = 0;
  }
  private anyHeat = false; private thudsThisFrame = 0;
  boxes(out: Box[]) { this.debris.boxes(out); }

  /** Level reset (resetLevelState): every hidden static back as authored, the pools emptied, heat and caps and the counter back to the start. */
  reset() {
    for (const [i, f] of this.hidden) this.g.col.boxes[i].flags = f;
    this.hidden.clear(); this.debris.clear(); this.heat.fill(0); this.anyHeat = false; this.tilesDown.clear(); this.lastTileT = -100; this.tileCount = 0; this.serial = 1;
    for (const c of Object.values(this.caps)) c.reset(); this.freeKnocks = 0;
    for (const t of this.broke) t.broken = false; this.broke.clear();   // (the screens THIS module put out come back with the stacks; a restart repairs every light besides)
  }
  /** the tour's cuts / clearAftermath: nothing tumbling carries over into the next shot (hidden statics stay hidden until the level resets) */
  clearMoving() { this.debris.clear(); }

  // ---------------------------------------------------------------- the sites
  /** A round from `shooter` stopped at `hitP` travelling `dir` in a static (`index` as col.raycast reports it; ≥ 1e6 = a leaf), a piece of furniture (`prop`)
   *  or nothing solid (both undefined: flesh / sky — nothing here). combat.ts fireWeapon calls it right after the marks and the particle burst it always made. */
  round(shooter: Character, hitP: Vec3, dir: Vec3, hit: { n: Vec3; index?: number; prop?: Prop; box?: Box }, def: WeaponDef) {
    const g = this.g; const chaos = chaosOf(g); if (chaos <= 0) return;
    if (hit.index === undefined && !hit.prop) return;
    DESTR_STATS.rounds++;
    const E = this.stoke(hitP, 1, chaos); this.anyHeat = true;
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
  }

  /** The stun charge went off at `at` (combat.ts detonateStun), thrown by `who` (blamed for what its knock-offs / tile / shoved chunks are heard doing): a lot of
   *  heat where it lies — the desk over it cleared, papers up in a wide ring, the tile above down, dust off the ceiling — all through the same capped paths. */
  bang(at: Vec3, who: number = NOBODY_ID) {
    const g = this.g; const chaos = chaosOf(g); if (chaos <= 0) return;
    if (!who) who = NOBODY_ID;   // (a sandbox-dropped can carries the item default 0 — the dropped-gun 'Sam's clatter' convention elsewhere; here nobody threw it)
    DESTR_STATS.bangs++;
    const E = this.stoke(at, CHAOS.bangHeat, chaos); this.anyHeat = true;
    // papers within a couple of metres, thrown out and up from the blast
    const list: Destructible[] = []; const wide: Destructible[] = [];
    for (let dz = -2; dz <= 2; dz += 2) for (let dx = -2; dx <= 2; dx += 2) for (const d of this.near([at[0] + dx, at[1], at[2] + dz], list)) if (!wide.includes(d)) wide.push(d);
    const eye: Vec3 = [at[0], Math.max(at[1] + 0.3, 0.95), at[2]];   // (the blast's reach judged from just over desk height: a can on the floor still clears the desk it lies under the edge of)
    for (const d of wide) {
      const dd = v3.dist(d.box.c, at); const over = topOf(d.box);   // (aim OVER the thing, not at its centre: a segment ending inside a mug reports the mug as the wall in the way)
      if (d.kind === 'paper' && dd < 2.6 && !g.col.solidBlocked(eye, over)) this.convertPaper(d, v3.normalize(v3.add(v3.sub(d.box.c, at), [0, 0.8, 0])), 2.5 + 2 * chaos, chaos);
      else if ((d.kind === 'clutter' || d.kind === 'binder' || d.kind === 'housing') && dd < 1.6 && E >= CHAOS.tKnock && !g.col.solidBlocked(eye, over)) this.knockOff(d, v3.normalize(v3.sub(d.box.c, at)), chaos, d.kind === 'housing' ? 'housing' : d.kind === 'binder' ? 'binder' : 'clutter', who);
    }
    if (E >= CHAOS.tTile) this.tileDrop(at, chaos, true, who);
    if (indoors(at)) this.dustPuff([at[0], WORLD.ceilingY - 0.15, at[2]], [0, -1, 0], 1.6, 'drywall');   // the shock shakes dust out of the ceiling grid over it (there is no grid over the lot)
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
  private breakTarget(t: LightTarget): boolean { if (t.broken) return false; const wasLit = t.interactive && (t.on || t.factor > 0); t.broken = true; this.broke.add(t); if (wasLit) this.g.lightEvent(t); return wasLit; }   // (→ whether a LIGHT went out: a dark / dead screen breaks silently — nobody notices a light that was not on, combat.ts's fixture rule)

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
    this.g.smoke.obstaclesChanged?.(b.c, Math.hypot(b.h[0], b.h[1], b.h[2]) + 0.6); }   // the smoke solver's obstacle field round it is stale now (the thing, and a housing's screen 0.3 m off, are no longer solid): live domains there re-bake (smoke.ts)

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
    const liveDom = (g.smoke as { stats?: { live?: number } }).stats?.live ?? 0;
    if (this.puffsThisFrame >= CHAOS.puffsPerFrame || (g.smoke.budget ? g.smoke.budget() : 8) < 4 || (liveDom >= CHAOS.puffDomains && !g.smoke.inSmokeDomain(p)) || !this.take('puff')) { DESTR_STATS.puffsRefused++; return false; }   // (past puffDomains live solver domains a puff only ever THICKENS a plume it is inside — a spray across three rooms does not claim three 64³ domains)
    this.puffsThisFrame++; DESTR_STATS.puffs++;
    const K = CHAOS.puff; const dens = K.density * (surf === 'drywall' ? 1 : surf === 'concrete' ? 0.7 : surf === 'fabric' ? 0.35 : 0.5) * Math.min(2, scale);
    const dir = v3.normalize([n[0], n[1] + 0.25, n[2]]);
    g.smoke.emit({ pos: v3.mad(p, n, 0.1), dir, speed: K.speed, radius: K.radius * Math.sqrt(scale), density: dens, temperature: K.temp, ttl: K.ttl, age: 0, kind: 'puff', push: K.push, expand: K.expand, attack: 0.03, jitter: 0.35, lattice: 'coarse', prio: 0, minVoxels: 2, anchor: v3.mad(p, n, 0.6) });
    return true;
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
  private tileDrop(p: Vec3, chaos: number, force = false, who: number = NOBODY_ID): boolean {
    const g = this.g;
    if (!force && g.time - this.lastTileT < CHAOS.tileGapSecs) return false;
    if (this.tileCount >= CHAOS.tilesPerEncounter) { DESTR_STATS.tilesRefused++; return false; }
    if (!indoors(p)) return false;
    // the square over the beaten spot, jittered a square either way so a long burst walks the drops about
    const jx = Math.round((this.hash() - 0.5) * 2.4), jz = Math.round((this.hash() - 0.5) * 2.4);
    const tx = Math.floor(p[0] / 0.6) + jx, tz = Math.floor(p[2] / 0.6) + jz; const key = `${tx},${tz}`;
    if (this.tilesDown.has(key)) return false;
    const cx = (tx + 0.5) * 0.6, cz = (tz + 0.5) * 0.6; const y = WORLD.ceilingY - 0.03;
    if (!indoors([cx, 0, cz])) return false;   // (the jitter walked it out through the wall)
    { const n = g.col.gather(cx - 0.29, cz - 0.29, cx + 0.29, cz + 0.29, WORLD.ceilingY - 0.14, WORLD.ceilingY - 0.001, this.gatherScratch);   // anything in the tile's own slot under the slab — a light panel's box, a wall's top course: that square is not a free tile (the beacons' bases are NoShadow: invisible here, and harmless — nothing rasterises or traces them)
      for (let k = 0; k < n; k++) {   // (gather is cell-granular: re-test the footprint, or every square sharing a metre cell with a panel would be refused)
        const b = g.col.boxes[this.gatherScratch[k]]; const ac = Math.abs(Math.cos(b.yaw)), as = Math.abs(Math.sin(b.yaw)); const ex = ac * b.h[0] + as * b.h[2], ez = as * b.h[0] + ac * b.h[2];
        if (Math.abs(b.c[0] - cx) < ex + 0.29 && Math.abs(b.c[2] - cz) < ez + 0.29) return false;
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

  summary(): string {
    const s = DESTR_STATS; const inv = this.inventory();
    const P = gpuFx(this.g); const ps = P ? ` · particle impulses ${P.stats.impQueued} queued / ${P.stats.impMerged} merged / ${P.stats.impDropped} dropped, ${P.stats.kicked} kicks` : '';
    return `chaos ${chaosOf(this.g).toFixed(2)}${impulsesOn(this.g) ? '' : ' (impulses off)'} · heat max ${Math.max(0, ...this.heat).toFixed(1)} · ${this.debris.summary()} · papers ${s.papers} (${s.sheets} sheets) · puffs ${s.puffs} (−${s.puffsRefused}) · knocks ${s.knocks} (${s.knocksDemoted} demoted) · screens ${s.screens} · tiles ${s.tiles} · decals ${s.decals} · impulses bang ${s.impBang} / impact ${s.impImpact} / thud ${s.impThud} (−${s.impThudDropped}), ${s.debrisKicked} chunks kicked${ps} · index ${JSON.stringify(inv)}`;
  }
}
