// AN OPEN FIRE — the oil drum of burning wood a level stands in a yard (the pass's and the yard's braziers). The maintainer, 10-23: 'we gotta improve our fire! we have
// barrels with fire on them … great fire with smoke and crackles and dynamic lighting would look sick.' Until now such a drum was a glowing lid and a steady lamp.
//   WHICH     a level's light whose name starts with one of FIRE.names ('brazier'), with the glowing box the level hung on it (its mouth: where, and how wide).
//             TODO(LevelData): a `fire` key on the light; today the name says it, as a street lamp's height says it to the moths.
//   THE LIGHT the level's own lamp, as authored, FLICKERED: its strength about the authored one (the mean is the authored number), its place wandering a hand's
//             width, a kick when the wood cracks. An engine light like any other, so the picture, the bounce, the men lit by it and the LIGHT METER all have the
//             same thing: near a fire a man's reading now moves with the flames (docs/agents/render.md has what was measured).
//   THE COALS the glowing box the level hung on the lamp, dimmed to a share of its authored glow under the flame and breathing with the light (FIRE.coals).
//             Its glow reaches the bounce like any glowing box's, so what the GPU's meter reads of the lid is that much less; the CPU's estimate never read it.
//   THE FLAME a small volume of light the composite draws over the drum's mouth, and THE EMBERS, bright points climbing on its heat — both closed forms of the
//             game's clock (render/shaders/fire.wgsl; this file hands the renderer a record a fire, the four nearest the view). Picture only.
//   THE SMOKE real gas in the smoke solver: a thin hot source over the flames, on the lattice the cans' smoke lives on, so it leans in the wind, pools under a roof
//             and is lit by its own fire. A LOOK source (smoke/types.ts `look`): the game's own smoke, the one sight lines are cut by on the headless stand, never
//             hears of it; in the page the men's sight lines are read off the solver, and the source is kept thin enough to stay clear of where a line starts to
//             count smoke (0.8 of its light). Only for a fire near the view (FIRE.smoke.viewR), only while the solver draws: while
//             one is, the solver is awake (docs/agents/render.md has what that costs).
//   THE SOUND a low bed that follows the fire's heat, and a crack with each pop of the wood — the same pop that throws embers and kicks the light. The mixer's
//             alone: no event is filed, nobody in the game hears a fire.
//   WHEN OUT  the lamp's own target says (shot out, the pistol's jammer, a level that starts it cold): no light, so no flame, smoke or sound either.
// NOBODY reads any of it but the light meter — and of the meter, only who asks how lit a MAN is now. A rule that asks for a place's STEADY light (guards.ts
// lightEstimateAt, `steadyOnly`: is this room lit enough to work in, is that floor dark) is told the authored lamp (RtLight.steady), as before. Its clock is the game's (`g.time`): every number here is a closed form of it, nothing is kept between frames but the
// counts the probes read — a replay, a restart or a rollback draws the same fire. Its dice are its own hash (never Math.random, never the game's die).
// THE SWITCH: FIRE.on — ON in the page (`?fire=0` puts it off), OFF in the module and on the frozen stand (FROZEN_HOLDS; TPS_FIRE=1 raises it there). Off = the
// glowing lid and the steady lamp, the build as it was. tools/qa/fire-check.ts (FIRE_BREAK=1 fails it). The look was set on the software adapter's stills
// (tools/qa/fire-lab.cjs, fire-page.cjs): NEVER SEEN ON A GPU.
import { SideMap } from '../math/side';
import { Vec3 } from '../math/vec';
import type { Game, LightTarget } from './game';
import type { FireRecord } from '../render/passes';

export const FIRE = {
  on: false,
  /** a level light whose name starts with one of these is an open fire */
  names: ['brazier'] as string[],
  /** THE FLAME: its height over the coals (m, a calm flame's tallest tongue is about twice this) and its width as a share of the glowing box's half-width */
  height: 0.75, mouth: 0.87,
  /** THE COALS: the glowing box the level hung on the lamp keeps this share of its authored glow while a flame stands on it (the lid alone was authored bright
   *  enough to be the whole fire: under a flame it clips to white and the flame is lost on it), and breathes with the light by `coalSwing` of the swing */
  coals: 0.42, coalSwing: 0.6,
  /** THE LIGHT: how far its strength swings either side of the authored one (0.22 = between about 0.8 and 1.2 of it), the four rates it swings at (Hz; firelight on a yard is slower than
   *  the flames that make it: their flutter is the picture's own, render/shaders/fire.wgsl), how far its place wanders (m, across and up), and what a crack adds for `kickSecs` */
  depth: 0.22, rates: [1.3, 2.7, 4.9, 8.3] as number[], weights: [0.9, 0.7, 0.45, 0.2] as number[], wander: 0.06, wanderUp: 0.04, kick: 0.25, kickSecs: 0.12,
  /** THE WOOD CRACKS: on average this often (a second), each of the clock's `popSlot`-second slots asked once */
  popRate: 0.55, popSlot: 0.2,
  /** THE EMBERS in the air at once that the fire lets go of by itself (a crack throws its own; render/shaders/fire.wgsl) */
  embers: 10,
  /** THE SMOKE (the solver's units: 6 /m of extinction a unit of density, +1.6 m/s² a unit of heat): how high over the coals it starts as a share of the flame's
   *  height, the source's radius (m) and its least width in cells, what it lets out a second, how hot, how fast it leaves, and how hard the air is dragged along;
   *  filed afresh every `every` s for that long; only for a fire within `viewR` m of what the view looks at */
  smoke: { up: 0.85, radius: 0.12, cells: 2, density: 0.9, temp: 2.6, speed: 1.0, push: 6, jitter: 0.5, every: 1, viewR: 18, lean: 0.12 },
  /** THE SOUND: the bed's level at the fire and each crack's (× how hard the crack is), and how long one bed voice is held before the next takes over (the
   *  mixer lets a followed voice go after its own time, and one it never took — the mixer off, a page in the background — is asked for again then) */
  bed: 0.5, crack: 0.55, bedSecs: 12,
  /** the renderer takes this many fires (four at most: its uniform's size), nearest the view first, none past `drawR` m of what it looks at; the wind a flame and
   *  its embers are shown is capped at `windMax` m/s (a storm lays the smoke over, not the flame flat) */
  max: 4, drawR: 70, windMax: 3,
};

/** what the renderer is handed for one fire: render/passes.ts FireRecord (setFires → shaders/fire.wgsl FireRec); `pops` = four cracks, each seconds since (−1 =
 *  none), how hard, its seed */
export type FireDraw = FireRecord;
export interface FireStats { fires: number; lit: number; drawn: number; frames: number; smokes: number; cracks: number; beds: number; /** the light's swing this run: least and most of the authored strength, and their sum and count */ lo: number; hi: number; sum: number; n: number }
/** `lit`: a bit a fire (its place among the level's), up while it burned last frame — a fire that comes back from being out asks for its bed again */
const states = new SideMap<Game, { stats: FireStats; lit: number }>('fire.states');
const fresh = (): FireStats => ({ fires: 0, lit: 0, drawn: 0, frames: 0, smokes: 0, cracks: 0, beds: 0, lo: Infinity, hi: -Infinity, sum: 0, n: 0 });
function stateOf(g: Game) { let s = states.get(g); if (!s) { s = { stats: fresh(), lit: 0 }; states.set(g, s); } return s; }
export function fireStats(g: Game): FireStats { return stateOf(g).stats; }

/** integer hash → [0, 1) */
function h01(x: number): number { x = Math.imul((x ^ 0x2545F491) >>> 0, 0x9E3779B1) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA77) >>> 0; x ^= x >>> 13; return (x >>> 8) / 16777216; }
const TAU = Math.PI * 2;
/** what the bed's voice tells the mixer of its 'speed': the one at which a followed voice plays as it was made (audio.ts followRate: 0.8 + 0.3 k) */
const BED_K = 2 / 3;

/** is this light target an open fire (by its name: FIRE.names) */
export function isFire(t: LightTarget): boolean {
  if (t.kind !== 'analytic' || !t.light) return false;
  for (const n of FIRE.names) if (t.name.startsWith(n)) return true;
  return false;
}
/** a fire's own seed, 0‥1, off where it stands (two fires never flicker in step) */
export function fireSeed(t: LightTarget): number { return h01(Math.round(t.pos[0] * 100) * 7919 + Math.round(t.pos[2] * 100) * 104729 + 17); }
/** the cracks of the wood near `time`: the latest first, each { at, hard, seed }, none older than `back` s */
export function firePops(seed: number, time: number, back: number): { at: number; hard: number; seed: number }[] {
  const out: { at: number; hard: number; seed: number }[] = [], K = FIRE, s = Math.floor(seed * 65535), k1 = Math.floor(time / K.popSlot);
  for (let k = k1; k >= 0 && (k1 - k) * K.popSlot < back + K.popSlot; k--) {
    const a = h01(k * 2654435 + s * 31 + 1); if (a >= K.popRate * K.popSlot) continue;
    const at = (k + h01(k * 97 + s + 2)) * K.popSlot; if (at > time || time - at > back) continue;
    out.push({ at, hard: 0.35 + 0.65 * h01(k * 193 + s + 3), seed: h01(k * 389 + s + 4) });
  }
  return out;
}
/** THE LIGHT'S FLICKER at `time`: what the authored strength is multiplied by (its mean over time is 1, but for the cracks' kicks) */
export function fireFlicker(seed: number, time: number): number {
  const K = FIRE; let s = 0, w = 0;
  for (let i = 0; i < K.rates.length; i++) { s += K.weights[i] * Math.sin(TAU * (K.rates[i] * time + h01(Math.floor(seed * 65535) + i * 71))); w += K.weights[i]; }
  let f = 1 + K.depth * s / Math.max(w, 1e-6);
  for (const p of firePops(seed, time, K.kickSecs * 4)) f += K.kick * p.hard * Math.exp(-(time - p.at) / K.kickSecs);
  return f;
}

/** where the fire's mouth is and how wide: the glowing box the level hung on the lamp, or failing one a hand under the lamp */
function mouthOf(g: Game, t: LightTarget): { pos: Vec3; r: number } {
  const b = t.boxes.length ? g.engine.world.statics[t.boxes[0]] : null;
  if (b) return { pos: [b.c[0], b.c[1] + b.h[1], b.c[2]], r: Math.min(b.h[0], b.h[2]) * FIRE.mouth };
  return { pos: [t.pos[0], t.pos[1] - 0.16, t.pos[2]], r: 0.19 * FIRE.mouth };
}

/** the lamp back as the level hung it: where, and nothing said to the steady readers (its strength is updateTargets' own again the frame it paints) */
function plain(t: LightTarget) { const l = t.light!; l.pos[0] = t.pos[0]; l.pos[1] = t.pos[1]; l.pos[2] = t.pos[2]; if (l.steady !== undefined) l.steady = undefined; }

/** Once a frame, straight behind every paint of the lamps (game.ts behind updateTargets; with `dt` 0 behind a checkpoint's load and a clean restart, which paint
 *  them too: the lamp, its place and the coals as this clock has them, and nothing filed) and with the wind this frame's. */
export function updateFire(g: Game, dt: number) {
  const E = g.engine;
  if (!FIRE.on) {
    if (states.get(g)) { for (const t of g.targets) if (isFire(t)) plain(t); states.delete(g); if (E.fires?.length) E.fires = []; }   // (put off in a running page: the lamp back where the level hung it, its strength is updateTargets' again)
    return;
  }
  let any = false; for (const t of g.targets) if (isFire(t)) { any = true; break; }
  if (!any) { if (E.fires?.length) E.fires = []; return; }   // (nothing of this file runs on a floor with no fire)
  const S = stateOf(g), T = S.stats, K = FIRE, time = g.time, was = time - Math.max(dt, 0);
  const focus = g.engine.viewFocus ?? g.player.char.pos, drawing = g.smoke.drawing?.() === true;
  const list: (FireDraw & { d: number })[] = []; let fires = 0, lit = 0, mask = 0;
  if (dt > 0) T.frames++;
  for (const t of g.targets) {
    if (!isFire(t)) continue;
    const bit = fires < 31 ? 1 << fires : 0; fires++;
    const l = t.light!, heat = Math.max(0, Math.min(1, t.factor));
    if (!(heat > 0.001) || !l.enabled) { plain(t); continue; }
    lit++; mask |= bit;
    const seed = fireSeed(t), fl = fireFlicker(seed, time), M = mouthOf(g, t), si = Math.floor(seed * 65535);
    // the light: the authored lamp × the flicker, its place wandering with the flames; what a reader of the place's STEADY light takes it for is the authored lamp
    if (!l.steady) l.steady = { intensity: 0, pos: [t.pos[0], t.pos[1], t.pos[2]] };
    l.steady.intensity = t.baseIntensity * t.factor;
    l.intensity = l.steady.intensity * fl;
    l.pos[0] = t.pos[0] + K.wander * Math.sin(TAU * (0.83 * time + h01(si + 5))) * Math.sin(TAU * (2.9 * time + h01(si + 6)));
    l.pos[2] = t.pos[2] + K.wander * Math.sin(TAU * (0.71 * time + h01(si + 7))) * Math.sin(TAU * (3.3 * time + h01(si + 8)));
    l.pos[1] = t.pos[1] + K.wanderUp * (fl - 1) / Math.max(K.depth, 1e-6);
    { const ck = t.factor * K.coals * (1 + K.coalSwing * (fl - 1)); for (const bi of t.boxes) { const bx = g.engine.world.statics[bi]; if (bx) bx.emissive = [t.baseEmissive[0] * ck, t.baseEmissive[1] * ck, t.baseEmissive[2] * ck]; } }   // (updateTargets painted it at its authored glow a moment ago, and does again the frame the switch goes off)
    if (dt > 0) { T.lo = Math.min(T.lo, fl); T.hi = Math.max(T.hi, fl); T.sum += fl; T.n++; }
    const wv = g.wind.at([M.pos[0], M.pos[1] + K.height * 0.6, M.pos[2]]), wl = Math.hypot(wv[0], wv[2]), wk = wl > K.windMax ? K.windMax / wl : 1;
    const wind: [number, number] = [wv[0] * wk, wv[2] * wk];
    const dx = M.pos[0] - focus[0], dz = M.pos[2] - focus[2], d = Math.hypot(dx, dz);
    // the cracks: the last four for the picture, and the one that fell in this frame for the ear
    const pops = firePops(seed, time, 1.5), rec: number[] = [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0];
    for (let i = 0; i < pops.length && i < 4; i++) { rec[i * 3] = time - pops[i].at; rec[i * 3 + 1] = pops[i].hard; rec[i * 3 + 2] = pops[i].seed; }
    if (dt > 0) for (const p of pops) if (p.at > was && p.at <= time) { T.cracks++; g.audio.play('fireCrack', M.pos, K.crack * (0.5 + 0.5 * p.hard) * heat, { rate: 0.8 + 0.5 * p.seed }); }
    // the bed: one held voice, asked for when the fire starts to burn (the first frame, lit again after being out) and handed on every `bedSecs`
    if (dt > 0) { const slot = Math.floor(time / K.bedSecs);
      if (slot !== Math.floor(was / K.bedSecs) || was <= 0 || !(S.lit & bit)) { T.beds++; const end = (slot + 1) * K.bedSecs + 0.35, me = t, at = M.pos;
        g.audio.play('fireBed', at, K.bed, { follow: () => FIRE.on && g.time < end && g.time >= end - K.bedSecs - 0.4 && me.factor > 0.001 ? { pos: at, k: BED_K * Math.min(1, me.factor), t: g.time } : null }); } }
    // the smoke: a short source on the solver, filed afresh every `every` s while the fire is near the view
    if (dt > 0 && drawing && d < K.smoke.viewR) { const B = K.smoke, slot = Math.floor(time / B.every);
      if (slot !== Math.floor(was / B.every) || was <= 0) { T.smokes++;
        const sk = wl > 8 ? 8 / wl : 1, dir: Vec3 = [wv[0] * sk * B.lean, 1, wv[2] * sk * B.lean];
        g.smoke.emit({ pos: [M.pos[0], M.pos[1] + K.height * B.up, M.pos[2]], dir, speed: B.speed, radius: B.radius, minVoxels: B.cells, density: B.density * heat, temperature: B.temp * heat, ttl: B.every, age: 0, kind: 'cloud',
          push: B.push, jitter: B.jitter, lattice: 'coarse', look: true }); } }
    if (d < K.drawR) list.push({ pos: M.pos, r: M.r, h: K.height, heat, seed, time: time % 4096, wind, flick: fl, embers: K.embers, pops: rec, d });
  }
  T.fires = fires; T.lit = lit; if (dt > 0) S.lit = mask;
  const cap = Math.max(0, Math.min(4, Math.floor(K.max)));
  if (list.length > cap) { list.sort((a, b) => a.d - b.d); list.length = cap; }   // (which ones, not in what order: the composite orders them ray by ray)
  T.drawn = list.length; E.fires = list;
}
/** one line for the panel / the probes */
export function fireSummary(g: Game): string {
  const T = stateOf(g).stats;
  return FIRE.on ? `fire ▸ ${T.lit} of ${T.fires} burning, ${T.drawn} drawn · light ${T.n ? `${T.lo.toFixed(2)}‥${T.hi.toFixed(2)} (mean ${(T.sum / T.n).toFixed(3)})` : '—'} · ${T.cracks} cracks, ${T.smokes} smoke sources, ${T.beds} bed voices` : 'fire: the switch is off';
}
