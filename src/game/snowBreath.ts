// BREATH — steam off the men's breath on a level built for snow (the switch weatherKinds.ts SNOW_LOOK.breath; the maintainer, 10-14: 'we should have steam from breaths
// in the cold levels too', and of the snow as a whole: 'it does need to feel more organic', 'ideally it looks natural').
//   WHO       every living man on his feet (or his knees) under the open sky: Sam, the team, the defenders, the civilians. Not the dead, not a man lying down (his
//             head is at the ground: `minHead`), not a man under a roof (the weather's own roof footprints — the test the flakes and the wet use), and never a man
//             the fog of war hides (nothing live may show in the fog).
//   RHYTHM    each man's own: a phase and a pace off a hash of his id, so no two breathe together — one breath every `every` seconds at rest, a little uneven breath
//             to breath. EFFORT is the one honest signal there is: his ground speed. Run and he is blown within `effortUp` seconds — breaths every `everyHard`, bigger
//             and denser — and he gets his wind back over `effortDown` once he stops. There is no stamina in the game and none is made up here.
//   A BREATH  is `puffs` small records filed across `out` seconds (a plume that leaves the mouth, not one ball): DUST puffs — the particle system's soft round
//             growing sprite, lit by the scene's own lights and the radiance cache as every puff is, carried by the wind field as every puff is — thrown from the
//             mouth along where the head faces, a little down, with a share of his own walk. The puff's drag stops it inside a hand's length. Two things tell it from
//             dust, both carried by ONE byte of the record's colour word (render/particles.ts EmitOpts.steam; shaders `steamIs` / `steamOf`): its share of the puff's
//             opacity, and that it rises where dust settles.
//   REAL STEAM (SNOW_LOOK.steam, the table BREATHSTEAM below; the maintainer, 10-20: 'the smoke from the gun muzzle is fine so maybe breath should just work like
//             that'): with the switch on a breath is not sprites at all. It is ONE source handed to the smoke solver for as long as he breathes out — the fine
//             lattice the gun's gas lives on, a source that rides his mouth and takes its velocity from where his head faces and how he walks, turn by turn — so
//             what is in the air is the solver's own gas: lit and shadowed by the volumetric pass as gun gas is (its own shadow, a lamp's shafts), carried by the
//             wind the solver takes, stirred by a man who walks through it (Game.smokeWake's shoves, and one more at head height from here), thinned and given
//             back by the fine lattice's own rule. Who breathes, when and how hard are the lines above, unchanged; off (or with no solver drawing, or past
//             `reach` from where the view looks) the breath is the puffs it was.
//   WHOSE     who breathes and when is the game's (the state: the rhythm, the counts of men and breaths); what a breath was SHOWN as — steam through the solver
//             or puffs, whose source rides whose mouth, the records filed — is the host's (`engine.breathShown`, BreathShown below): in no snapshot or hash.
//   NOBODY    reads any of it: no eye, ear or foot, no step of the game. Its dice are its own (never Math.random, never the game's die), its clock is the frames'
//             dt, and it files with its own seeds so that no other effect's births are dealt differently for it. tools/qa/snowbreath-check.ts.
import { SideMap } from '../math/side';
import { Vec3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { HARDBREATH } from './character';   // (read inside the update only)
import type { Particles } from '../render/particles';
import { gpuFx } from './particleFx';
import { SNOW_LOOK, snowLevel } from './weatherKinds';
import { levelNameOf } from '../scene/levelLoad';
import { civiliansShown } from './civilians';

/** The numbers (judged on software-rendered stills only, never seen moving — the maintainer's to move; `__snow.breath` on the console, live with the next breath).
 *  Authored data, not player switches. */
export const SNOWBREATH = {
  every: 3.6,          // s between breaths at rest (× 1 ± everyJit per man, and ± a tenth breath to breath)
  everyJit: 0.18,
  everyHard: 1.3,      // s between breaths when blown
  out: 0.5,            // s one breath takes to leave him at rest (shorter as the breaths come faster)
  puffs: 3,            // records a breath is filed as, across `out`
  count: 5,            // puffs in each record
  speed: 0.7,          // m/s out of the mouth (the puff's drag stops it inside a hand's length; the last of a breath leaves slower)
  spread: 0.24,        // rad: the cone's half angle
  down: 0.12,          // how far below the head's facing it leaves (a share of straight down)
  pitch: [-0.45, 0.3] as [number, number],   // the head's own pitch it follows, held to this (the facing's y: −1 straight down)
  carry: 0.6,          // × his own velocity it leaves with
  life: 1.6,           // s (× 1 ± lifeJit)
  lifeJit: 0.25,
  size: 0.085,         // m: a puff's radius at birth (× 1 ± sizeJit; the kind grows it by three fifths over its life)
  sizeJit: 0.3,
  opacity: 0.66,       // × the dust puff's own peak opacity (particleFx.ts DUST_LOOK.opacity, 0.3)
  hardK: 1.5,          // × size and opacity when blown
  color: [0.9, 0.93, 1.0] as Vec3,   // what it scatters: near white, a touch cold
  mouthAhead: 0.1,     // m from the head bone (eye level) forward to the lips
  mouthDown: 0.075,    // m below it
  minHead: 0.75,       // m: a head lower than this over his feet is a man lying down — no breath is shown off him
  runLo: 1.9,          // m/s: under this his pace costs him nothing
  runHi: 4.0,          // m/s: at this he is working as hard as he can
  effortUp: 4,         // s of running until he is blown
  effortDown: 12,      // s to get his wind back
};

/** THE STEAM'S NUMBERS (SNOW_LOOK.steam: the breath through the smoke solver). Set from the solver's arithmetic and from software-rendered stills, NEVER SEEN ON A
 *  GPU and never timed — the maintainer's to move (`__snow.steam` on the console, live with the next breath). Authored data, not player switches. The rhythm, the
 *  mouth, the pitch and how much of his walk it leaves with are SNOWBREATH's (and the hard breath rule's) as for the puffs: only what the gas is made of is here.
 *  HOW THICK: a guard's sight line starts at his eye, a hand above his own mouth, and nothing in the game reads smoke until a line has lost a fifth of its light
 *  (guards.ts: (T − 0.3) / 0.5, held to 0‥1), so `density` is kept where a line through the thick of a breath loses less than that. */
export const BREATHSTEAM = {
  radius: 0.034,       // m: the gaussian the mouth lets it out through (× √size when blown): a wisp like the barrel's. TRIED AND PUT BACK: 0.09 with `density` 1.4
                       // and `temp` 2.5, a wide thin cloud the puffs' own size and no thicker along a sight line — it held the pool three to five times
                       // the bricks (963 for five men, still rising, where this holds about 170) and showed no better in a software still
  cells: 1.5,          // … never under this many cells of the fine lattice (a splat under a cell lays down next to nothing, and flickers)
  density: 9,          // what the mouth lets out a second at its core (× size when blown; the solver's unit: 6 /m of extinction each)
  temp: 4,             // heat a second at its core: what lifts it (the solver: +1.6 m/s² a unit, gone in under a second on the fine lattice)
  speed: 0.8,          // m/s out of the mouth at rest (× the jet when blown). The solver's air has next to no drag: this is how far the plume reaches
  push: 12,            // 1/s: how hard the air at the mouth is taken up to that speed
  expand: 2,           // 1/s: how fast the breath opens as it leaves
  attack: 0.08,        // s for a breath to come up (it tails off over its last quarter)
  jitter: 0.3,         // how much its heading and speed wander frame to frame: what keeps two breaths from being one shape
  carryK: 0.5,         // × the share of his own velocity the puffs leave with (`carry`): in air that does not stop it, a runner's breath is left behind him, not thrown ahead
  wake: 0.16,          // m: a walking man's head shoves the smoke it passes through, this wide (the solver's push; 0 = his hips and chest alone, as any smoke)
  reach: 12,           // m from where the view looks: a man further off breathes puffs (the frame's far corners are 11 m from it at the game's own zoom, and a breath
                       // holds some ninety bricks of the fine lattice for two seconds: the men nobody can see should not; 0 = every man steams)
};

/** what a probe or the panel reads of the breath: the game's own counts (`BreathCount`) and the host's book of what was shown (`BreathShown`), side by side */
export interface BreathStats { active: boolean; why: string; men: number; shown: number; breaths: number; records: number; births: number; frames: number; /** records filed per man (Character.id) */ by: Record<number, number>; /** breaths handed to the smoke solver as steam (SNOW_LOOK.steam), and the men shown steaming so this frame */ steam: number; steaming: number; }
/** THE GAME'S SIDE of it, kept in the state: who breathes and when hangs on the men alone, so it is the same in two games that differ only in their picture */
interface BreathCount { active: boolean; /** why not, while not active ('' while it is) */ why: string; men: number; shown: number; breaths: number; frames: number; }
/** WHAT OF A BREATH IS THE HOST'S AND NOT THE GAME'S: whether it is steam through the solver hangs on a solver drawing and on where the view looks
 *  (BREATHSTEAM.reach), and whether a puff is filed on a GPU particle pool being there — none of which a recording or a snapshot carries. So the book of what was
 *  filed is kept on the HOST (`engine.breathShown`, host/api.ts, as the open fires' is: fire.ts FireShown; `Game.engine` is in no snapshot): two games that differ
 *  only in their picture are the same game, and a save put back finds no stale book of a solver that was emptied — it is dropped by host/putback.ts, by a reseed, and
 *  here whenever the game's own frame count is not the one after the book's last (a snapshot put back by a road that does not tell the host). A restart or a
 *  file's load keeps the count running and builds the men anew under their old ids: a row is bound to the Character it was written for (`who`), so a fresh man
 *  starts a fresh row, and a row whose man was not asked about this frame is struck, so the book holds no man who is gone. (A solver emptied under the same men costs at worst the rest of one breath in the air; the next is whole.)
 *  `how` = what the breath is shown as now; `men` = by Character.id, the man the row was written for, the breath (`n`) it speaks of, whether that breath is steam
 *  through the solver, and the breath whose source rides his mouth now (−1 = none). The counts run from the book's opening, so behind a drop they start again
 *  while the game's own (`breaths`) go on. No rule reads any of it back. */
export interface BreathShown { tick: number; how: string; steam: number; steaming: number; records: number; births: number; by: Record<number, number>; men: Map<number, { who: Character; /** the frame he was last asked on: a row nobody asked about this frame is struck */ at: number; n: number; steam: boolean; src: number }>; }
interface Man { ph: number; pace: number; effort: number; n: number; left: number; /** records this breath is filed as */ of: number; gap: number; step: number; shows: boolean; /** the frame he was last asked on (a source's track lets go of a man nobody asks about any more) */ at: number; }
interface BreathState { seed: number; men: WeakMap<Character, Man>; stats: BreathCount; /** frames run, never reset */ tick: number; }
const states = new SideMap<Game, BreathState>('snowBreath.states');
const fresh = (): BreathCount => ({ active: false, why: 'never run', men: 0, shown: 0, breaths: 0, frames: 0 });
const blank = (tick: number): BreathShown => ({ tick, how: '', steam: 0, steaming: 0, records: 0, births: 0, by: {}, men: new Map() });
function stateOf(g: Game): BreathState {
  let s = states.get(g);
  if (!s) { s = { seed: 0x0b7ea7b5, men: new SideMap(), stats: fresh(), tick: 0 }; states.set(g, s); }
  return s;
}
const mix = (x: number): number => { x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return x >>> 0; };
/** this module's own die: a number in 0‥1 off (the seed, a man, a count) — the same every run */
const h01 = (seed: number, a: number, b: number): number => mix((Math.imul(a + 1, 2654435761) ^ Math.imul(b + 1, 2246822519) ^ seed) >>> 0) / 4294967296;
/** a record's seed: the man's, his breath's count and the puff's place in it — one man's breaths are dealt the same whatever the men beside him do */
function recSeed(s: BreathState, id: number, breath: number, k: number): number { return mix((Math.imul(id + 1, 3266489917) ^ Math.imul(breath * 16 + k + 1, 668265263) ^ s.seed ^ 0xb4ea7) >>> 0); }
/** the counts a probe or the panel reads: the game's and the host's in one row (a copy: read it again after a frame) */
export function breathStats(g: Game): BreathStats {
  const S = states.get(g)?.stats ?? fresh(), P = g.engine.breathShown;   // (a read makes no row: a game nobody has breathed in keeps none in its snapshot)
  return { active: S.active, why: S.active ? P?.how ?? 'breathing' : S.why, men: S.men, shown: S.shown, breaths: S.breaths, frames: S.frames, records: P?.records ?? 0, births: P?.births ?? 0, by: { ...P?.by }, steam: P?.steam ?? 0, steaming: P?.steaming ?? 0 };
}
/** reseed (probes / captures: same seed → the same breaths), every man's rhythm dealt again */
export function seedBreath(g: Game, n: number) { const s = stateOf(g); s.seed = n >>> 0; s.men = new SideMap(); s.stats = fresh(); g.engine.breathShown = undefined; }
/** does breath steam here (the switch, on a level built for snow — it asks nothing of the lying snow's surface)? */
export function breathOn(g: Game): boolean { return SNOW_LOOK.breath && snowLevel(levelNameOf(g.level)); }

function manOf(s: BreathState, c: Character): Man {
  let m = s.men.get(c);
  if (!m) { m = { ph: h01(s.seed, c.id, 1), pace: 1 + SNOWBREATH.everyJit * (2 * h01(s.seed, c.id, 2) - 1), effort: 0, n: 0, left: 0, of: Math.max(1, Math.round(SNOWBREATH.puffs)), gap: 0, step: 0, shows: false, at: 0 }; s.men.set(c, m); }
  return m;
}
/** is this man's breath to be seen: alive, his head up off the ground, the open sky over it? (the fog of war and the dead are the caller's: they are asked of the Guard) */
function shows(g: Game, c: Character): boolean {
  if (!c.alive) return false;
  const h = c.bones.head; if (!h) return false;
  if (h[1] - c.pos[1] < SNOWBREATH.minHead) return false;
  return !g.weather?.underRoof(h[0], h[2]);
}

/** is the breath steam through the smoke solver here: the switch, some steam to let out, and a solver that steps and draws what it is handed (the harness's null
 *  one, one switched off or frozen, smoke rendering off: the puffs, as ever — a breath never just vanishes)? */
export function steamOn(g: Game): boolean { return SNOW_LOOK.steam && BREATHSTEAM.density > 0 && g.smoke.drawing?.() === true; }
/** his mouth, and where his breath leaves it (unit): the head's heading (his body's if he looks straight down), its pitch held inside `pitch`, a share of straight
 *  down — a man bowed over his gun breathes out ahead of him, not into his collar */
function mouthOf(c: Character): { pos: Vec3; dir: Vec3 } {
  const K = SNOWBREATH; const hd = c.headDir(); const head = c.bones.head!; const hl = Math.hypot(hd[0], hd[2]);
  const fx = hl > 0.2 ? hd[0] / hl : Math.sin(c.bodyYaw), fz = hl > 0.2 ? hd[2] / hl : Math.cos(c.bodyYaw);
  const py = clamp(hd[1], K.pitch[0], K.pitch[1]); const ph = Math.sqrt(Math.max(0, 1 - py * py));
  const f: Vec3 = [fx * ph, py, fz * ph]; const dl = Math.hypot(f[0], f[1] - K.down, f[2]) || 1;
  return { pos: [head[0] + fx * K.mouthAhead, head[1] - K.mouthDown, head[2] + fz * K.mouthAhead], dir: [f[0] / dl, (f[1] - K.down) / dl, f[2] / dl] };
}

/** Once a frame, after the characters and the wind (game.ts, beside the rain / snow recycler). Picture only. */
export function updateSnowBreath(g: Game, dt: number) {
  const st = stateOf(g); const S = st.stats; const K = SNOWBREATH;
  const P: Particles | null = gpuFx(g);
  const why = !SNOW_LOOK.breath ? 'the switch is off' : !snowLevel(levelNameOf(g.level)) ? 'not a snow level' : '';
  if (why) { S.active = false; S.why = why; S.men = 0; S.shown = 0; g.engine.breathShown = undefined; return; }
  if (!(dt > 0)) return;
  const steam = steamOn(g), B = BREATHSTEAM, E = g.engine; st.tick++;
  // the host's book (BreathShown above): this frame's, or a blank one where the game's frame count is not the one after its last — a snapshot put back behind the host's back
  const H: BreathShown = E.breathShown && E.breathShown.tick === st.tick - 1 ? E.breathShown : blank(st.tick); H.tick = st.tick; E.breathShown = H;
  S.active = true; S.why = ''; H.how = steam ? 'breathing (steam through the smoke solver)' : P ? 'breathing' : 'breathing, nothing filed (no GPU particles)'; S.frames++;   // (with no pool the rhythm still runs — a headless played run walks every read this makes of the game — and files nothing)
  let men = 0, shown = 0, steaming = 0; const HB = HARDBREATH.on ? HARDBREATH : null;   // (character.ts: blown, a man's breath is thrown harder, bigger and more often — off = this table's own numbers)
  const focus = steam && B.reach > 0 ? (g.engine as { viewFocus?: Vec3 }).viewFocus : undefined;   // (picture only: which men are worth the solver's bricks)
  const one = (c: Character, seen: boolean) => {
    const m = manOf(st, c); men++; m.at = st.tick;
    const h0 = H.men.get(c.id); if (h0) { if (h0.who === c) h0.at = st.tick; else H.men.delete(c.id); }   // (the book holds no man who is gone: a fresh man under an old id strikes the old row here, the rest are struck below)
    // his wind: up while he runs, back slowly once he stops
    const sp = Math.hypot(c.vel[0], c.vel[2]);
    const want = clamp((sp - K.runLo) / Math.max(0.01, K.runHi - K.runLo), 0, 1);
    m.effort = want > m.effort ? Math.min(want, m.effort + dt / Math.max(0.1, HB ? HB.up : K.effortUp)) : Math.max(want, m.effort - dt / Math.max(0.1, HB ? HB.down : K.effortDown));
    const every = Math.max(0.3, (K.every + ((HB ? HB.every : K.everyHard) - K.every) * m.effort) * m.pace * (0.9 + 0.2 * h01(st.seed, c.id, 16 + m.n)));
    m.shows = seen && shows(g, c); if (m.shows) shown++;
    const inReach = steam && (!focus || Math.hypot(c.pos[0] - focus[0], c.pos[2] - focus[2]) <= B.reach), near = inReach && m.shows;
    if (near) { steaming++; if (B.wake > 0 && sp >= 0.25) g.smoke.push({ pos: c.bones.head!, dir: [c.vel[0] / sp, 0.05, c.vel[2] / sp], speed: sp * 1.1, radius: B.wake, lattice: 'fine' }); }   // (a man walking through steam that hangs at head height stirs it: his hips and chest are Game.smokeWake's. The fine lattice alone — breath and gun gas: a canister's screen, which sight lines read, is shoved as it always was)
    // the rhythm runs whether or not it shows (a man who steps out from under a roof is in mid breath, not at the start of one)
    m.ph += dt / every;
    if (m.ph >= 1) { m.ph = m.ph >= 2 ? 0 : m.ph - 1; m.n++; m.of = m.left = Math.max(1, Math.round(K.puffs + (HB ? (HB.puffs - K.puffs) * m.effort : 0))); m.gap = 0; m.step = Math.min(K.out, every * 0.4) / m.left; if (m.shows) S.breaths++; }
    if (m.left <= 0) return;
    m.gap -= dt; if (m.gap > 0) return;
    m.gap += m.step; m.left--;
    if (!m.shows) return;
    // is THIS breath steam through the solver: said when its first record falls due (the frame it begins, as a rule) and kept for the breath — the host's word, on the host's book
    let h = H.men.get(c.id); if (!h) { h = { who: c, at: st.tick, n: -1, steam: false, src: -1 }; H.men.set(c.id, h); }   // (a restart's fresh man under an old id has a fresh row: the old one was struck above)
    if (h.n !== m.n) { h.n = m.n; h.steam = inReach; h.src = -1; }
    const hm = h;
    const hard = 1 + ((HB ? HB.size : K.hardK) - 1) * m.effort, carry = HB ? K.carry + (HB.carry - K.carry) * m.effort : K.carry, jet = 1 + (HB ? HB.jet - 1 : 0.3) * m.effort;
    if (hm.steam) {
      // REAL STEAM: the whole breath is one source on the solver's fine lattice, let go when a record of it would be filed and none of this breath's rides his
      // mouth — the first as a rule; a later one for a man who stepped out from under a roof in mid breath, or whose source was dropped for a frame. It rides his
      // mouth for what is left of the breath and is dropped the frame he dies, lies down, or goes under a roof or into the fog
      if (!steam || hm.src === m.n) return;
      const born = m.n, v = B.speed * jet, cv = carry * B.carryK;
      const at = (): { pos: Vec3; dir: Vec3 } | null => {
        if (!c.alive || !m.shows || m.n !== born || st.tick - m.at > 1 || states.get(g) !== st || E.breathShown !== H || !SNOW_LOOK.steam) { if (hm.src === born) hm.src = -1; return null; }
        const a = mouthOf(c); return { pos: a.pos, dir: [a.dir[0] * v + c.vel[0] * cv, a.dir[1] * v, a.dir[2] * v + c.vel[2] * cv] };
      };
      const a0 = at(); if (!a0) return;
      g.smoke.emit({ pos: a0.pos, dir: a0.dir, speed: Math.hypot(a0.dir[0], a0.dir[1], a0.dir[2]), radius: B.radius * Math.sqrt(hard), minVoxels: B.cells, density: B.density * hard, temperature: B.temp * hard,
        ttl: m.step * (m.left + 1), age: 0, kind: 'breath', push: B.push, expand: B.expand, attack: B.attack, jitter: B.jitter, lattice: 'fine', confined: true, look: true, trackVel: true, track: at });
      hm.src = born; H.steam++; return;
    }
    if (!P) return;
    const a = mouthOf(c);
    const tail = 1 - 0.3 * (1 - (m.left + 1) / (HB ? m.of : Math.max(1, Math.round(K.puffs))));   // (the last of a breath leaves slower than the first)
    const n = P.emit('dust', a.pos, a.dir, Math.max(1, Math.round(K.count + (HB ? (HB.count - K.count) * m.effort : 0))), {
      shape: 'cone', speed: K.speed * tail * jet, speedJit: 0.35, spread: K.spread, life: K.life, lifeJit: K.lifeJit, size: K.size * hard, sizeJit: K.sizeJit, posJit: 0.012,
      vadd: [c.vel[0] * carry, 0, c.vel[2] * carry], owner: c.id, color: K.color, steam: clamp(K.opacity * hard, 0, 1), seed: recSeed(st, c.id, m.n, m.left) });
    if (n > 0) { H.records++; H.births += n; H.by[c.id] = (H.by[c.id] ?? 0) + 1; }
  };
  one(g.player.char, true);
  for (const gd of g.guards as Guard[]) if (gd.state !== 'dead') one(gd.char, !g.fogOfWar.hidden(gd));
  for (const cv of civiliansShown(g)) if (cv.state !== 'dead') one(cv.char, !g.fogOfWar.hidden(cv));
  S.men = men; S.shown = shown; H.steaming = steaming;
  for (const [id, h] of H.men) if (h.at !== st.tick) H.men.delete(id);   // (dead, despawned, or the men of a game before a restart: the picture's book keeps nobody alive)
}
/** one line for the panel / the probes */
export function breathSummary(g: Game): string {
  const S = breathStats(g);
  return S.active ? `breath ▸ ${S.shown} of ${S.men} men steaming · ${S.breaths} breaths, ${S.records} records, ${S.births} puffs filed${S.steam ? ` · ${S.steam} breaths through the smoke solver (${S.steaming} men now)` : ''}` : `breath: ${S.why}`;
}
