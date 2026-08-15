// Wet characters (the weather's other half — game/weather.ts rains, this soaks whoever stands in it). ONE model, presentation and state alike: every Character
// (Sam, the shift, the QRF, the breach cast, a body lying in the lot) carries `wet` (the coat: 0 dry ‥ 1 soaked) and `beads` (the layer of drops standing on
// him and running down him), driven here once a frame from where he is:
//   OUTDOORS  = outside the interior footprint AND outside the roofed stair tower (weather.ts INTERIOR / ANNEX — the very rectangles the rain shader draws by)
//               AND nothing solid between his head and the sky (an upward CPU ray through the level's own collision boxes: a man under a canopy, a lintel or a
//               roof slab stays dry — cached a quarter of a second per man, so it costs nothing);
//   IN RAIN   = outdoors while the frame actually draws rain (engine.weather.rain > 0: the storm on, not held by the breach's day, rate above zero) —
//               the coat rises at WET.soakPerSec × (0.4 + 0.6 × rate) (soaked in ~6 s in a downpour), the beads come up three times as fast toward a level the
//               rate sets; otherwise the coat dries at WET.dryPerSec (~25 s) and the beads run off in WET.beadRunoffSecs (~3 s).
// The renderer reads the two numbers per character (game.ts → CharacterRenderer.setInstance → gbuffer.wgsl fsSkin: darker, saturated fabric, a glossy clear
// coat lit in composite.wgsl, procedural drops beading and sliding down the body in its own bind-pose space) — and nothing when settings.wetChars is off or
// nobody is wet: the character shading is then bit for bit what it was.
// Two small marks of it in the world, both Sam's and both for the PLAYER's eyes only (nobody reacts to them — a follow-up for the guards' side of the one
// model: a searcher noticing wet prints): a soaked man come indoors DRIPS for a few seconds (GPU water-drop particles off his hands and hem, particleFx's
// 'debris' kind — nothing with the particles off) and leaves WET FOOTPRINTS, a 'wetprint' decal per step for his next WET.prints steps, fainter each step,
// each fading out over WET.printFadeSecs (decals.wgsl wetPrint; nothing with the decals off).
import { Vec3, v3, clamp } from '../math/vec';
import type { Game } from './game';
import type { Character } from './character';
import type { WeatherFrame } from '../render/frame';
import type { Decal } from '../render/decals';
import { INTERIOR, ANNEX } from './weather';
import { gpuFx } from './particleFx';
import { PLAYER_ID } from './consts';

/** The knobs (Tab ▸ Weather ▸ wet characters; kept per machine like the whistle's). The first block is the model's, the second the look's — those ride to the
 *  GPU per character instance (anim/characters.ts setInstance) so the shaders need no uniform of their own. */
export const WET_DEFAULTS = {
  soakPerSec: 1 / 6,        // coat rise per second in a downpour (× (0.4 + 0.6 × rain rate))
  dryPerSec: 1 / 25,        // coat fall per second out of the rain
  beadRunoffSecs: 3,        // the drops standing on him run off / soak in this long after he comes out of the rain
  beadDensity: 0.6,         // fraction of the drop lattice's cells holding a drop at full beads (× the beads level, which follows the rain rate)
  beadSize: 0.0075,         // drop radius (m) — ×0.75‥1.25 per drop
  trailLen: 0.11,           // how far a drop runs before it is spent (m) — the wet trail it draws behind it is this long at most
  roughWet: 0.12,           // GGX roughness (perceptual: alpha = its square) of the water film's streaks and a drop's trail — tight: the glints are the point (each pixel widens the lobe by what it cannot resolve, gbuffer.wgsl fsSkin) …
  roughDry: 0.55,           // … and of merely damp cloth (the last of the coat as it dries: a wide dim lobe)
  darken: 1.0,              // wet fabric: albedo × lum^(darken × coat) … (its own luminance to that power: dark cloth drops hardest — soaked khaki to about a quarter — and the hue holds)
  darkenMul: 0.35,          // … × (1 − darkenMul × coat), then a quarter more saturated about that grey at full soak
  specGain: 1.0,            // × the coat's specular (direct lights + the sheen off the ambient); 0 = darkening only
  dripSecs: 5,              // a soaked man come indoors drips about this long (the rate follows his beads running off)
  prints: 10,               // wet footprints after coming in from the rain, fainter each step
  lineBand: 0.12,           // m of damp cloth ABOVE a waterline (a man wet to the knee by wading: the coat wicks this far up past the water and fades to dry across it)
  printFadeSecs: 30,        // each print dries out over this long
};
export type WetKnobs = typeof WET_DEFAULTS;
export const WET: WetKnobs = { ...WET_DEFAULTS };

/** per-character bookkeeping that is nobody else's business: the cached sky test, Sam's print budget and drip clock */
interface WetMem { skyT: number; open: boolean; printsLeft: number; lastOutWetT: number; dripAcc: number; }
const mem = new WeakMap<Character, WetMem>();
const memOf = (c: Character): WetMem => { let m = mem.get(c); if (!m) { m = { skyT: -1, open: true, printsLeft: 0, lastOutWetT: -1e9, dripAcc: 0 }; mem.set(c, m); } return m; };
/** the prints this module placed, with when: aged (param) and retired here, cleared with every other mark by resetLevelState */
interface PrintRec { d: Decal; t0: number; k0: number; }
const prints = new WeakMap<Game, { list: PrintRec[]; ageT: number }>();
const printsOf = (g: Game) => { let p = prints.get(g); if (!p) { p = { list: [], ageT: 0 }; prints.set(g, p); } return p; };
/** counters for the panel / probes */
export const WET_STATS = { skyTests: 0, prints: 0, drips: 0 };

/** inside the building's footprint or the roofed stair tower — the rectangles the rain is drawn by (weather.ts / volumetrics.wgsl weatherC / weatherD) */
export function underRoofRect(p: Vec3): boolean {
  const inR = (r: [number, number, number, number]) => p[0] >= r[0] && p[2] >= r[1] && p[0] <= r[2] && p[2] <= r[3];
  return inR(INTERIOR) || inR(ANNEX);
}
/** Is `c` standing (or lying) under the open sky: outside both no-rain rectangles and with no ROOF over him — upward rays through the level's collision boxes
 *  (statics and door leaves) from just over head height to well above the street lamps, one over his head and four a forearm out round him: he is sheltered
 *  only if most of that footprint is covered (a canopy, a slab, a landing — not the cobra head of the lamp he happens to stand under, which would otherwise
 *  be a 40 cm umbrella). Cached WET_SKY_SECS per character: a handful of rays a second per outdoor man. */
const WET_SKY_SECS = 0.25, SKY_TOP = 9, SKY_RING = 0.35;
const SKY_OFFSETS: [number, number][] = [[0, 0], [SKY_RING, 0], [-SKY_RING, 0], [0, SKY_RING], [0, -SKY_RING]];
export function openSky(g: Game, c: Character): boolean {
  const p = c.pos;
  if (underRoofRect(p)) return false;
  const m = memOf(c);
  if (g.time - m.skyT >= WET_SKY_SECS || m.skyT < 0 || g.time < m.skyT) {
    m.skyT = g.time;
    const headY = c.ragdoll ? Math.max(0.3, (c.bones.head?.[1] ?? 0.3)) : (c.bones.head?.[1] ?? p[1] + 1.6);
    let covered = 0;
    for (const [dx, dz] of SKY_OFFSETS) if (g.col.solidBlocked([p[0] + dx, headY + 0.15, p[2] + dz], [p[0] + dx, SKY_TOP, p[2] + dz], 0.02)) covered++;
    m.open = covered < 3;
    WET_STATS.skyTests++;
  }
  return m.open;
}
/** the rain rate actually being drawn this frame (0 with the storm off, held by day, or a dry storm) — engine.weather is what weather.ts wrote for the renderer */
export function rainNow(g: Game): number { return Math.max(0, (g.engine as { weather?: WeatherFrame }).weather?.rain ?? 0); }
/** is `c` being rained on right now */
export function inRain(g: Game, c: Character): boolean { return rainNow(g) > 0.001 && openSky(g, c); }

/** every character the game draws: Sam, then the guards (shift, units, the breach's cast — whoever is in Game.guards), living or not */
export function everyCharacter(g: Game): Character[] { return [g.player.char, ...g.guards.map(gd => gd.char)]; }

/** Once a frame (game.ts, after the weather has written this frame's rain): soak / dry everybody, and Sam's drips + print budget. */
export function updateWetness(g: Game, dt: number) {
  if (dt <= 0) return;
  const rain = rainNow(g);
  for (const c of everyCharacter(g)) {
    const wetting = rain > 0.001 && openSky(g, c);
    if (wetting) {
      c.wetLine = Infinity;   // the rain wets all of him (a man wet to the knee who steps out into it is simply wet)
      c.wet = clamp(c.wet + WET.soakPerSec * (0.4 + 0.6 * rain) * dt, 0, 1);
      const beadsTo = clamp(0.35 + 0.65 * rain, 0, 1);
      c.beads = c.beads < beadsTo ? Math.min(beadsTo, c.beads + 3 * WET.soakPerSec * (0.4 + 0.6 * rain) * dt) : Math.max(beadsTo, c.beads - dt / Math.max(WET.beadRunoffSecs, 0.1));
      c.wetRain = c.wetRain + (rain - c.wetRain) * Math.min(1, dt * 2);   // the rate the drops on him were fed at (their density and pace on the GPU) — eased, so a gust on the slider does not repattern him in a frame
    } else {
      c.wet = clamp(c.wet - WET.dryPerSec * dt, 0, 1);
      c.beads = clamp(c.beads - dt / Math.max(WET.beadRunoffSecs, 0.1), 0, 1);
      // (wetRain holds: the last drops run off at the pace they came at)
    }
    if (c.wet <= 0 && c.beads <= 0) { c.wetRain = 0; c.wetLine = Infinity; }   // dry: the next wetting starts from a whole man again unless whoever wets him says otherwise
  }
  samAftermath(g, dt);
  agePrints(g);
}

// ---------------------------------------------------------------- Sam indoors after the rain: drips and prints (presentation only)
function samAftermath(g: Game, dt: number) {
  const pl = g.player; const c = pl.char; const m = memOf(c);
  const raining = rainNow(g) > 0.001 && openSky(g, c);
  if (raining) { if (c.wet > 0.5) { m.printsLeft = WET.prints; m.lastOutWetT = g.time; } return; }
  // drips: water running off a soaked man for a few seconds after he comes in — the beads layer IS that water, so the rate follows it (and stops with it)
  if (c.beads > 0.02 && c.wet > 0.3 && g.time - m.lastOutWetT < WET.dripSecs && !pl.down) {
    m.dripAcc += dt * (2 + 10 * c.beads);
    while (m.dripAcc >= 1) { m.dripAcc -= 1; drip(g, c); }
  } else m.dripAcc = 0;
}
/** one drop off him: from a hand, the chin or the hem of the jacket, falling, gone when it lands (GPU 'debris' particle: lit, collides, short-lived) */
const DRIP_FROM = ['handL', 'handR', 'head', 'hips', 'hips'] as const;
let dripN = 0;
function drip(g: Game, c: Character) {
  const P = gpuFx(g); if (!P) return;
  const k = DRIP_FROM[dripN++ % DRIP_FROM.length]; const b = c.bones[k]; if (!b) return;
  const j = dripN * 0.618034; const off: Vec3 = [Math.cos(j * 6.2831853) * 0.09, k === 'head' ? -0.12 : k === 'hips' ? -0.05 : -0.06, Math.sin(j * 6.2831853) * 0.09];   // round the hem / off the fingers / under the chin (dealt, not drawn: nothing here touches Math.random)
  P.emit('debris', v3.add(b, off), [0, -1, 0], 1, { speed: 0.4, speedJit: 0.5, spread: 0.15, life: 0.55, lifeJit: 0.3, size: 0.0045, sizeJit: 0.3, vadd: c.vel, owner: c.id, color: [0.42, 0.47, 0.55] });
  WET_STATS.drips++;
}

/** A footfall of Sam's (player.ts, the step site — after tread()): if he has come in wet, a print under the foot that landed, fainter each step. `leftHint` = which
 *  foot the gait phase says; the foot actually AHEAD along his motion is the one that has just come down, so that wins whenever he is moving. */
export function wetFootfall(g: Game, leftHint: boolean) {
  const c = g.player.char; const m = memOf(c);
  if (m.printsLeft <= 0 || c.wet < 0.15) return;
  if (rainNow(g) > 0.001 && openSky(g, c)) return;          // still out in it: the ground is wetter than his soles
  let left = leftHint;
  { const fl = c.bones.footL, fr = c.bones.footR; if (fl && fr && (Math.abs(c.vel[0]) + Math.abs(c.vel[2]) > 0.2)) left = (fl[0] - fr[0]) * c.vel[0] + (fl[2] - fr[2]) * c.vel[2] > 0; }
  const foot = c.bones[left ? 'footL' : 'footR'], toe = c.bones[left ? 'toeL' : 'toeR']; if (!foot || !toe) return;
  const k = (m.printsLeft / Math.max(1, WET.prints)) * clamp(c.wet * 1.3, 0, 1);   // strength: the budget left × how wet he still is
  m.printsLeft--;
  const dir = v3.normalize([toe[0] - foot[0], 0, toe[2] - foot[2]]);
  const centre: Vec3 = [foot[0] * 0.45 + toe[0] * 0.55, 0.005, foot[2] * 0.45 + toe[2] * 0.55];   // mid-sole, on the floor (the decal's plane test takes the finish / rug a few mm either way)
  // onto whatever he stands on: the floor under the sole (a rug, a runner, the raised floor — the nearest static top face under it)
  const hit = g.col.raycast([centre[0], 0.4, centre[2]], [0, -1, 0], 0.8);
  const y = hit ? 0.4 - hit.t : 0; centre[1] = y + 0.003;
  const d = g.decals.add('wetprint', centre, [0, 1, 0], 0.17, { tangent: dir, param: k, seed: (left ? 0 : 1) | ((WET_STATS.prints * 37) & 0xffe) });   // seed bit 0 = which foot (the sole is mirrored), the rest = look
  if (!d) return;
  printsOf(g).list.push({ d, t0: g.time, k0: k }); WET_STATS.prints++;
}
/** age the prints four times a second: param falls linearly to nothing over printFadeSecs, then the decal is retired (Decals.remove) */
function agePrints(g: Game) {
  const P = prints.get(g); if (!P || !P.list.length) return;
  if (g.time - P.ageT < 0.25 && g.time >= P.ageT) return;
  P.ageT = g.time;
  let changed = false;
  for (let i = P.list.length - 1; i >= 0; i--) {
    const r = P.list[i];
    if (!g.decals.list.includes(r.d)) { P.list.splice(i, 1); continue; }   // recycled by the ring or cleared with the encounter
    const k = r.k0 * (1 - (g.time - r.t0) / Math.max(1, WET.printFadeSecs));
    if (k <= 0.01) { g.decals.remove(r.d); P.list.splice(i, 1); changed = true; continue; }
    if (Math.abs(k - r.d.param) > 0.004) { r.d.param = k; changed = true; }
  }
  if (changed) g.decals.touch();
}
/** live prints (probes / panel) */
export function wetPrints(g: Game): readonly PrintRec[] { return printsOf(g).list; }
/** forget every print record (game.ts resetLevelState, next to decals.clear(): the decals themselves go with every other mark) */
export function clearWetPrints(g: Game) { const P = prints.get(g); if (P) P.list.length = 0; }

// ---------------------------------------------------------------- what the renderer is handed per character (game.ts → CharacterRenderer.setInstance)
/** [coat, beads, rain, phase] — all zero when the setting is off or the man is dry (the shaders then do exactly what they did before any of this) */
export function wetInstance(g: Game, c: Character, on: boolean, out: Float32Array, o: number) {
  if (!on || (c.wet <= 0 && c.beads <= 0)) { out[o] = 0; out[o + 1] = 0; out[o + 2] = 0; out[o + 3] = 0; return; }
  out[o] = c.wet; out[o + 1] = c.beads; out[o + 2] = c.wetRain; out[o + 3] = ((c.id * 0.7548777) % 1) * 40;   // phase: the drop lattice's clock offset per man (two men side by side do not bead in step)
}
/** [line, band, 0, 0] — gbuffer.wgsl CharInst.wetK3: the coat (and any drops) only BELOW `line` bind-pose metres up him, easing to nothing across `band` above it. Infinity (the rain's
 *  whole man) rides as WET_LINE_ALL: the shader's smoothstep wants finite ends. */
export const WET_LINE_ALL = 1e4;
export function wetLineRow(c: Character, out: Float32Array, o: number) {
  out[o] = Number.isFinite(c.wetLine) ? Math.max(0, c.wetLine) : WET_LINE_ALL; out[o + 1] = Math.max(0.005, Number.isFinite(WET.lineBand) ? WET.lineBand : WET_DEFAULTS.lineBand); out[o + 2] = 0; out[o + 3] = 0;
}
/** the look knobs, eight floats in the order gbuffer.wgsl CharInst.wetK / wetK2 read them */
const KNOB_ORDER: (keyof WetKnobs)[] = ['beadDensity', 'beadSize', 'trailLen', 'roughWet', 'roughDry', 'darken', 'darkenMul', 'specGain'];
export function wetKnobs(out: Float32Array, o: number) {
  for (let i = 0; i < 8; i++) { const k = KNOB_ORDER[i]; const [lo, hi] = WET_RANGE[k]; const v = WET[k]; out[o + i] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : WET_DEFAULTS[k]; }   // clamped to the panel's ranges whatever the console wrote: a zero bead radius would be a division by nothing per pixel
}

// ---------------------------------------------------------------- panel / console / probes
/** soak one man by hand — as if he had this moment stepped in out of a downpour (the defaults: whole man, beads, the rain's pace: the panel's 'soak Sam now', __wet.set(i, …), the probes),
 *  or up to a `line` (bind-pose m above the sole) as if he had waded that deep: 'wet to the knee' = soak(g, c, 1, 0, 0, 0.55) — the coat below the line, no drops, no rain */
export function soak(g: Game, c: Character, wet = 1, beads = wet, rain = 0.8, line = Infinity) {
  c.wet = clamp(wet, 0, 1); c.beads = clamp(beads, 0, 1); c.wetRain = c.wet > 0 || c.beads > 0 ? rain : 0; c.wetLine = line > 0 ? line : Infinity;
  if (c.id === PLAYER_ID) { const m = memOf(c); m.printsLeft = c.wet > 0.5 ? WET.prints : 0; m.lastOutWetT = g.time; }
}
export function dryAll(g: Game) { for (const c of everyCharacter(g)) { c.wet = 0; c.beads = 0; c.wetRain = 0; } }
/** 'wet ▸ Sam 0.82 coat / 0.40 beads (indoors, dry air) · Kowalski 0.00 …' */
export function wetSummary(g: Game): string {
  const rain = rainNow(g);
  const one = (name: string, c: Character) => `${name} ${c.wet.toFixed(2)}/${c.beads.toFixed(2)}${rain > 0.001 && openSky(g, c) ? ' RAIN' : underRoofRect(c.pos) ? '' : ' out'}`;
  return `wet ▸ rain ${rain.toFixed(2)} · ${one('Sam', g.player.char)} · ${g.guards.map(gd => one(gd.callsign ?? String(gd.char.id), gd.char)).join(' · ')} · prints ${printsOf(g).list.length} live / ${WET_STATS.prints} · drips ${WET_STATS.drips}`;
}

// ---------------------------------------------------------------- persistence (one key per machine, the whistle's pattern)
const LS_KEY = 'twopointsix.wet';
const KEPT = Object.keys(WET_DEFAULTS) as (keyof WetKnobs)[];
export function saveWet() { try { const out: Record<string, number> = {}; for (const k of KEPT) out[k] = WET[k]; localStorage.setItem(LS_KEY, JSON.stringify(out)); } catch { /* no storage */ } }
/** the range each knob may take (= the panel's sliders): a STORED value outside it is refused at load, and whatever the console writes is clamped into it on its way to the GPU (wetKnobs) */
export const WET_RANGE: Record<keyof WetKnobs, [number, number]> = {
  soakPerSec: [0.02, 1], dryPerSec: [0.005, 0.5], beadRunoffSecs: [0.5, 15], beadDensity: [0, 1], beadSize: [0.003, 0.02], trailLen: [0.02, 0.3],
  roughWet: [0.03, 0.5], roughDry: [0.2, 0.65], darken: [0, 1.5], darkenMul: [0, 0.6], specGain: [0, 2], dripSecs: [0, 30], prints: [0, 30], printFadeSecs: [5, 120],
  lineBand: [0.005, 0.6],
};
export function loadWet() {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (!j || typeof j !== 'object') return;
    for (const k of KEPT) { const v = (j as Record<string, unknown>)[k]; const [lo, hi] = WET_RANGE[k]; if (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi) WET[k] = v; }
  } catch { /* the shipped values stand */ }
}
export function resetWet() { Object.assign(WET, WET_DEFAULTS); try { localStorage.removeItem(LS_KEY); } catch { /* none */ } }
loadWet();
