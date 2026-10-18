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
//   NOBODY    reads any of it: no eye, ear or foot, no step of the game. Its dice are its own (never Math.random, never the game's die), its clock is the frames'
//             dt, and it files with its own seeds so that no other effect's births are dealt differently for it. tools/qa/snowbreath-check.ts.
import { SideMap } from '../math/side';
import { Vec3, clamp } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
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

export interface BreathStats { active: boolean; why: string; men: number; shown: number; breaths: number; records: number; births: number; frames: number; /** records filed per man (Character.id) */ by: Record<number, number>; }
interface Man { ph: number; pace: number; effort: number; n: number; left: number; gap: number; step: number; shows: boolean; }
interface BreathState { seed: number; men: WeakMap<Character, Man>; stats: BreathStats; }
const states = new SideMap<Game, BreathState>('snowBreath.states');
const fresh = (): BreathStats => ({ active: false, why: 'never run', men: 0, shown: 0, breaths: 0, records: 0, births: 0, frames: 0, by: {} });
function stateOf(g: Game): BreathState {
  let s = states.get(g);
  if (!s) { s = { seed: 0x0b7ea7b5, men: new SideMap(), stats: fresh() }; states.set(g, s); }
  return s;
}
const mix = (x: number): number => { x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return x >>> 0; };
/** this module's own die: a number in 0‥1 off (the seed, a man, a count) — the same every run */
const h01 = (seed: number, a: number, b: number): number => mix((Math.imul(a + 1, 2654435761) ^ Math.imul(b + 1, 2246822519) ^ seed) >>> 0) / 4294967296;
/** a record's seed: the man's, his breath's count and the puff's place in it — one man's breaths are dealt the same whatever the men beside him do */
function recSeed(s: BreathState, id: number, breath: number, k: number): number { return mix((Math.imul(id + 1, 3266489917) ^ Math.imul(breath * 16 + k + 1, 668265263) ^ s.seed ^ 0xb4ea7) >>> 0); }
export function breathStats(g: Game): BreathStats { return stateOf(g).stats; }
/** reseed (probes / captures: same seed → the same breaths), every man's rhythm dealt again */
export function seedBreath(g: Game, n: number) { const s = stateOf(g); s.seed = n >>> 0; s.men = new SideMap(); s.stats = fresh(); }
/** does breath steam here (the switch, on a level built for snow — it asks nothing of the lying snow's surface)? */
export function breathOn(g: Game): boolean { return SNOW_LOOK.breath && snowLevel(levelNameOf(g.level)); }

function manOf(s: BreathState, c: Character): Man {
  let m = s.men.get(c);
  if (!m) { m = { ph: h01(s.seed, c.id, 1), pace: 1 + SNOWBREATH.everyJit * (2 * h01(s.seed, c.id, 2) - 1), effort: 0, n: 0, left: 0, gap: 0, step: 0, shows: false }; s.men.set(c, m); }
  return m;
}
/** is this man's breath to be seen: alive, his head up off the ground, the open sky over it? (the fog of war and the dead are the caller's: they are asked of the Guard) */
function shows(g: Game, c: Character): boolean {
  if (!c.alive) return false;
  const h = c.bones.head; if (!h) return false;
  if (h[1] - c.pos[1] < SNOWBREATH.minHead) return false;
  return !g.weather?.underRoof(h[0], h[2]);
}

/** Once a frame, after the characters and the wind (game.ts, beside the rain / snow recycler). Picture only. */
export function updateSnowBreath(g: Game, dt: number) {
  const st = stateOf(g); const S = st.stats; const K = SNOWBREATH;
  const P: Particles | null = gpuFx(g);
  const why = !SNOW_LOOK.breath ? 'the switch is off' : !snowLevel(levelNameOf(g.level)) ? 'not a snow level' : '';
  if (why) { S.active = false; S.why = why; S.men = 0; S.shown = 0; return; }
  if (!(dt > 0)) return;
  S.active = true; S.why = P ? 'breathing' : 'breathing, nothing filed (no GPU particles)'; S.frames++;   // (with no pool the rhythm still runs — a headless played run walks every read this makes of the game — and files nothing)
  let men = 0, shown = 0;
  const one = (c: Character, seen: boolean) => {
    const m = manOf(st, c); men++;
    // his wind: up while he runs, back slowly once he stops
    const want = clamp((Math.hypot(c.vel[0], c.vel[2]) - K.runLo) / Math.max(0.01, K.runHi - K.runLo), 0, 1);
    m.effort = want > m.effort ? Math.min(want, m.effort + dt / Math.max(0.1, K.effortUp)) : Math.max(want, m.effort - dt / Math.max(0.1, K.effortDown));
    const every = Math.max(0.3, (K.every + (K.everyHard - K.every) * m.effort) * m.pace * (0.9 + 0.2 * h01(st.seed, c.id, 16 + m.n)));
    m.shows = seen && shows(g, c); if (m.shows) shown++;
    // the rhythm runs whether or not it shows (a man who steps out from under a roof is in mid breath, not at the start of one)
    m.ph += dt / every;
    if (m.ph >= 1) { m.ph = m.ph >= 2 ? 0 : m.ph - 1; m.n++; m.left = Math.max(1, Math.round(K.puffs)); m.gap = 0; m.step = Math.min(K.out, every * 0.4) / m.left; if (m.shows) S.breaths++; }
    if (m.left <= 0) return;
    m.gap -= dt; if (m.gap > 0) return;
    m.gap += m.step; m.left--;
    if (!m.shows || !P) return;
    const hard = 1 + (K.hardK - 1) * m.effort;
    // where the head faces, as a heading and a pitch: the heading the skull's own (his body's if he looks straight down), the pitch held inside `pitch` — a man bowed
    // over his gun breathes out ahead of him, not into his collar
    const hd = c.headDir(); const head = c.bones.head!; const hl = Math.hypot(hd[0], hd[2]);
    const fx = hl > 0.2 ? hd[0] / hl : Math.sin(c.bodyYaw), fz = hl > 0.2 ? hd[2] / hl : Math.cos(c.bodyYaw);
    const py = clamp(hd[1], K.pitch[0], K.pitch[1]); const ph = Math.sqrt(Math.max(0, 1 - py * py));
    const f: Vec3 = [fx * ph, py, fz * ph];
    const tail = 1 - 0.3 * (1 - (m.left + 1) / Math.max(1, Math.round(K.puffs)));   // (the last of a breath leaves slower than the first)
    const dl = Math.hypot(f[0], f[1] - K.down, f[2]) || 1;
    const n = P.emit('dust', [head[0] + fx * K.mouthAhead, head[1] - K.mouthDown, head[2] + fz * K.mouthAhead], [f[0] / dl, (f[1] - K.down) / dl, f[2] / dl], Math.max(1, Math.round(K.count)), {
      shape: 'cone', speed: K.speed * tail * (1 + 0.3 * m.effort), speedJit: 0.35, spread: K.spread, life: K.life, lifeJit: K.lifeJit, size: K.size * hard, sizeJit: K.sizeJit, posJit: 0.012,
      vadd: [c.vel[0] * K.carry, 0, c.vel[2] * K.carry], owner: c.id, color: K.color, steam: clamp(K.opacity * hard, 0, 1), seed: recSeed(st, c.id, m.n, m.left) });
    if (n > 0) { S.records++; S.births += n; S.by[c.id] = (S.by[c.id] ?? 0) + 1; }
  };
  one(g.player.char, true);
  for (const gd of g.guards as Guard[]) if (gd.state !== 'dead') one(gd.char, !g.fogOfWar.hidden(gd));
  for (const cv of civiliansShown(g)) if (cv.state !== 'dead') one(cv.char, !g.fogOfWar.hidden(cv));
  S.men = men; S.shown = shown;
}
/** one line for the panel / the probes */
export function breathSummary(g: Game): string {
  const S = stateOf(g).stats;
  return S.active ? `breath ▸ ${S.shown} of ${S.men} men steaming · ${S.breaths} breaths, ${S.records} records, ${S.births} puffs filed` : `breath: ${S.why}`;
}
