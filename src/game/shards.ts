// BROKEN GLASS AFTER IT LETS GO (the glass goal's shards part; rebuild/glass/shards.md is the page). The fracture model (game/glassbreak.ts) decides WHICH piece of a
// pane lets go and when; from that moment the piece is this file's: glass in the air, on the floor, in the ear and under a boot.
//
//   release(f)   one call per fragment (the fracture part's release hook hands them in — `g.glassBreak.onRelease`, wired by this class when that hook exists; until then
//                the base's own shard spawn is taken at the debris pool's door and turned into the same call, see take()). A fragment becomes
//                  PLATES   its big part, rigid: one to four thin Dynamic boxes in the debris pool (game/debris.ts) that tumble, slide like glass, and BREAK AGAIN on a
//                           hard landing — into smaller plates (two generations at most) and a burst of the particles below — unless it is laminated (it sags in one
//                           piece) or tempered (it was never a plate: it is dice). Drawn the colour of what lies under them × the pane's tint (a pane is seen
//                           THROUGH), polished (the reflection pass and the lights' glints find them), casting no shadow.
//                  SPRAY    GPU particles of the 'shard' kind (render/particles.ts; game/shardModel.ts is the CPU reference of their flight): MID fragments (1–4 cm,
//                           they carry and skitter), FINES (millimetres: thrown fast, stopped by the air, they hang near the pane and rain down), and from a round or
//                           a blast a BACK SPRAY toward the shooter (spall comes off both faces: a sixth of the fines); a tempered clump is DICE — hundreds of small
//                           cubes that pour straight down.
//   sound        every landing is HEARD: a plate's first hard touch is a clink or — if it breaks — a shatter, a spray's landing is a run of tinkles timed by the fall
//                (the CPU knows when: h = the drop, t = (v + √(v² + 2gh)) ÷ g) — each filing ONE 'prop' hearing event for the batch, blamed on whoever broke the pane.
//   underfoot    where glass came down there is LITTER (a ½ m grid of square metres of glass): ANYBODY's footfall on it crunches and is louder to the hearing model
//                (floor.ts tread → step(): Sam's, a teammate's, a guard's — one rule; the crunch itself is the player's cue) and grinds it down a little each time.
//
// BOUNDED: the particles by a live estimate against SHARDS.liveCap (two fifths of the LONG ring as shipped; clamped so overCap × liveCap stays inside it — which is a FIFO: a big break's births advance its head and retire the OLDEST chips / paper / brass
// lying about, as any long-lived burst does), a per-frame record cap (records over it WAIT in a short queue; past the queue they are trimmed and counted) and
// the particle system's own birth cap (records wait, never drop); the plates by a share of the debris pool (the oldest resting plate crumbles to litter to make room);
// sounds by a per-frame cap and a pending cap. DETERMINISTIC: every choice is a hash of the fragment's seed (never Math.random, never the wall clock), and nothing the
// CPU decides depends on whether a GPU particle system is attached — a headless run and the page take the same road. INERT unless the switch is on
// (tune.glassShards, default on) AND glass breaking is live (tune.glassBreak, chaos > 0, not the tour): with either off nothing here runs and the base stands,
// run digest for run digest (tools/qa/shards-probes.ts shards-off).
//
// CUT PLATES (the cut pieces goal; scene/cut.ts, rebuild/cut-pieces/glass/notes.md): under the cut switch (cutBoxesOn()) a piece or a dagger's plate IS ITS CELL — the
// fragment's outline extruded across the pane's thickness, ONE box cut along the cell's edges (cutPrism), pointed where the cell was, the shape of the hole it left —
// in place of the one to four rectangles; a plate that breaks on landing is cut again along slanted lines (its children are the parent's shape in two or three), its
// rest crumbs lie round its real outline, and a plate that leaves the pool (evicted, or lying there ten minutes) goes as a few grains of its own glass. What pushes
// against a plate (the pool's contact, layFlat) still meets its fitted uncut box. A laminated sheet stays rectangles (it is one), tempered stays dice. Switch off = the
// rectangles, statement for statement.
import { Vec3, v3, quat, clamp } from '../math/vec';
import type { Quat } from '../math/vec';
import { Box, BoxFlag, makeBox } from '../scene/boxes';
import type { Game } from './game';
import type { Chunk } from './debris';
import { hash01 } from './debris';
import { gpuFx } from './particleFx';
import { glassBreakLive } from './glassbreak';
import type { PaneState } from './glassbreak';
import { SHARD } from './shardModel';
import { NOBODY_ID } from './consts';
import { cutBoxesOn, cutPrism } from '../scene/cut';
import type { CutPlane } from '../scene/cut';

/** what the fracture part hands over per fragment (rebuild/glass/fracture.md, 'the release hook' — the same fields, typed structurally so either side can land first) */
/** what the penetration part hands over per pane a round goes through (its GLASSPEN_HOOKS.crossed — the fields this model reads, typed structurally: that file is not on this branch) */
export interface PaneCrossLike { bi: number; type: 'annealed' | 'tempered' | 'laminated'; exit: Vec3; dirOut: Vec3; take: number; eOut: number; hole: boolean }
export interface GlassFragmentLike {
  pane: number;
  type: 'annealed' | 'tempered' | 'laminated';
  kind: 'piece' | 'dagger' | 'clump' | 'sheet';
  outline: Vec3[]; centre: Vec3; normal: Vec3;
  thickness: number; area: number;
  velocity: Vec3; spin: Vec3; tint: Vec3;
  grain: number;
  cause: 'hit' | 'support' | 'blast' | 'dice' | 'rake';
  who: number; seed: number;
}

export const SHARDS = {
  // ---- the spray (counts per m² of fragment; clamped per fragment below)
  midPerM2: 140, midMin: 2, midMax: 18, midSize: 0.02, midLife: 60 /* = shardModel SHARD.life (a literal: no module-level read of another game module's table; shards-model holds them equal) */,
  finePerM2: 520, fineMin: 6, fineMax: 70, fineSize: 0.0045, fineLife: 22,
  backShare: 0.18,          // of the fines, thrown back toward the shooter (a round / a blast only)
  // (tuning round two) a ROUND's own piece: at least hitFineMin fines and hitBackShare of them back at the shooter — one round through float glass was nine particles, nothing to see
  hitFineMin: 16, hitBackShare: 0.4,
  // … and a blow that knocks NOTHING out (a laminated web taking a round, a soft hit that only stars the sheet) still spits: spallOut fines off the far face, spallBack off the near one. 0 / 0 = nothing, as it was
  spallOut: 10, spallBack: 6,
  dicePerM2: 520, diceMin: 6, diceMax: 160, diceLife: 45,   // (round two: 700 — one 3 m² facade sheet alone overran the live cap and its last clumps fell as nothing)
  diceFineShare: 0.35,      // of finePerM2, the sparkle a diced clump adds (round two: 0.5)
  craterPerM2: 20000, craterMax: 48,   // the crater at a blow (a fragment that comes with `grain`): grains per m² of it, and at most
  exitFines: 14, exitSpeed: 4.0,       // a round THROUGH a sheet: fines off the far face per 0.1 of energy the glass took (×0.5‥2), and their speed (m/s, + 5 × what the round has left)
  speed: 1.0,               // × every throw speed below (the feel knob)
  // ---- budget
  liveCap: 4000,            // live shard particles (estimate; two fifths of the LONG ring's 10 240): counts thin out as it fills — see capFloor below (round two: 2560 — sized so ONE diced facade sheet is born whole)
  capFloor: 3, overCap: 1.25,   // (round three) at the cap an emit still gets this many pieces, until the estimate is overCap × liveCap
  pressLife: 0.3, pressFrom: 0.35,   // (round three) a birth past pressFrom of the cap lives down to pressLife of its life (eased to the cap; 1 = as authored)
  recsPerFrame: 24,         // emit records a frame from glass …
  deferMax: 96,             // … and how many more may WAIT for the next frames (past it a record is trimmed)
  // ---- plates
  plateMinArea: 0.012,      // m²: a fragment smaller than this is all particles
  plateShare: 0.6,          // of the debris pool glass may hold
  childMinArea: 0.004,
  shatterV0: 1.6, shatterV1: 4.0,   // landing speed (m/s) from which a plate may break / always breaks
  restCrumbs: 12, crumbSize: 0.009,   // (tuning round five) the most grains a plate sheds along its edges as it comes to rest, and their size in m (0 = none: a clear sheet on a floor is the floor's own colour and could not be seen lying there)
  restFrost: true,          // (round five) glass at rest SHOWS: a resting shard particle is drawn as the little drift of grains it stands for (render/particles.ts shardRestFrost; false = lit and drawn as it flies — nothing to see on any floor)
  // CUT PLATES AS GLASS (the cut switch only; all picture, no ray — every number authored taste, judged on software-rendered stills, never on a GPU). All five at 0 /
  // false = the plates as they first went in: an opaque box in the colour of what is under it.
  cutEdge: 1,               // how far a plate's EDGE — its cut faces, 12 mm all round, and the rim below — is drawn toward the pale green-white of float glass seen through its edge (Box.cutCore; 0 = the sheet's own colour)
  cutSee: 0.7,              // the share of a plate's two faces left to what is behind it (a screen door in the cut pass: Box.cutGlass; 0 = opaque faces) The door steps in EIGHTHS (gbuffer_cut.wgsl): the share is rounded to the nearest eighth, so 0.94 and up is a face not drawn at all and under 0.0625 an opaque one.
  cutRim: 1.25,             // pixels of rim on those faces drawn as edge: the outline is the bright thing, at any distance (0 = only the real 12 mm edge)
  cutAnim: true,            // the screen door's pattern steps with the TAAU jitter, so the resolve averages it to a tint (false = one fixed pattern)
  cutBody: 0.1,             // the face's own colour = the pane's tint × this: dark, so what shows on it is its polish — reflections and glints (0 = the old stand-in: the colour of the surface under it × the tint)
  cutSeeRest: 0.45,         // the see-through share of a plate that has come to REST (it is looked at far longer lying than flying, and at 0.7 a lying plate was an outline with nothing inside; 0 = as in flight)
  cutRestBody: 0.3,         // at rest the face's colour is taken this far from the dark body toward the pale edge colour: a faint sheen, a sheet lying flat under the ceiling's light (0 = the dark body, as in flight)
  maxGen: 2,
  contact: { keepFloor: 0.72, keepWall: 0.85, rest: 0.3 },   // glass on a hard floor: slides on, hops a little (debris.ts's own are 0.55 / 0.8 / 0.22)
  // ---- sound + hearing
  soundsPerFrame: 3, pendingMax: 48,
  /** s between two plays of one voice (tuning round two: a diced sheet was 40‥80 'glassShatter's inside half a second — a wall of one sample); a landing inside the gap is
   *  not played, it THICKENS the next one (≤ soundThicken more gain). {} = every landing its own sound, as it was */
  soundGap: { glassTinkle: 0.07, glassShatter: 0.11 } as Record<string, number>, soundThicken: 0.5, soundOwedSecs: 0.6,
  level: 0.3,               // a landing's hearing level (= the base's LANDING.shard), 0.35 when a plate shatters
  eventGap: 0.4,            // s between hearing events from spray landings
  // ---- underfoot
  underfoot: true,
  crunchFull: 0.012,        // m² of glass in a ½ m cell that is a full crunch
  crunchGain: 0.6, crunchAdd: 0.12,   // a step on it (anybody's): level × (1 + gain·k) + add·k
  grind: 0.9,               // of a cell's glass left after a step on it
};
export const SHARDS_DEFAULTS = JSON.parse(JSON.stringify(SHARDS)) as typeof SHARDS;
export const SHARD_STATS = { fragments: 0, crossings: 0, plates: 0, platesRefused: 0, cutPlates: 0, cutSplit: 0, cutDropped: 0, crumbled: 0, breaks: 0, emits: 0, born: 0, trimmed: 0, recsDeferred: 0, sounds: 0, soundsMerged: 0, spalls: 0, events: 0, crunches: 0, peakLive: 0, peakPlates: 0 };
type ShardsTune = { glassShards?: boolean };
const LS_KEY = 'twopointsix.shards';
/** the highest liveCap a row / a stored value may ask: overCap (1.25) × this stays inside the LONG ring's 10 240, which chips, brass and paper share */
export const LIVE_CAP_MAX = 8000;
export function loadShards(tune: ShardsTune) {
  try {
    const raw = localStorage.getItem(LS_KEY); if (!raw) return; const o = JSON.parse(raw);
    if (typeof o.on === 'boolean') tune.glassShards = o.on;
    if (typeof o.speed === 'number' && isFinite(o.speed)) SHARDS.speed = Math.max(0.25, Math.min(3, o.speed));
    if (typeof o.underfoot === 'boolean') SHARDS.underfoot = o.underfoot;
    if (typeof o.liveCap === 'number' && isFinite(o.liveCap)) SHARDS.liveCap = Math.max(500, Math.min(LIVE_CAP_MAX, Math.round(o.liveCap)));
  } catch { /* no storage / bad JSON: defaults */ }
}
export function saveShards(g: Game) { try { localStorage.setItem(LS_KEY, JSON.stringify({ on: (g.tune as ShardsTune).glassShards !== false, speed: SHARDS.speed, underfoot: SHARDS.underfoot, liveCap: SHARDS.liveCap })); } catch { /* no storage */ } }
/** the one gate: the switch on AND glass breaking live (its switch, chaos > 0, not the tour) */
export function shardsLive(g: Game): boolean { return (g.tune as ShardsTune).glassShards !== false && glassBreakLive(g); }

/** what a glass plate in the debris pool carries (Chunk.glass) */
export interface PlateMeta { gen: number; area: number; tint: Vec3; type: GlassFragmentLike['type']; seed: number; /** its glass has been counted into the litter (once: a plate woken and put back to sleep adds nothing) */ littered?: boolean;
  /** a CUT plate only (the cut switch): its outline in the box's own (x, y) about the box centre — the box is thin along its z; convex, anticlockwise */ poly?: Pt2[]; }
/** a point of a plate's outline in its box's local (x, y) */
export type Pt2 = [number, number];
interface Pending { t: number; pos: Vec3; name: 'glassTinkle' | 'glassShatter'; gain: number; rate: number; amount: number; who: number; event: number; }
interface Life { t: number; n: number; }
const u32 = (x: number) => x >>> 0;
const CELL = 0.5;
const LITTER_CELL_MAX = 0.25;
const cellKey = (x: number, z: number) => (Math.floor(x / CELL) + 512) * 4096 + (Math.floor(z / CELL) + 512);

export class GlassShards {
  /** scheduled landings (sound + litter + at most one hearing event each) */
  private pending: Pending[] = [];
  /** births still alive, by expiry (the live estimate) */
  private lives: Life[] = []; private liveEst = 0;
  /** plates that asked to break this frame (debris.update is iterating when they land: done in update()) */
  private breaks: { c: Chunk; speed: number }[] = [];
  /** m² of glass lying in each ½ m cell */
  litter = new Map<number, number>();
  private recsThisFrame = 0; private soundsThisFrame = 0; private lastEventT = -1e9;
  private soundAt: Record<string, number> = {}; private soundOwed: Record<string, number> = {};
  /** emit records over the frame's cap, waiting their turn (FIFO, ≤ SHARDS.deferMax) */
  private deferred: { pos: Vec3; dir: Vec3; count: number; o: SprayOpts; seed: number }[] = [];
  /** emit births waiting in `deferred` (they count against the live cap from the moment they are asked for; booked into `lives` when sent) */
  private deferredN = 0;
  /** the interim hookup's memory per pane (take()): the blows it has seen on it, when the last one landed and what it was, and — tempered — when it took the whole pane as dice */
  private paneMem = new Map<number, { hits: number; sites: number; t: number; cause: 'hit' | 'blast'; dicedT: number }>();
  private crunchN = 0;
  log: string[] = [];
  private hooked = false; private wasLive = false;

  constructor(private g: Game) {
    g.destr.debris.glass = { take: (box, v, w, who) => this.take(box, v, w, who), landed: (c, speed) => this.landed(c, speed), rested: (c) => this.rested(c), gone: (c) => this.gone(c) };
  }

  // ---------------------------------------------------------------- in: a fragment lets go
  /** One fragment, from the fracture part's release hook (or take() below). Returns false when the model is not live (the caller's own stand-in then applies). */
  release(f: GlassFragmentLike): boolean {
    const g = this.g;
    if (!shardsLive(g)) return false;
    SHARD_STATS.fragments++;
    const E = f.cause === 'hit' ? 1 : f.cause === 'blast' ? 1.5 : f.cause === 'dice' || f.cause === 'rake' ? 0.5 : 0.25;
    const n = v3.normalize(f.normal); const A = Math.max(1e-4, f.area);
    // ---- the rigid part
    let plated = 0;
    const dice = f.kind === 'clump' || f.type === 'tempered';
    const powder = !dice && f.kind !== 'sheet' && f.grain > 0;   // the CRATER punched at the blow: it goes as grains, never as one piece
    if (!dice && !powder && A >= SHARDS.plateMinArea) plated = this.plates(f, n);
    // ---- the spray
    const sp = SHARDS.speed;
    const tint = f.tint; const spread = Math.sqrt(A) * 0.45;
    const fall = this.fallOf(f.centre, f.velocity);
    if (powder) {
      // CRATER: grains about `grain` across thrown the blow's way in a cone, the air stopping them short, + the spall back off the struck face
      const ng = this.budget(clampI(Math.round(A * Math.min(SHARDS.craterPerM2, 0.5 / (f.grain * f.grain)) * (0.5 + 0.5 * E)), SHARDS.fineMin, SHARDS.craterMax));
      this.emit(f.centre, n, ng, { speed: (2.2 + 2.6 * E) * sp, speedJit: 0.85, spread: 0.7, life: SHARDS.fineLife, lifeJit: 0.4, size: f.grain, sizeJit: 0.6, aspect: 1.3, tumble: 45, nrmJit: 1, posJit: spread, vadd: v3.scale(f.velocity, 0.3), color: tint }, u32(f.seed ^ 0xC8A7));
      if (f.cause === 'hit' || f.cause === 'blast') {
        const nb = this.budget(Math.round(ng * SHARDS.backShare));
        this.emit(v3.mad(f.centre, n, -0.03), v3.scale(n, -1), nb, { speed: (1.0 + 0.8 * E) * sp, speedJit: 0.8, spread: 1.0, life: SHARDS.fineLife * 0.8, lifeJit: 0.4, size: f.grain, sizeJit: 0.6, aspect: 1.3, tumble: 45, nrmJit: 1, posJit: spread * 0.6, color: tint }, u32(f.seed ^ 0xBACC));
      }
      this.schedule({ t: fall.t + 0.05, pos: fall.pos }, 'glassTinkle', 0, 1, A, f.who, false);   // (the blow's own crack is the sound; this is its litter)
    } else if (dice) {
      // DICE: the clump bursts into cubes about `grain` across that pour down with a little of the blow's push; + a sparkle of fines
      const grain = f.grain > 0 ? f.grain : 0.009;
      const nd = this.budget(clampI(Math.round(A * Math.min(SHARDS.dicePerM2, 0.5 / (grain * grain))), SHARDS.diceMin, SHARDS.diceMax));
      this.emit(f.centre, n, nd, { speed: 0.9 * sp * (0.6 + 0.4 * E), speedJit: 0.8, spread: 1.1, life: SHARDS.diceLife, lifeJit: 0.35, size: grain, sizeJit: 0.35, aspect: 1, tumble: 30, nrmJit: 1, posJit: spread, vadd: f.velocity, color: tint }, u32(f.seed ^ 0xD1CE));
      const nf = this.budget(clampI(Math.round(A * SHARDS.finePerM2 * SHARDS.diceFineShare), 4, SHARDS.fineMax));
      this.emit(f.centre, n, nf, { speed: 1.6 * sp, speedJit: 0.85, spread: 1.2, life: SHARDS.fineLife, lifeJit: 0.4, size: SHARDS.fineSize * 0.8, sizeJit: 0.5, aspect: 1.2, tumble: 45, nrmJit: 1, posJit: spread, vadd: v3.scale(f.velocity, 0.5), color: tint }, u32(f.seed ^ 0xF17E));
      this.schedule(fall, 'glassShatter', Math.min(1, 0.35 + A * 4), 1.15 + 0.3 * hash01(f.seed), A * 0.8, f.who);
    } else if (f.kind === 'sheet') {
      // a laminated sheet coming away whole: it sheds a little grit and no more
      const nf = this.budget(clampI(Math.round(A * 60), 4, 40));
      this.emit(f.centre, n, nf, { speed: 0.8 * sp, speedJit: 0.8, spread: 1.2, life: SHARDS.fineLife, lifeJit: 0.4, size: SHARDS.fineSize, sizeJit: 0.5, aspect: 1.2, tumble: 40, nrmJit: 1, posJit: spread, vadd: f.velocity, color: tint }, u32(f.seed ^ 0xF17E));
      if (!plated) this.schedule(fall, 'glassTinkle', 0.5, 0.8, A * 0.3, f.who);
    } else {
      // annealed PIECE / DAGGER: mids that carry, fines the air stops, and — off a round or a blast — spall back toward where it came from
      const k = (0.5 + 0.5 * E) * (plated ? 1 : 2);
      const nm = this.budget(clampI(Math.round(A * SHARDS.midPerM2 * k), SHARDS.midMin, SHARDS.midMax));
      this.emit(f.centre, n, nm, { speed: (1.2 + 1.6 * E) * sp, speedJit: 0.75, spread: 0.55, life: SHARDS.midLife, lifeJit: 0.3, size: SHARDS.midSize, sizeJit: 0.55, aspect: 1.7, tumble: 22, nrmJit: 0.5, posJit: spread, vadd: v3.scale(f.velocity, 0.6), color: tint }, u32(f.seed ^ 0x51D5));
      const nf = this.budget(clampI(Math.round(A * SHARDS.finePerM2 * (0.3 + 0.7 * E)), f.cause === 'hit' ? Math.max(SHARDS.fineMin, SHARDS.hitFineMin) : SHARDS.fineMin, SHARDS.fineMax));
      this.emit(f.centre, n, nf, { speed: (2.2 + 2.6 * E) * sp, speedJit: 0.85, spread: 0.95, life: SHARDS.fineLife, lifeJit: 0.4, size: SHARDS.fineSize, sizeJit: 0.6, aspect: 1.4, tumble: 45, nrmJit: 1, posJit: spread, vadd: v3.scale(f.velocity, 0.3), color: tint }, u32(f.seed ^ 0xF17E));
      if (f.cause === 'hit' || f.cause === 'blast') {
        const nb = this.budget(Math.round(nf * (f.cause === 'hit' ? Math.max(SHARDS.backShare, SHARDS.hitBackShare) : SHARDS.backShare)));
        this.emit(v3.mad(f.centre, n, -0.03), v3.scale(n, -1), nb, { speed: (1.0 + 0.8 * E) * sp, speedJit: 0.8, spread: 1.0, life: SHARDS.fineLife * 0.8, lifeJit: 0.4, size: SHARDS.fineSize * 0.9, sizeJit: 0.6, aspect: 1.3, tumble: 45, nrmJit: 1, posJit: spread * 0.6, color: tint }, u32(f.seed ^ 0xBACC));
      }
      if (!plated) this.schedule(fall, 'glassTinkle', Math.min(0.9, 0.3 + A * 8), 0.9 + 0.5 * hash01(f.seed), A, f.who);          // (a plated fragment's first sound is its plate's own landing)
      else this.schedule({ t: fall.t + 0.05, pos: fall.pos }, 'glassTinkle', 0, 1, A * 0.35, f.who, false);                      // … its spray still leaves litter where it comes down
    }
    return true;
  }
  /** A blow that knocked nothing out of pane glass (glass.ts glassImpact asks: a laminated web taking a round, a soft hit that only stars a float sheet): fines off the far
   *  face along the blow and a few back off the near one — the sheet spits whether or not a piece leaves. `n` faces where the blow came from. Particles only: no plate, no
   *  sound of its own (the crack is glassImpact's), no litter worth a crunch. */
  spall(at: Vec3, n: Vec3, dir: Vec3 | null, thickness: number, tint: Vec3, seed: number, far = true) {
    if (!shardsLive(this.g) || SHARDS.spallOut + SHARDS.spallBack <= 0) return;
    SHARD_STATS.spalls++; const sp = SHARDS.speed; const out: Vec3 = dir ? v3.normalize(v3.add(v3.scale(dir, 0.6), v3.scale(n, -0.6))) : v3.scale(n, -1);
    const no = far ? this.budget(SHARDS.spallOut) : 0, nb = this.budget(SHARDS.spallBack);   // (far false: the round went THROUGH — `crossed` throws the far face's jet, so only the near face spits here)
    if (no > 0) this.emit(v3.mad(at, n, -(thickness * 0.5 + 0.01)), out, no, { speed: 3.2 * sp, speedJit: 0.85, spread: 0.7, life: SHARDS.fineLife, lifeJit: 0.4, size: SHARDS.fineSize, sizeJit: 0.6, aspect: 1.4, tumble: 45, nrmJit: 1, posJit: 0.012, color: tint }, u32(seed ^ 0x5BA1));
    this.emit(v3.mad(at, n, thickness * 0.5 + 0.01), n, nb, { speed: 1.6 * sp, speedJit: 0.8, spread: 1.0, life: SHARDS.fineLife * 0.8, lifeJit: 0.4, size: SHARDS.fineSize * 0.9, sizeJit: 0.6, aspect: 1.3, tumble: 45, nrmJit: 1, posJit: 0.012, color: tint }, u32(seed ^ 0xBACC));
  }
  /** THE INTERIM HOOKUP (the base, before the fracture part's release hook exists): game/glassbreak.ts spawns each fallen cell as 1‥3 thin 'shard' boxes through the debris
   *  pool — the pool hands each here first (debris.ts spawn), and the box is read back as the fragment it stands for. undefined = not ours (the model is not live, or the
   *  fracture hook is doing the handing over): the pool spawns it as it always did. */
  private take(box: Box, v: Vec3, w: Vec3, who: number): Chunk | null | undefined {
    if (this.hooked || !shardsLive(this.g)) return undefined;
    const f = fragmentOfBox(box, v, w, who, u32(Math.imul(++this.serial, 0x9E3779B1) ^ Math.imul(Math.round(box.c[0] * 1000), 73856093) ^ Math.imul(Math.round(box.c[1] * 1000), 19349663) ^ Math.imul(Math.round(box.c[2] * 1000), 83492791)));
    // what the box cannot say, read off the pane it came from (read-only): its glass type, and what made this cell let go — a blow that landed on the pane within
    // the last moments (a round: its hit count rose; a blast: it gained crack sites without a hit), else it is a tongue that lost its support
    const st = this.paneAt(box.c);
    if (st) {
      const now = this.g.time; let m = this.paneMem.get(st.bi); if (!m) { m = { hits: 0, sites: 0, t: -1e9, cause: 'hit', dicedT: -1e9 }; this.paneMem.set(st.bi, m); }
      const nSites = (st as unknown as { impacts?: unknown[] }).impacts?.length ?? 0;   // (read loosely: the fracture part's pane state names its sites differently — and with its release hook this path never runs)
      if (st.hits > m.hits) { m.cause = 'hit'; m.t = now; } else if (nSites > m.sites) { m.cause = 'blast'; m.t = now; }
      m.hits = st.hits; m.sites = nSites;
      f.pane = st.bi; f.type = st.type; f.cause = now - m.t < 0.35 ? m.cause : 'support';
      if (st.type === 'tempered') {
        // a DICED pane: the base hands over a crumb for a few of its cells only (the rest it throws as chips) — the first one stands for the whole pane, taken here
        // as a grid of clumps over its face; the pane's later crumbs are already in that pour
        if (now - m.dicedT > 2) { m.dicedT = now; this.dicePane(st, f); }
        this.note(`take pane ${st.bi} tempered → dice`);
        return this.ghost;
      }
      this.note(`take pane ${st.bi} ${st.type} ${f.kind} ${f.cause} ${(f.area * 1e4).toFixed(0)} cm²`);
    }
    this.lastPlate = null;
    this.release(f);
    return this.lastPlate ?? this.ghost;   // (never a refusal: the fragment was taken — as a plate, or whole as spray; the caller's own per-frame budget counts it either way)
  }
  /** what take() hands back for a fragment that became particles only: a chunk in no pool (the base sets a finish on what it gets back and counts it spawned) */
  private ghost = { box: makeBox({ c: [0, -100, 0], h: [0.01, 0.01, 0.01], yaw: 0, albedo: [0, 0, 0], flags: BoxFlag.NoPrimary | BoxFlag.NoShadow }) } as unknown as Chunk;
  /** the pane a dropped cell's box came from: the one whose face it lies in (inside its outline — or least outside it, for a box at a shared edge — and within 8 cm of its plane) */
  private paneAt(c: Vec3): PaneState | null {
    let best: PaneState | null = null, bestD = 0.12;
    for (const st of this.g.glassBreak.panes.values()) {
      const b = st.box; const dx = c[0] - b.c[0], dz = c[2] - b.c[2]; const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
      const l = [dx * cy - dz * sy, c[1] - b.c[1], dx * sy + dz * cy]; const thin = b.h[0] < b.h[2] ? 0 : 2;
      if (Math.abs(l[thin]) > b.h[thin] + 0.08) continue;
      const out = Math.max(0, Math.abs(l[2 - thin]) - b.h[2 - thin], Math.abs(l[1]) - b.h[1]);
      if (out < bestD) { bestD = out; best = st; }
    }
    return best;
  }
  /** a tempered pane gone to dice, whole (the interim hookup): its face as a grid of clumps ≤ ~0.25 m² each, every one a release of its own (dice, fines, a shatter where it lands) */
  private dicePane(st: PaneState, f0: GlassFragmentLike) {
    const b = st.box; const thin = b.h[0] < b.h[2] ? 0 : 2; const hu = b.h[2 - thin], hv = b.h[1];
    const nu = clampI(Math.round(hu * 2 / 0.5), 1, 4), nv = clampI(Math.round(hv * 2 / 0.5), 1, 4);
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw); const uAx: Vec3 = thin === 0 ? [sy, 0, cy] : [cy, 0, -sy];   // (boxes.ts: local +X → (cos, 0, −sin), +Z → (sin, 0, cos))
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const du = ((i + 0.5) / nu - 0.5) * 2 * hu, dv = ((j + 0.5) / nv - 0.5) * 2 * hv; const su = hu / nu, sv = hv / nv;
      const c: Vec3 = [b.c[0] + uAx[0] * du, b.c[1] + dv, b.c[2] + uAx[2] * du];
      const corner = (a: number, e: number): Vec3 => [c[0] + uAx[0] * su * a, c[1] + sv * e, c[2] + uAx[2] * su * a];
      this.release({ ...f0, pane: st.bi, type: 'tempered', kind: 'clump', grain: 0.009, cause: 'dice', outline: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], centre: c, area: 4 * su * sv, thickness: 2 * b.h[thin],
        velocity: [f0.velocity[0], f0.velocity[1] - 0.2 * hash01(f0.seed + i * 7 + j), f0.velocity[2]], seed: u32(f0.seed + Math.imul(i * 4 + j + 1, 0x9E3779B1)) });
    }
  }
  private lastPlate: Chunk | null = null;
  /** this object's own count of hand-dealt seeds (take / test / a crunch's pitch): reset with the level, so two fresh games agree */
  private serial = 0;

  // ---------------------------------------------------------------- plates
  /** the fragment's rigid part: 1‥4 thin boxes over its outline (its principal axes; a dagger is cut along its length), inside glass's share of the pool. Returns how many. */
  private plates(f: GlassFragmentLike, n: Vec3): number {
    const fr = frameOf(f.outline, f.centre, n);
    if (cutBoxesOn() && f.kind !== 'sheet' && f.outline.length >= 3) return this.cutPlates(f, n, fr);
    const fill = Math.min(1, f.area / Math.max(1e-6, fr.lu * fr.lv)); const sc = Math.sqrt(fill) * 0.96;
    const k = f.kind === 'sheet' ? clampI(Math.round(f.area / 0.25), 1, 4) : f.kind === 'dagger' ? clampI(Math.round(fr.lu / Math.max(fr.lv, 0.08) / 1.6), 1, 3) : f.area > 0.09 ? 2 : 1;
    const rot = quat.fromBasis(fr.u, fr.v, n);
    const under = this.underAlbedo(f.centre);
    let made = 0;
    for (let j = 0; j < k; j++) {
      const h = (i: number) => hash01(u32(f.seed + j * 7919 + i * 104729));
      const hu = fr.lu * sc / (2 * k), hv = fr.lv * sc / 2;
      if (4 * hu * hv < SHARDS.childMinArea) continue;
      const off = ((j + 0.5) / k - 0.5) * fr.lu * sc;
      const c: Vec3 = v3.mad(v3.mad(fr.mid, fr.u, off), n, 0.02);
      const box = makeBox({ c, h: [hu, hv, Math.max(0.004, f.thickness / 2)], yaw: 0, rot, albedo: plateAlbedo(f.tint, under, f.type), flags: BoxFlag.Dynamic });
      const vel: Vec3 = v3.add(f.velocity, v3.add(v3.scale(fr.u, (j - (k - 1) / 2) * 0.25), [(h(1) - 0.5) * 0.3, -0.2 * h(2), (h(3) - 0.5) * 0.3]));
      const w: Vec3 = [f.spin[0] * (0.6 + 0.8 * h(4)) + (h(5) - 0.5) * 2, f.spin[1] + (h(6) - 0.5) * 2, f.spin[2] * (0.6 + 0.8 * h(7)) + (h(8) - 0.5) * 2];
      if (this.plate(box, vel, w, f.who, { gen: 0, area: 4 * hu * hv, tint: v3.copy(f.tint), type: f.type, seed: u32(f.seed + j * 31) })) made++;
    }
    return made;
  }
  /** THE CUT SWITCH's plates: the fragment's own cell as ONE box cut along its edges (cutPrism across the box's thin z; x, y = the outline's principal frame), so what
   *  falls is the shape of the hole it left. A cell with more edges than a record holds (cellParts) leaves as two halves. Same pool, same share, same hashes as the
   *  rectangles' — only the shape and the count differ. Returns how many. */
  private cutPlates(f: GlassFragmentLike, n: Vec3, fr: ReturnType<typeof frameOf>): number {
    const poly = tidyPoly(f.outline.map(p => { const d = v3.sub(p, fr.mid); return [v3.dot(d, fr.u), v3.dot(d, fr.v)] as Pt2; })); if (poly.length < 3) return 0;
    const halfT = Math.max(0.004, f.thickness / 2);
    const parts = cellParts(poly, halfT, f.seed); const k = parts.length; if (k > 1) SHARD_STATS.cutSplit++;
    const rot = quat.fromBasis(fr.u, fr.v, n);
    const albedo = plateAlbedo(f.tint, this.underAlbedo(f.centre), f.type);   // (plate() gives a plate that keeps a record its glass body)
    let made = 0;
    for (let j = 0; j < k; j++) {
      const h = (i: number) => hash01(u32(f.seed + j * 7919 + i * 104729));
      const area = polyArea(parts[j]); if (area < SHARDS.childMinArea) continue;
      const pb = cutPlateBox(v3.mad(fr.mid, n, 0.02), rot, parts[j], halfT, albedo); if (!pb) continue;
      const pc = polyCentroid(parts[j]); const pl = Math.hypot(pc[0], pc[1]);   // two halves part along the line between their middles, whichever way the cell was split
      const apart: Vec3 = k > 1 && pl > 1e-6 ? v3.scale(v3.add(v3.scale(fr.u, pc[0] / pl), v3.scale(fr.v, pc[1] / pl)), 0.125) : [0, 0, 0];
      const vel: Vec3 = v3.add(f.velocity, v3.add(apart, [(h(1) - 0.5) * 0.3, -0.2 * h(2), (h(3) - 0.5) * 0.3]));
      const w: Vec3 = [f.spin[0] * (0.6 + 0.8 * h(4)) + (h(5) - 0.5) * 2, f.spin[1] + (h(6) - 0.5) * 2, f.spin[2] * (0.6 + 0.8 * h(7)) + (h(8) - 0.5) * 2];
      if (this.plate(pb.box, vel, w, f.who, { gen: 0, area, tint: v3.copy(f.tint), type: f.type, seed: u32(f.seed + j * 31), poly: pb.poly }, pb)) made++;
    }
    return made;
  }
  /** one plate into the debris pool, inside glass's share of it: over the share the oldest RESTING plate crumbles to litter where it lies; none resting = refused */
  private plate(box: Box, v: Vec3, w: Vec3, who: number, meta: PlateMeta, cut?: { cut: CutPlane[] | undefined; dropped: number }): Chunk | null {
    const D = this.g.destr.debris; const cap = Math.max(2, Math.floor(D.cap() * SHARDS.plateShare));
    let mine = 0; for (const c of D.list) if (c.glass) mine++;
    while (mine >= cap) {
      const old = D.list.find(c => c.glass && c.rest);
      if (!old) { SHARD_STATS.platesRefused++; return null; }
      this.crumble(old); mine--;
    }
    const ch = D.spawnRaw('shard', box, v, w, who);
    if (!ch) { SHARD_STATS.platesRefused++; return null; }
    ch.glass = meta; ch.contact = meta.type === 'laminated' ? undefined : SHARDS.contact;
    ch.box.rough = 0.05; ch.box.flags |= BoxFlag.NoShadow;   // polished, and clear: no shadow, no ray
    if (cut && SHARDS.cutBody > 0) { const under = this.underAlbedo(ch.box.c); ch.box.albedo = cut.cut ? cutFaceAlbedo(meta.tint, under, meta.type, false) : plateAlbedo(meta.tint, under, meta.type); }   // (the glass body only where the cut pass draws it: a cell that is its own rectangle carries no record, is drawn whole and opaque, and keeps the stand-in colour — as does the child of one)
    if (cut) { ch.box.cut = cut.cut; if (cut.cut) { if (SHARDS.cutEdge > 0) ch.box.cutCore = edgeColour(meta.tint, SHARDS.cutEdge); if (SHARDS.cutSee > 0 || SHARDS.cutRim > 0) ch.box.cutGlass = { see: SHARDS.cutSee, rim: SHARDS.cutRim, anim: SHARDS.cutAnim }; } SHARD_STATS.cutPlates++; SHARD_STATS.cutDropped += cut.dropped; }   // (the pool copies centre, extents and attitude — the record is put on the copy; undefined = the cell was its own rectangle)
    SHARD_STATS.plates++; this.lastPlate = ch;
    SHARD_STATS.peakPlates = Math.max(SHARD_STATS.peakPlates, mine + 1);
    return ch;
  }
  /** a resting plate retired to make room: gone from the pool, a few particles lying where it was (the litter it left is already in the grid) */
  private crumble(c: Chunk) {
    const D = this.g.destr.debris; const i = D.list.indexOf(c); if (i >= 0) D.list.splice(i, 1);
    this.crumbs(c);
  }
  private crumbs(c: Chunk) {
    SHARD_STATS.crumbled++;
    const m = c.glass!; const n = this.budget(clampI(Math.round(m.area * 220), 3, 10));
    this.emit(v3.add(c.box.c, [0, 0.01, 0]), [0, 1, 0], n, { speed: 0.25, speedJit: 0.8, spread: 1.3, life: SHARDS.midLife * 0.7, lifeJit: 0.3, size: SHARDS.midSize, sizeJit: 0.5, aspect: 1.6, tumble: 6, nrmJit: 0.2, posJit: Math.sqrt(m.area) * 0.4, color: m.tint }, u32(m.seed ^ 0xC2B2));
  }
  /** debris.ts: a glass plate has LEFT THE POOL by the pool's own hand (evicted at rest to make room for any chunk; the pool's age retire reaches only a plate that
   *  is moving again). Under the cut switch it goes the way a plate over glass's share does — a few grains of its own glass where it lay (Control's rule: what
   *  leaves play breaks into particles of its own material). Switch off: nothing, as it was (it vanished). `evicted` = the same for a caller outside the pool's own
   *  hook (the break table's one eviction rule hands a glass chunk here). */
  evicted(c: Chunk) { this.gone(c); }
  private gone(c: Chunk) {
    if (!cutBoxesOn() || !shardsLive(this.g) || !c.glass || c.box.c[1] < -0.5) return;   // (one that fell out of the world leaves nothing to see)
    this.crumbs(c);
  }
  /** debris.ts land(): a glass plate's first hard touch (speed m/s along the surface normal). The sound and the hearing event are filed here and now; whether it BREAKS is
   *  decided here (a hash of its serial against the landing speed) and done in update() — the pool is mid-iteration. Always handles it (true). */
  private landed(c: Chunk, speed: number): boolean {
    const g = this.g; const m = c.glass!;
    const p = SHARDS.shatterV1 > SHARDS.shatterV0 ? Math.max(0, Math.min(1, (speed - SHARDS.shatterV0) / (SHARDS.shatterV1 - SHARDS.shatterV0))) : 1;
    const breaks = shardsLive(g) && m.type !== 'laminated' && m.gen < SHARDS.maxGen && m.area >= SHARDS.childMinArea * 2 && hash01(c.serial * 61 + 7) < p * (m.gen ? 0.6 : 1);
    if (breaks) this.breaks.push({ c, speed });
    const big = Math.min(1, m.area / 0.08);
    if (breaks) this.sound('glassShatter', c.box.c, Math.min(1, 0.4 + 0.5 * big + speed * 0.05), 1.25 - 0.4 * big + 0.15 * hash01(c.serial * 31));
    else this.sound('glassTinkle', c.box.c, Math.min(1, 0.3 + 0.3 * big + speed * 0.08), (m.type === 'laminated' ? 0.55 : 1.1 - 0.35 * big) + 0.2 * hash01(c.serial * 31));
    this.heard(c.box.c, breaks ? SHARDS.level + 0.05 : SHARDS.level, c.who);
    return true;
  }
  /** debris.ts sleep(): a plate has come to rest — it takes the colour of what it lies on (it is seen through), and its glass is litter there */
  private rested(c: Chunk) {
    const m = c.glass!; const under = this.underAlbedo(c.box.c); c.box.albedo = c.box.cut ? cutFaceAlbedo(m.tint, under, m.type, true) : plateAlbedo(m.tint, under, m.type);
    if (c.box.cut && c.box.cutGlass && c.box.cutGlass.see > 0 && SHARDS.cutSeeRest > 0) c.box.cutGlass = { ...c.box.cutGlass, see: SHARDS.cutSeeRest };   // (a step, and it stays: a plate knocked on along the floor keeps its resting look)
    if (!m.littered) {
      m.littered = true; this.deposit(c.box.c, m.area * 0.5);
      if (shardsLive(this.g)) this.shed(c);
    }
  }
  /** (round five) the edges a plate broke along shed their crumbs where it stops: up to restCrumbs grains, two to a point, round its OUTLINE (its own long and short sides, a
   *  little outside them), which lie as frost — the particles' resting look — and are what shows a clear sheet on a floor. Once per plate (rested() guards). */
  private shed(c: Chunk) {
    const m = c.glass!; const b = c.box;
    const n = this.budget(clampI(Math.round(Math.sqrt(m.area) * 28), 0, SHARDS.restCrumbs)); if (n <= 0) return;
    if (m.poly && cutBoxesOn()) { this.shedCut(c, n); return; }
    const rot = b.rot ?? quat.yaw(b.yaw); const ax = [0, 1, 2].sort((p, q) => b.h[p] - b.h[q]); const long = ax[2], short = ax[1];
    const e: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; const L = quat.rotate(rot, e[long]), S = quat.rotate(rot, e[short]);
    const hl = b.h[long] * 1.08, hs = b.h[short] * 1.08; const per = 4 * (hl + hs);
    const pts = Math.ceil(n / 2);                           // (two grains a point: half the emit records, which a firefight's sprays want too)
    for (let j = 0; j < pts; j++) {
      let s = (j + hash01(u32(m.seed + 0xC4B5 + j * 977))) / pts * per; let a: number, d: number;   // a point this far round the outline
      if (s < 2 * hl) { a = s - hl; d = -hs; } else if ((s -= 2 * hl) < 2 * hs) { a = hl; d = s - hs; } else if ((s -= 2 * hs) < 2 * hl) { a = hl - s; d = hs; } else { a = -hl; d = hs - (s - 2 * hl); }
      const p = v3.mad(v3.mad(b.c, L, a), S, d);
      this.emit([p[0], Math.max(p[1], b.c[1]) + 0.012, p[2]], [0, 1, 0], Math.min(2, n - 2 * j), { speed: 0.15, speedJit: 0.8, spread: 1.3, life: SHARDS.midLife, lifeJit: 0.3, size: SHARDS.crumbSize, sizeJit: 0.4, aspect: 1.3, tumble: 8, nrmJit: 0.3, posJit: 0.03, color: m.tint }, u32(m.seed ^ (0xC4B5 + j * 131)));
    }
  }
  /** shed() for a CUT plate: the same grains, two to a point, round its real outline (a little outside it) */
  private shedCut(c: Chunk, n: number) {
    const m = c.glass!; const b = c.box; const P = m.poly!; const rot = b.rot ?? quat.yaw(b.yaw);
    const len: number[] = []; let per = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; const l = Math.hypot(q[0] - P[i][0], q[1] - P[i][1]); len.push(l); per += l; }
    if (!(per > 1e-6)) return;
    const cc = polyCentroid(P);
    const pts = Math.ceil(n / 2);
    for (let j = 0; j < pts; j++) {
      let s = (j + hash01(u32(m.seed + 0xC4B5 + j * 977))) / pts * per; let i = 0; while (i < P.length - 1 && s > len[i]) { s -= len[i]; i++; }
      const a = P[i], q = P[(i + 1) % P.length]; const t = len[i] > 1e-9 ? Math.min(1, s / len[i]) : 0;
      const ex = a[0] + (q[0] - a[0]) * t, ey = a[1] + (q[1] - a[1]) * t;
      const p = v3.add(b.c, quat.rotate(rot, [cc[0] + (ex - cc[0]) * 1.08, cc[1] + (ey - cc[1]) * 1.08, 0]));
      this.emit([p[0], Math.max(p[1], b.c[1]) + 0.012, p[2]], [0, 1, 0], Math.min(2, n - 2 * j), { speed: 0.15, speedJit: 0.8, spread: 1.3, life: SHARDS.midLife, lifeJit: 0.3, size: SHARDS.crumbSize, sizeJit: 0.4, aspect: 1.3, tumble: 8, nrmJit: 0.3, posJit: 0.03, color: m.tint }, u32(m.seed ^ (0xC4B5 + j * 131)));
    }
  }
  /** a plate that landed hard enough comes apart: 2‥3 smaller plates along its long side (those too small are particles), a burst of mids and fines where it struck */
  private shatter(c: Chunk, speed: number) {
    const D = this.g.destr.debris; const i = D.list.indexOf(c); if (i < 0) return;
    const m = c.glass!; const b = c.box; const rot = b.rot ?? quat.yaw(b.yaw);
    D.list.splice(i, 1); SHARD_STATS.breaks++;
    // its in-plane axes: the thin one is the pane's thickness, the longer of the other two is cut
    const cutPlate = !!m.poly && cutBoxesOn();   // (a cut plate is thin along its own z whatever its outline's extents: a sliver's short side can be under the pane's thickness)
    const ax = cutPlate ? (b.h[0] >= b.h[1] ? [2, 1, 0] : [2, 0, 1]) : [0, 1, 2].sort((p, q) => b.h[p] - b.h[q]); const long = ax[2], short = ax[1];
    const e: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; const L = quat.rotate(rot, e[long]);
    const h = (k: number) => hash01(u32(m.seed + c.serial * 131 + k * 977));
    const k = 2 + (h(0) > 0.6 ? 1 : 0);
    const cuts = [0]; for (let j = 1; j < k; j++) cuts.push((j + (h(j) - 0.5) * 0.5) / k); cuts.push(1);
    let lost = 0;
    if (cutPlate) {
      // CUT: the outline itself is broken across its long side by k − 1 slanted lines (each taken off what is left, so the pieces never overlap); every piece a
      // little smaller than its share (glass is lost along the break), cut along its own edges — the old outline's and the new breaks'
      let rem: Pt2[] = m.poly!;
      for (let j = 0; j < k; j++) {
        let piece = rem;
        if (j < k - 1) {
          const ang = (h(90 + j) - 0.5) * 0.9; const ca = Math.cos(ang), sa = Math.sin(ang);
          const nx = long === 0 ? ca : -sa, ny = long === 0 ? sa : ca; const d = (cuts[j + 1] * 2 - 1) * b.h[long] * (long === 0 ? nx : ny);
          piece = clipHalf(rem, nx, ny, d); rem = clipHalf(rem, -nx, -ny, -d);
        }
        const full = piece.length >= 3 ? polyArea(piece) : 0; const sc = 0.88 + 0.1 * h(10 + j);
        const cen = polyCentroid(piece); const small: Pt2[] = piece.map(p => [cen[0] + (p[0] - cen[0]) * sc, cen[1] + (p[1] - cen[1]) * sc]);
        const area = full * sc * sc;
        if (area < SHARDS.childMinArea) { lost += full; continue; }
        const pb = cutPlateBox([b.c[0], b.c[1] + 0.004, b.c[2]], [rot[0], rot[1], rot[2], rot[3]], small, b.h[2], v3.copy(b.albedo));
        if (!pb) { lost += full; continue; }
        const side = (j - (k - 1) / 2);
        const vel: Vec3 = v3.add(c.v, v3.add(v3.scale(L, side * (0.5 + 0.5 * h(20 + j))), [(h(30 + j) - 0.5) * 0.5, 0.3 + 0.5 * h(40 + j), (h(50 + j) - 0.5) * 0.5]));
        const w: Vec3 = [(h(60 + j) - 0.5) * 12, (h(70 + j) - 0.5) * 6, (h(80 + j) - 0.5) * 12];
        const ch = this.plate(pb.box, vel, w, c.who, { gen: m.gen + 1, area, tint: m.tint, type: m.type, seed: u32(m.seed + 7 + j * 131), littered: m.littered, poly: pb.poly }, pb);
        if (!ch) lost += full;
      }
    } else
    for (let j = 0; j < k; j++) {
      const a0 = cuts[j], a1 = cuts[j + 1]; const share = a1 - a0; const hh: Vec3 = [b.h[0], b.h[1], b.h[2]]; hh[long] = b.h[long] * share; hh[short] = b.h[short] * (0.7 + 0.3 * h(10 + j));
      const area = 4 * hh[long] * hh[short];
      if (area < SHARDS.childMinArea) { lost += area; continue; }
      const cc = v3.mad(b.c, L, ((a0 + a1) / 2 - 0.5) * 2 * b.h[long]);
      const box = makeBox({ c: [cc[0], cc[1] + 0.004, cc[2]], h: hh, yaw: b.yaw, rot: [rot[0], rot[1], rot[2], rot[3]], albedo: v3.copy(b.albedo), flags: BoxFlag.Dynamic });
      const side = (j - (k - 1) / 2);
      const vel: Vec3 = v3.add(c.v, v3.add(v3.scale(L, side * (0.5 + 0.5 * h(20 + j))), [(h(30 + j) - 0.5) * 0.5, 0.3 + 0.5 * h(40 + j), (h(50 + j) - 0.5) * 0.5]));
      const w: Vec3 = [(h(60 + j) - 0.5) * 12, (h(70 + j) - 0.5) * 6, (h(80 + j) - 0.5) * 12];
      const ch = this.plate(box, vel, w, c.who, { gen: m.gen + 1, area, tint: m.tint, type: m.type, seed: u32(m.seed + 7 + j * 131), littered: m.littered });
      if (!ch) lost += area;
    }
    const A = m.area * 0.35 + lost;
    const nm = this.budget(clampI(Math.round(A * SHARDS.midPerM2 * 1.5), 3, SHARDS.midMax));
    this.emit(v3.add(b.c, [0, 0.02, 0]), [0, 1, 0], nm, { speed: 0.6 + 0.25 * speed, speedJit: 0.7, spread: 1.25, life: SHARDS.midLife, lifeJit: 0.3, size: SHARDS.midSize, sizeJit: 0.55, aspect: 1.7, tumble: 25, nrmJit: 1, posJit: b.h[long] * 0.7, vadd: [c.v[0] * 0.5, 0, c.v[2] * 0.5], color: m.tint }, u32(m.seed ^ 0x5A77));
    const nf = this.budget(clampI(Math.round(A * SHARDS.finePerM2), 8, SHARDS.fineMax));
    this.emit(v3.add(b.c, [0, 0.02, 0]), [0, 1, 0], nf, { speed: 0.9 + 0.35 * speed, speedJit: 0.85, spread: 1.35, life: SHARDS.fineLife, lifeJit: 0.4, size: SHARDS.fineSize, sizeJit: 0.6, aspect: 1.4, tumble: 45, nrmJit: 1, posJit: b.h[long] * 0.7, color: m.tint }, u32(m.seed ^ 0x5A78));
    if (!m.littered) this.deposit(b.c, A);   // (litter is laid where glass FIRST comes to rest: a plate already counted, knocked on and broken later, adds none and takes none with it)
    this.note(`plate ${c.serial} (gen ${m.gen}, ${(m.area * 1e4).toFixed(0)} cm²) broke at ${speed.toFixed(1)} m/s into ${k} (+${nm + nf} particles)`);
  }

  /** A round went THROUGH a sheet: the EXIT SPALL — a tight jet of fines off the far face along the round's way out, by what the glass took from it (a round
   *  through a hole a round already made throws a pinch; a laminated sheet holds most of its own). No plate, no sound (the crack is the blow's), a little litter
   *  where the jet comes down. The penetration part's hook, wired where the two meet (game.ts: `GLASSPEN_HOOKS.crossed = (g, x, who) => g.shards.crossed(x, who)`). */
  crossed(x: PaneCrossLike, who: number): boolean {
    const g = this.g;
    if (!shardsLive(g)) return false;
    SHARD_STATS.crossings++;
    const k = clamp(x.take / 0.1, 0.5, 2) * (x.hole ? 0.2 : 1) * (x.type === 'laminated' ? 0.35 : 1);
    const n = this.budget(Math.round(SHARDS.exitFines * k)); if (n <= 0) return true;
    const d = v3.normalize(x.dirOut); const sp = (SHARDS.exitSpeed + 5 * clamp(x.eOut, 0, 1)) * SHARDS.speed;
    const tint = (g.level.boxes[x.bi] as { albedo?: Vec3 } | undefined)?.albedo ?? [0.72, 0.8, 0.82];
    const seed = u32(Math.imul(++this.serial, 2654435761) ^ 0xE817);
    this.emit(v3.mad(x.exit, d, 0.01), d, n, { speed: sp, speedJit: 0.7, spread: 0.3, life: SHARDS.fineLife, lifeJit: 0.4, size: SHARDS.fineSize * 0.8, sizeJit: 0.6, aspect: 1.3, tumble: 50, nrmJit: 1, posJit: 0.01, color: v3.copy(tint) }, seed);
    const fall = this.fallOf(x.exit, v3.scale(d, sp * 0.35));   // (the air has most of a fine's speed inside a stride)
    this.schedule(fall, 'glassTinkle', 0, 1, n * SHARDS.fineSize * SHARDS.fineSize, who, false);
    return true;
  }

  // ---------------------------------------------------------------- particles
  /** `want` births inside the live budget: whole under 65 % of the cap, thinning to a sixth at it, nothing past it */
  private budget(want: number): number {
    if (want <= 0) return 0;
    const have = this.liveEst + this.deferredN; const fill = have / SHARDS.liveCap;
    // whole counts while a third of the cap is free, then each emit takes its share of what headroom is LEFT (round three: it was a floor of 0.16 and then a
    // cliff at the cap — now the count eases toward nothing and the cap is only approached)
    const k = Math.min(1, Math.max(0, 1 - fill) / 0.35);
    let n = Math.max(0, Math.min(Math.round(want * k), SHARDS.liveCap - have));
    // (round three) AT the cap a break still shows: a couple of pieces an emit, up to overCap of the cap — a fight through a glazed wall used to pin the count and
    // every later pane came apart as nothing at all. capFloor 0 = the cliff as it was.
    if (n < SHARDS.capFloor && have < SHARDS.liveCap * SHARDS.overCap) n = Math.min(want, SHARDS.capFloor);
    SHARD_STATS.trimmed += want - n;
    return n;
  }
  private emit(pos: Vec3, dir: Vec3, count: number, o: SprayOpts, seed: number) {
    if (count <= 0) return;
    if (this.recsThisFrame < SHARDS.recsPerFrame) { this.send(pos, dir, count, o, seed); return; }
    if (this.deferred.length >= SHARDS.deferMax) { SHARD_STATS.trimmed += count; return; }
    SHARD_STATS.recsDeferred++; this.deferredN += count; this.deferred.push({ pos: v3.copy(pos), dir: v3.copy(dir), count, o, seed });
  }
  /** one record out: the books first (the same with or without a GPU) — the births are alive until the longest of them could have faded */
  private send(pos: Vec3, dir: Vec3, count: number, o: SprayOpts, seed: number) {
    this.recsThisFrame++;
    // (round three) under pressure what is born lies a shorter time: past pressFrom of the cap a birth's life eases down to pressLife of its own, so a long fight's litter
    // turns over instead of the first pane's holding the whole budget for a minute. pressLife 1 = every life as authored.
    const fill = this.liveEst / SHARDS.liveCap;
    if (SHARDS.pressLife < 1 && fill > SHARDS.pressFrom) o = { ...o, life: o.life * Math.max(SHARDS.pressLife, 1 - (fill - SHARDS.pressFrom) / (1 - SHARDS.pressFrom) * (1 - SHARDS.pressLife)) };
    this.liveEst += count; this.lives.push({ t: this.g.time + o.life * (1 + o.lifeJit), n: count });
    SHARD_STATS.emits++; SHARD_STATS.born += count; SHARD_STATS.peakLive = Math.max(SHARD_STATS.peakLive, this.liveEst);
    const P = gpuFx(this.g);
    if (P) P.emit('shard', pos, dir, count, { shape: 'cone', ...o, seed });
  }

  // ---------------------------------------------------------------- landings: sound, hearing, litter
  /** where and when something let go at `c` with velocity `v` reaches what is under it (statics only; the world's floor if nothing is) */
  private fallOf(c: Vec3, v: Vec3): { t: number; pos: Vec3 } {
    const col = this.g.col; const vy = -v[1];   // downward speed
    const tOf = (h: number) => (-vy + Math.sqrt(vy * vy + 2 * SHARD.gravity * h)) / SHARD.gravity;
    // how far it gets sideways in the time a fall to the floor would take — stopped short of the first thing in its way (a wall: the litter is not thrown through it)
    let reach = Math.hypot(v[0], v[2]) * tOf(Math.max(0.02, c[1])) * 0.8; const d: Vec3 = reach > 1e-4 ? [v[0] * 0.8 * tOf(Math.max(0.02, c[1])) / reach, 0, v[2] * 0.8 * tOf(Math.max(0.02, c[1])) / reach] : [0, 0, 0];
    if (reach > 0.05) { const w = col.raycast([c[0], c[1], c[2]], d, reach + 0.05); if (w) reach = Math.max(0, w.t - 0.05); }
    const x = c[0] + d[0] * reach, z = c[2] + d[2] * reach;
    // … and what is under it THERE (not under the pane: a window's sill is not where its glass lands)
    const hit = col.raycast([x, c[1], z], [0, -1, 0], c[1] + 0.5);
    const h = Math.max(0.02, hit ? hit.t : c[1]);
    return { t: tOf(h), pos: [x, c[1] - h, z] };
  }
  private schedule(fall: { t: number; pos: Vec3 }, name: Pending['name'], gain: number, rate: number, amount: number, who: number, event = true) {
    if (this.pending.length >= SHARDS.pendingMax) {   // full: its glass is laid where it will land now, and its sound thickens the last landing that has one
      this.deposit(fall.pos, amount);
      if (gain > 0) for (let i = this.pending.length - 1; i >= 0; i--) if (this.pending[i].gain > 0) { this.pending[i].gain = Math.min(1, this.pending[i].gain + gain * 0.2); break; }
      return;
    }
    this.pending.push({ t: this.g.time + fall.t, pos: fall.pos, name, gain, rate, amount, who, event: event ? 1 : 0 });
  }
  private sound(name: string, pos: Vec3, gain: number, rate: number) {
    if (gain <= 0) return;
    const gap = SHARDS.soundGap[name] ?? 0; const since = this.g.time - (this.soundAt[name] ?? -1e9);   // (since < 0: the clock went back — a load — and the stamp is forgotten)
    if (this.soundsThisFrame >= SHARDS.soundsPerFrame || (gap > 0 && since >= 0 && since < gap)) {
      if (gap > 0) { this.soundOwed[name] = Math.min(SHARDS.soundThicken, (this.soundOwed[name] ?? 0) + gain * 0.25); SHARD_STATS.soundsMerged++; }
      return;
    }
    const owed = gap > 0 && since >= 0 && since < gap + SHARDS.soundOwedSecs ? this.soundOwed[name] ?? 0 : 0; this.soundOwed[name] = 0; this.soundAt[name] = this.g.time;   // (what merged landings owe is paid by the NEXT voice of the same run, never by a lone one much later)
    this.soundsThisFrame++; SHARD_STATS.sounds++;
    this.g.audio.play(name, v3.copy(pos), gain + owed, { rate });
  }
  /** a landing the floor can hear: ONE 'prop' event per SHARDS.eventGap floor-wide (a pane coming down is a hundred landings and one thing to go and look at) */
  private heard(p: Vec3, level: number, who: number) {
    const g = this.g; if (g.time - this.lastEventT < SHARDS.eventGap) return;
    this.lastEventT = g.time; SHARD_STATS.events++;
    g.events.push({ kind: 'prop', pos: [p[0], 0, p[2]], time: g.time, loud: false, level, who });
  }
  private deposit(p: Vec3, amount: number) {
    if (amount <= 0) return;
    const k = cellKey(p[0], p[2]); this.litter.set(k, Math.min(LITTER_CELL_MAX, (this.litter.get(k) ?? 0) + amount));   // (a ½ m cell holds no more glass than its own floor)
  }
  /** 0‥1: how much glass lies under `pos` (1 = a full crunch) */
  underfoot(pos: Vec3): number { const a = this.litter.get(cellKey(pos[0], pos[2])); return a ? Math.min(1, a / SHARDS.crunchFull) : 0; }
  /** floor.ts tread(): a footfall at `pos` of hearing level `level`. On litter it crunches (anybody's — the ear's cue) and, for the level the caller files, is louder;
   *  the glass there is ground down a little. Off the litter, or with the model not live: `level` back untouched and nothing else. */
  step(pos: Vec3, level: number): number {
    if (!this.litter.size || !SHARDS.underfoot || !shardsLive(this.g)) return level;
    const key = cellKey(pos[0], pos[2]); const a = this.litter.get(key); if (!a) return level;
    const k = Math.min(1, a / SHARDS.crunchFull);
    if (k < 0.08) return level;
    this.litter.set(key, a * SHARDS.grind);
    SHARD_STATS.crunches++;
    this.g.audio.play('glassCrunch', [pos[0], 0.02, pos[2]], Math.min(1, (0.35 + 0.65 * k) * Math.min(1.5, 0.5 + level * 2)), { rate: 0.85 + 0.3 * hash01(++this.crunchN * 97) });   // (its own count: a footfall never moves a fragment's seed)
    return level * (1 + SHARDS.crunchGain * k) + SHARDS.crunchAdd * k;
  }

  // ---------------------------------------------------------------- per frame
  update(_dt: number) {
    const g = this.g;
    // the fracture part's release hook, when its build is the one running: ours while live, null (its own stand-in) while not — the one-line hookup, made here
    const gb = g.glassBreak as unknown as { onRelease?: ((f: GlassFragmentLike) => void) | null };
    const live = shardsLive(g);
    { const P = gpuFx(g); if (P) P.shardRestFrost = SHARDS.restFrost; }   // (round five: the resting look's switch rides the particle block's flags)
    // (taken on the edge of going live and only if nobody holds it; given back on the edge of going inert and only if it is still ours — never fought over in between)
    if ('onRelease' in gb) {
      if (live && !this.wasLive && gb.onRelease == null) gb.onRelease = this.onRelease;
      else if (!live && this.wasLive && gb.onRelease === this.onRelease) gb.onRelease = null;
      this.hooked = gb.onRelease === this.onRelease;
    }
    this.wasLive = live;
    if (!live) { this.pending.length = 0; this.deferred.length = 0; this.deferredN = 0; this.breaks.length = 0; }   // (the switch off, chaos 0, the tour: nothing still owed sounds, breaks or is born — as glassbreak.ts sheds nothing more)
    // records that waited a frame go first, inside what this frame's releases left of the cap
    while (this.deferred.length && this.recsThisFrame < SHARDS.recsPerFrame) { const e = this.deferred.shift()!; this.deferredN -= e.count; this.send(e.pos, e.dir, e.count, e.o, e.seed); }
    if (!this.pending.length && !this.lives.length && !this.breaks.length) { this.recsThisFrame = 0; this.soundsThisFrame = 0; return; }
    // births whose time is up leave the live estimate
    if (this.lives.length) { let w = 0; for (const l of this.lives) { if (l.t > g.time) this.lives[w++] = l; else this.liveEst -= l.n; } this.lives.length = w; }
    // plates that landed hard this frame come apart
    if (this.breaks.length) { const B = this.breaks; this.breaks = []; for (const b of B) this.shatter(b.c, b.speed); }
    // landings due: the tinkle, the litter, one hearing event a batch
    if (this.pending.length) {
      let w = 0;
      for (const p of this.pending) {
        if (p.t > g.time) { this.pending[w++] = p; continue; }
        this.sound(p.name, p.pos, p.gain, p.rate);
        this.deposit(p.pos, p.amount);
        if (p.event && p.gain > 0) this.heard(p.pos, SHARDS.level, p.who);
      }
      this.pending.length = w;
    }
    // the per-frame caps run from here to the same point next frame: the debris pool's landings, glassBreak's releases and this update's breaks share one count
    this.recsThisFrame = 0; this.soundsThisFrame = 0;
  }
  private onRelease = (f: GlassFragmentLike) => { this.release(f); };
  /** a restart / the level reset: nothing pending, no litter (the plates went with the debris pool, the particles with the particle system's clear) */
  reset() { this.clear(); this.log.length = 0; this.serial = 0; this.crunchN = 0; }
  /** Game.clearAftermath(): the particles and the moving debris have just been wiped (a showcase starting, a tour cut) — nothing of ours is still owed a sound, a hearing
   *  event or a birth, the live estimate is empty, and the litter went with the glass that was it */
  clear() { this.soundAt = {}; this.soundOwed = {}; this.pending.length = 0; this.deferred.length = 0; this.deferredN = 0; this.paneMem.clear(); this.lives.length = 0; this.liveEst = 0; this.breaks.length = 0; this.litter.clear(); this.lastEventT = -1e9; this.lastPlate = null; this.recsThisFrame = 0; this.soundsThisFrame = 0; }
  get live(): number { return this.liveEst + this.deferredN; }
  get plateCount(): number { let n = 0; for (const c of this.g.destr.debris.list) if (c.glass) n++; return n; }
  private note(s: string) { this.log.push(`${this.g.time.toFixed(2)} ${s}`); if (this.log.length > 60) this.log.shift(); }
  summary(): string {
    const s = SHARD_STATS; let lit = 0; for (const a of this.litter.values()) lit += a;
    return `${shardsLive(this.g) ? 'live' : 'inert'}${this.hooked ? ' (release hook)' : ''} · ${s.fragments} fragments → ${s.plates} plates (${this.plateCount} now, ${s.breaks} broke, ${s.crumbled} crumbled, ${s.platesRefused} refused) + ${s.born} particles in ${s.emits} emits (~${this.liveEst} live of ${SHARDS.liveCap}, ${s.trimmed} trimmed) · ${s.sounds} sounds, ${s.events} heard, ${s.crunches} crunches · litter ${(lit * 1e4).toFixed(0)} cm² in ${this.litter.size} cells`;
  }

  // ---------------------------------------------------------------- helpers
  /** the albedo of the static under `p` (what a pane lying there is seen through to), or a neutral floor */
  private underAlbedo(p: Vec3): Vec3 {
    const hit = this.g.col.raycast([p[0], p[1] + 0.05, p[2]], [0, -1, 0], p[1] + 0.6);
    const b = hit ? this.g.engine.world.statics[hit.index] : null;
    return b ? b.albedo : [0.4, 0.4, 0.4];
  }
  /** a hand test (the panel / __shards.test): a fragment of `area` m² let go at `at`, thrown along `dir` */
  test(at: Vec3, dir: Vec3 = [0, 0, 1], area = 0.06, kind: GlassFragmentLike['kind'] = 'piece', type: GlassFragmentLike['type'] = 'annealed'): boolean {
    const n: Vec3 = Math.hypot(dir[0], dir[2]) > 1e-6 ? v3.normalize([dir[0], 0, dir[2]]) : [0, 0, 1]; const s = Math.sqrt(area) / 2; const u: Vec3 = [n[2], 0, -n[0]];   // (a pane stands: its normal is level)
    const out: Vec3[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [at[0] + u[0] * a * s, at[1] + b * s, at[2] + u[2] * a * s] as Vec3);
    return this.release({ pane: -1, type, kind, outline: out, centre: v3.copy(at), normal: n, thickness: 0.006, area, velocity: [n[0] * 0.8, -0.3, n[2] * 0.8], spin: [2, 0.5, -1.5], tint: [0.72, 0.8, 0.82], grain: kind === 'clump' ? 0.009 : 0, cause: 'hit', who: NOBODY_ID, seed: u32(Math.imul(++this.serial, 2654435761)) });
  }
}

type SprayOpts = { speed: number; speedJit: number; spread: number; life: number; lifeJit: number; size: number; sizeJit: number; aspect: number; tumble: number; nrmJit: number; posJit: number; vadd?: Vec3; color: Vec3 };
const clampI = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
/** the colour of a plate's cut edge: the pane's tint taken k of the way to the green of float glass seen through its edge */
const EDGE_GREEN: Vec3 = [0.74, 0.94, 0.86];
function edgeColour(tint: Vec3, k: number): Vec3 { const q = Math.min(1, k); return [tint[0] + (EDGE_GREEN[0] - tint[0]) * q, tint[1] + (EDGE_GREEN[1] - tint[1]) * q, tint[2] + (EDGE_GREEN[2] - tint[2]) * q]; }
/** a CUT plate's face colour (SHARDS.cutBody): the glass's own dark body in the air; at rest with see-through faces that body lifted toward the pale edge colour
 *  (SHARDS.cutRestBody: a sheen); lying opaque on a floor, that floor's colour through the tint. cutBody 0 = plateAlbedo, the base's stand-in. */
function cutFaceAlbedo(tint: Vec3, under: Vec3, type: GlassFragmentLike['type'], resting: boolean): Vec3 {
  const k = SHARDS.cutBody; if (!(k > 0)) return plateAlbedo(tint, under, type);
  if (resting && !(SHARDS.cutSee > 0)) return [under[0] * tint[0], under[1] * tint[1], under[2] * tint[2]];
  const q = resting ? Math.min(1, Math.max(0, SHARDS.cutRestBody)) : 0; const e = EDGE_GREEN;
  return [tint[0] * k + (e[0] - tint[0] * k) * q, tint[1] * k + (e[1] - tint[1] * k) * q, tint[2] * k + (e[2] - tint[2] * k) * q];
}
/** a plate is seen THROUGH: mostly the surface under it × the pane's tint, a little of the glass's own grey-green; a crazed laminated sheet is milky */
function plateAlbedo(tint: Vec3, under: Vec3, type: GlassFragmentLike['type']): Vec3 {
  const k = type === 'laminated' ? 0.45 : 0.82;
  return [under[0] * tint[0] * k + tint[0] * (1 - k) * 0.6, under[1] * tint[1] * k + tint[1] * (1 - k) * 0.6, under[2] * tint[2] * k + tint[2] * (1 - k) * 0.6];
}
/** the principal in-plane frame of a polygon on a plane of normal n: u along its long side, v across (u × v = n), its extents along both and the middle of its bounds */
function frameOf(outline: Vec3[], centre: Vec3, n: Vec3): { u: Vec3; v: Vec3; lu: number; lv: number; mid: Vec3 } {
  const t0 = v3.normalize(v3.cross(Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], n)); const b0 = v3.cross(n, t0);
  let cxx = 0, cyy = 0, cxy = 0; const pts: [number, number][] = [];
  for (const p of outline) { const d = v3.sub(p, centre); const a = v3.dot(d, t0), b = v3.dot(d, b0); pts.push([a, b]); cxx += a * a; cyy += b * b; cxy += a * b; }
  const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy); const ca = Math.cos(th), sa = Math.sin(th);
  const u: Vec3 = [t0[0] * ca + b0[0] * sa, t0[1] * ca + b0[1] * sa, t0[2] * ca + b0[2] * sa]; const v = v3.cross(n, u);
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const [a, b] of pts) { const pu = a * ca + b * sa, pv = -a * sa + b * ca; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
  if (!(u1 > u0) || !(v1 > v0)) return { u, v, lu: 0.05, lv: 0.05, mid: v3.copy(centre) };
  return { u, v, lu: u1 - u0, lv: v1 - v0, mid: v3.mad(v3.mad(centre, u, (u0 + u1) / 2), v, (v0 + v1) / 2) };
}
// ---------------------------------------------------------------- cut plates: outlines in a plate's local (x, y)
/** twice-signed-area ÷ 2, positive */
export function polyArea(P: readonly Pt2[]): number { let a = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += P[i][0] * q[1] - q[0] * P[i][1]; } return Math.abs(a) / 2; }
/** P without repeated points and without points on the straight line between their neighbours (each would cost a cut record a plane for nothing) */
function tidyPoly(P: readonly Pt2[]): Pt2[] {
  let Q: Pt2[] = []; for (const p of P) { const l = Q[Q.length - 1]; if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-5) Q.push(p); }
  while (Q.length > 1 && Math.hypot(Q[0][0] - Q[Q.length - 1][0], Q[0][1] - Q[Q.length - 1][1]) <= 1e-5) Q.pop();
  for (let again = true; again && Q.length > 3;) {
    again = false; const n = Q.length;
    const R = Q.filter((p, i) => { const a = Q[(i + n - 1) % n], b = Q[(i + 1) % n]; const ax = p[0] - a[0], ay = p[1] - a[1], bx = b[0] - p[0], by = b[1] - p[1];
      return Math.abs(ax * by - ay * bx) > 1e-4 * Math.hypot(ax, ay) * Math.hypot(bx, by) || ax * bx + ay * by < 0; });
    if (R.length < n && R.length >= 3) { Q = R; again = true; }
  }
  return Q;
}
function polyCentroid(P: readonly Pt2[]): Pt2 {
  let a = 0, cx = 0, cy = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; const w = p[0] * q[1] - q[0] * p[1]; a += w; cx += (p[0] + q[0]) * w; cy += (p[1] + q[1]) * w; }
  if (Math.abs(a) < 1e-12) { let mx = 0, my = 0; for (const p of P) { mx += p[0]; my += p[1]; } return P.length ? [mx / P.length, my / P.length] : [0, 0]; }
  return [cx / (3 * a), cy / (3 * a)];
}
/** the part of convex polygon P on the side n · p ≤ d (Sutherland–Hodgman against one line; fewer than 3 points back = nothing) */
export function clipHalf(P: readonly Pt2[], nx: number, ny: number, d: number): Pt2[] {
  const out: Pt2[] = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length]; const sa = nx * a[0] + ny * a[1] - d, sb = nx * b[0] + ny * b[1] - d;
    if (sa <= 0) out.push([a[0], a[1]]);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) { const t = sa / (sa - sb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  }
  return out.length >= 3 ? out : [];
}
/** a cell as the outlines its plates take: itself when a cut record holds all its edges (≤ 8 that are not sides of its own bounding rectangle), else its two halves
 *  across its long side, broken along a slightly slanted line through its middle (a half that still does not fit keeps its eight deepest edges — scene/cut.ts
 *  cutRecord — and is then a hair bigger than its share of the cell: counted in SHARD_STATS.cutDropped) */
function cellParts(poly: Pt2[], halfT: number, seed: number): Pt2[][] {
  if (cutPrism(2, halfT, poly).dropped === 0) return [poly];
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const ang = (hash01(u32(seed ^ 0x5B17)) - 0.5) * 0.5; const ca = Math.cos(ang), sa = Math.sin(ang); const alongX = x1 - x0 >= y1 - y0;
  const nx = alongX ? ca : -sa, ny = alongX ? sa : ca; const d = nx * (x0 + x1) / 2 + ny * (y0 + y1) / 2;
  const parts = [clipHalf(poly, nx, ny, d), clipHalf(poly, -nx, -ny, -d)].filter(p => p.length >= 3);
  return parts.length ? parts : [poly];
}
/** the box of one cut plate: outline `poly` (in the frame `rot` at `origin`: x, y in the plate, z through it) extruded ± halfT — the fitted box, its record, and the
 *  outline about the box's own centre. null = nothing to draw (a degenerate outline). */
function cutPlateBox(origin: Vec3, rot: Quat, poly: Pt2[], halfT: number, albedo: Vec3): { box: Box; cut: CutPlane[] | undefined; dropped: number; poly: Pt2[] } | null {
  const pr = cutPrism(2, halfT, poly); if (pr.empty || !(pr.h[0] > 1e-4) || !(pr.h[1] > 1e-4)) return null;
  const c = v3.add(origin, quat.rotate(rot, pr.off));
  const box = makeBox({ c, h: pr.h, yaw: 0, rot, albedo, flags: BoxFlag.Dynamic });
  const anti = signedArea(poly) >= 0; const local: Pt2[] = (anti ? poly : poly.slice().reverse()).map(p => [p[0] - pr.off[0], p[1] - pr.off[1]]);
  return { box, cut: pr.cut, dropped: pr.dropped, poly: local };
}
function signedArea(P: readonly Pt2[]): number { let a = 0; for (let i = 0; i < P.length; i++) { const q = P[(i + 1) % P.length]; a += P[i][0] * q[1] - q[0] * P[i][1]; } return a / 2; }
/** the base's shard BOX read back as the fragment it stands for (take()): its two long sides are the outline, its thin one the pane's normal, signed the way it was thrown */
function fragmentOfBox(box: Box, v: Vec3, w: Vec3, who: number, seed: number): GlassFragmentLike {
  const rot = box.rot ?? quat.yaw(box.yaw);
  const ax = [0, 1, 2].sort((p, q) => box.h[p] - box.h[q]); const e: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  let n = quat.rotate(rot, e[ax[0]]); if (v3.dot(n, v) < 0) n = v3.scale(n, -1);
  const a = quat.rotate(rot, e[ax[1]]), b = quat.rotate(rot, e[ax[2]]); const ha = box.h[ax[1]], hb = box.h[ax[2]];
  const c = box.c; const corner = (sa: number, sb: number): Vec3 => [c[0] + a[0] * ha * sa + b[0] * hb * sb, c[1] + a[1] * ha * sa + b[1] * hb * sb, c[2] + a[2] * ha * sa + b[2] * hb * sb];
  const tinted = Math.abs(box.albedo[0] - box.albedo[2]) > 0.02 || box.albedo[0] < 0.9;
  return { pane: -1, type: 'annealed', kind: hb > 2.2 * ha ? 'dagger' : 'piece', outline: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], centre: v3.copy(c), normal: n, thickness: 2 * box.h[ax[0]], area: 4 * ha * hb,
    velocity: v3.copy(v), spin: v3.copy(w), tint: tinted ? v3.copy(box.albedo) : [0.72, 0.8, 0.82], grain: 0, cause: 'hit', who, seed };
}
