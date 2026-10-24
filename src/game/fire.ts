// AN OPEN FIRE — the oil drum of burning wood a level stands in a yard (the pass's and the yard's braziers). The maintainer, 10-23: 'we gotta improve our fire! we have
// barrels with fire on them … great fire with smoke and crackles and dynamic lighting would look sick.' Until now such a drum was a glowing lid and a steady lamp.
//   WHICH     a level's light whose name starts with one of FIRE.names ('brazier'), with the glowing box the level hung on it (its mouth: where, and how wide).
//             TODO(LevelData): a `fire` key on the light; today the name says it, as a street lamp's height says it to the moths.
//   THE LIGHT the level's own lamp, as authored, FLICKERED: its strength about the authored one (the noise's mean is the authored number; the cracks' kick puts about a twentieth on it), its place wandering a hand's
//             width, a kick when the wood cracks. An engine light like any other, so the picture, the bounce, the men lit by it and the LIGHT METER all have the
//             same thing: near a fire a man's reading now moves with the flames (docs/agents/render.md has what was measured).
//   THE COALS the glowing box the level hung on the lamp, dimmed to a share of its authored glow under the flame and breathing with the light (FIRE.coals).
//             Its glow reaches the bounce like any glowing box's, so what the GPU's meter reads of the lid is that much less; the CPU's estimate never read it.
//   THE FLAME a small volume of light the composite draws over the drum's mouth, with the smoke off its tips and the shimmer of the air over it — closed forms of
//             the game's clock (render/shaders/fire.wgsl; this file hands the renderer a record a fire, the four nearest the view, and FIRE.look's numbers).
//             Picture only: a replay, a restart or a rollback draws the same flame.
//   THE EMBERS GPU particles (render/particles.ts, sparks filed as embers), for a fire near the view, when the page has particles (none without: `?noparticles`).
//             The host's: what a fire still owes is kept in the host's book, and the pool is the picture's, so a replay's embers are like, not the same. They are
//             drawn after the composite: the flame does not hide one behind it, and the shimmer does not move them.
//   THE SMOKE real gas in the smoke solver: a hot source as wide as the drum, filed over the flames, on the lattice the cans' smoke lives on, so it climbs, leans in
//             the wind, pools under a roof and is lit by its own fire. A LOOK source (smoke/types.ts `look`): the game's own smoke, the one sight lines are cut
//             by on the headless stand, never hears of it; in the page the men's sight lines are read off the solver, so the source's FOOT is over a standing
//             man's head and the gas only climbs from there: a line at 1.9 m or under keeps its light (a line starts to count smoke under 0.8 of it; measured
//             in the page, docs/agents/render.md). Two things learnt setting it: a source two cells wide does not climb in the solver whatever its heat (it
//             hung where it was filed, a haze at head height that cut a line along the wind to a quarter), one five cells wide does. Only for a fire near the
//             view (FIRE.smoke.viewR), only while the solver draws, and not on the graphics preset that sheds it (the floor rung: settings.fireSmoke, written by
//             ui/quality.ts FIRE SMOKE SHED): while one is, the solver is awake (the same file has what that costs).
//   THE SOUND a low bed that follows the fire's heat, and a crack with each pop of the wood — the same pop that throws embers and kicks the light. The mixer's
//             alone: no event is filed, nobody in the game hears a fire.
//   WHEN OUT  the lamp's own target says (shot out, the pistol's jammer, a level that starts it cold): no light, so no flame, smoke or sound either.
// NOBODY reads any of it but the light meter — and of the meter, only who asks how lit a MAN is now. A rule that asks for a place's STEADY light (guards.ts
// lightEstimateAt, `steadyOnly`: is this room lit enough to work in, is that floor dark) is told the lamp without its flicker (RtLight.steady: the level's strength × FIRE.bright, where the level hung it, the level's size). Its clock is the game's (`g.time`): every number here is a closed form of it, nothing is kept between frames but the
// counts the probes read — a replay, a restart or a rollback draws the same fire. What hangs on the HOST (is a solver drawing, the graphics preset, where
// the view looks, the bed's voice in the mixer) is kept on the host (`engine.hostBooks.fire`): no snapshot or state hash carries it. Its dice are its own hash (never Math.random, never the game's die).
// THE SWITCH: FIRE.on — ON in the page (`?fire=0` puts it off), OFF in the module and on the frozen stand (FROZEN_HOLDS; TPS_FIRE=1 raises it there). Off = the
// glowing lid and the steady lamp, the build as it was. tools/qa/fire-check.ts (FIRE_BREAK=1 fails it). The look was set on the software adapter's stills
// (tools/qa/fire-lab.cjs, fire-page.cjs). SEEN ON A GPU ONCE, the first cut, in one still: docs/agents/render.md says what it showed and what was changed for it;
// the second in two ("still very ugly"); the third he played, and set the look's numbers himself in the fire lab (FIRE.look, below).
import { SideMap } from '../math/side';
import { Vec3 } from '../math/vec';
import type { Game, LightTarget } from './game';
import type { FireRecord } from '../render/passes';
import { gpuFx } from './particleFx';

/** FIRE.size as the page opens (host/profile.ts puts it back when `?firesize=0` is not on the address) */
export const FIRE_SIZE = 1.1;
/** FIRE.look.shimmer and .plume and FIRE.embers as the page opens (`?fireheat=0`, `?fireplume=0`, `?fireembers=0` put them at 0) */
export const FIRE_SHIMMER = 0.019, FIRE_PLUME = 1, FIRE_EMBERS = 60;
/** … and the lamp's and the look's newer numbers as the page opens: FIRE.bright, .warm, .reach, .lift (`?firebright=0` = 1, no tint, 1 and 0.25: the level's lamp as
 *  it was hung), FIRE.wander / .wanderUp (`?firesway=0` = the 6 and 4 cm they were), FIRE.look.react (`?firereact=0`) and FIRE.look.lean (`?firelean=0` = the 0.07 it was) */
export const FIRE_BRIGHT = 1.25, FIRE_REACH = 1.4, FIRE_LIFT = 0.5, FIRE_LIFT_WAS = 0.25, FIRE_WARM: readonly number[] = [1, 0.72, 0.51], FIRE_WANDER = 0.14, FIRE_WANDER_UP = 0.1, FIRE_WANDER_WAS = 0.06, FIRE_WANDER_UP_WAS = 0.04,
  FIRE_REACT = 1, FIRE_LEAN = 0.2, FIRE_LEAN_WAS = 0.07, FIRE_STEPS = 40;
export const FIRE = {
  on: false,
  /** a level light whose name starts with one of these is an open fire */
  names: ['brazier'] as string[],
  /** THE FLAME: its height over the coals (m, a calm flame's tallest tongue is about twice this) and its radius as a share of the glowing box's half-width (the box is a
   *  plate in the middle of a drum's lid: the fire fills the drum's mouth) */
  height: 1.15, mouth: 1.15,
  /** THE COALS: the glowing box the level hung on the lamp keeps this share of its authored glow while a flame stands on it (the lid alone was authored bright
   *  enough to be the whole fire: under a flame it clips to white and the flame is lost on it), and breathes with the light by `coalSwing` of the swing */
  coals: 0.26, coalSwing: 0.6,
  /** … and THE BED OF COALS the picture lays over that box (render/shaders/fire.wgsl fireCoals): its radius as a share of the box's half-width (0.27 m on a
   *  0.29 m drum: all of its lid but the rim — the lid is lit white by its own lamp, and the bed is what hides that) */
  bedR: 1.42,
  /** THE LIGHT: how far its strength swings either side of the authored one (the noise's weight: at 0.4 about a fifth of it most of the time, two fifths now and then, never past `least` and `most`; with the cracks' kick on top the mean runs a twentieth over the authored), the rates it swings at (Hz; firelight on a yard is slower than
   *  the flames that make it: their flutter is the picture's own, render/shaders/fire.wgsl), how far its place wanders (m, across and up) about a point `lift` m over where the level hung it
   *  (a level hangs the lamp a hand over the lid; the light of a fire comes from the body of its flame, and from there the drum's own shadow on the ground is
   *  half as wide), and what a crack adds for `kickSecs` */
  depth: 0.4, rates: [0.43, 1.3, 2.7, 4.9, 8.3] as number[], weights: [0.8, 0.9, 0.7, 0.45, 0.2] as number[], least: 0.6, most: 1.6, wander: FIRE_WANDER, wanderUp: FIRE_WANDER_UP, lift: FIRE_LIFT, kick: 0.6, kickSecs: 0.12,
  /** A FIRE THROWS A FIRE'S LIGHT (the maintainer's third look, on his GPU beside the gate's flood: "still seems way too dark, especially relative to the other lights
   *  in the scene"; "i'd also expect the color from the fire to be more warm"): the level hung a 9 on the pass's brazier where a room's bulb is 26 and the gate's flood 70,
   *  in a lantern's colour, a hand over the lid. While it burns the lamp stands `lift` 0.5 m over the lid, in the body of the flame (at 0.25 the drum's own rim
   *  shadowed the ground a metre and a half round it: the dark ring in his shot, which ate most of its pool), reaches × `reach` as far, its colour is × `warm` (a
   *  deeper orange) and its strength × `bright`: 1.25 and no more, because THE TONE CURVE PALES A BRIGHT ORANGE ON SNOW TO CREAM. More strength reads as whiter, not
   *  warmer, and a flame cannot look bright over ground brighter than itself (tried at 3 in the real page: the yard washed out and the flame went pale against it).
   *  The warm of a fire is in the wide dimmer pool, and the brightness of it is the flame's own (`look.gain`, `look.core`). THE GAME READS IT: the light meter, and
   *  the steady readers are told the lamp as it is (a place by a fire IS that lit). `?firebright=0` = 1, 1, no tint and 0.25: the lamp as the level hung it.
   *  ITS PLACE SHIFTS ("shadows cast by the fire should be more dynamic i think. the fire as an emitter should be shifting continuously over time"): `wander` /
   *  `wanderUp` above are 14 and 10 cm, where they were 6 and 4 (`?firesway=0`), which is what moves a shadow's edge. NEVER SEEN ON A GPU. */
  bright: FIRE_BRIGHT, warm: [...FIRE_WARM] as number[], reach: FIRE_REACH,
  /** NOTHING PUTS A FIRE OUT BUT ITS SWITCH ("fire getting put out by a grenade is weird"): a blast's fixture rule and the player's round, which break a bulb, leave
   *  a burning fire burning and stir it (a throw of embers and a crack: the host's picture and the mixer). A level's own script or switch still puts it out.
   *  `?firehardy=0` = a round or a blast puts it out like a bulb, as it did. */
  hardy: true, stirGap: 0.3,
  /** THE LAMP IS AS BIG AS WHAT BURNS (the emitter's radius while the fire burns, as a share of the mouth's, which is the flame's own reach: 0.24 m on the pass's drum; 0 = the size the level
   *  gave it, a pinpoint, which is `?firesize=0` in the page): a flame is a hand and a half
   *  wide and lights the ground from all of itself, so the drum's own shadow in the snow is a soft ramp. With the level's 6 cm it was a black disc with a
   *  drawn edge a metre round the drum — the first thing seen on a GPU (the maintainer's first look: "fire looks a bit jank tbh"). `lift` was 0.2 then: 0.25
   *  puts the lamp nearer the flame's middle and the shadow's foot nearer the drum (0.3 took more than a tenth off the light meter a stride from the drum) */
  size: FIRE_SIZE,
  /** THE WOOD CRACKS: on average this often (a second), each of the clock's `popSlot`-second slots asked once */
  popRate: 1.1, popSlot: 0.2,
  /** THE EMBERS are GPU particles (render/particles.ts: sparks filed as embers, EmitOpts.ember — they ride the hot air up, go with the wind, land on things and
   *  feed the bloom; the maintainer: "embers can be GPU particles though"): about `embers` in the air at once off a fire within `emberR` m of what the view looks
   *  at, each alight `emberLife` s and leaving the flame at `emberSpeed` m/s; `emberSize` its streak's thickness (m), `emberGain` its light as a share of a
   *  spark's; a crack throws `emberCrack` more, harder. `embers` 0 = none (`?fireembers=0`) */
  embers: FIRE_EMBERS, emberLife: 1.7, emberSpeed: 1.1, emberSize: 0.004, emberGain: 0.45, emberCrack: 10, emberR: 30,
  /** THE LOOK OF THE FLAME (render/shaders/fire.wgsl FireLook; the picture only; live in the page's fire lab, `/firelab`): × its light, × its white heart (the
   *  bloom spreads it), how soon it hides what is behind it (1/m), × how fast its shapes climb, × its height, how torn it is (0‥2), the smoke drawn off its
   *  tips (0‥2; `?fireplume=0` = none), the shimmer of the hot air over it (m the picture behind is pushed aside; `?fireheat=0` = none), how dark its cool
   *  edge is (0‥1) and how hard it breathes (0‥2). Set on the software adapter's stills against the maintainer's reference (a fluid-simulated camp fire: a white
   *  heart, orange body, dark red tips, smoke off them), after his second look on a GPU: "still very ugly. needs more dynamic range, smoke, embers, movement,
   *  could we do heat distortion?" NEVER SEEN ON A GPU. */
  // THESE NUMBERS ARE NOW THE MAINTAINER'S OWN (and the JSDoc above is how they came to be first), set by eye on his GPU with the fire lab's sliders (/firelab,
  // its "copy them" line, 2026-10-24) and taken as he sent them: the look's first ten here, and in this table `height`, `coals`, `depth`, `kick`, the embers'
  // and the smoke's density, temp and speed. He set them on the build BEFORE the newer rules (the flame marked for the temporal resolve, the lifted and tinted
  // lamp, the lean, the lamp's wider shift, twice the cracks), so with those on the picture is not the one he tuned: the nearest to that is
  // `?firereact=0&firelean=0&firebright=0&firesway=0`. `wander` is not his 0.07: his note asking for shadows that move came with it (FIRE_WANDER).
  look: { gain: 3, core: 4, sigma: 2.5, speed: 0.7, tall: 0.95, torn: 1.1, plume: FIRE_PLUME, shimmer: FIRE_SHIMMER, soot: 0.5, breathe: 1,
    /** THE PICTURE'S MEMORY LETS A FLAME GO (0‥1; `?firereact=0`): the temporal resolve (taau.wgsl) keeps about ten frames of every pixel, forty where the picture
     *  is all contrast, and a flame is a new shape every frame: on a GPU it was the average of forty flames, soft, dim, see-through and nearly still ("pale blob",
     *  "feels very static", "way too dark" — three looks, one cause, and the software adapter's stills, a frame at a time with no history, never showed it). The
     *  composite marks a fire's pixels and the resolve takes them from this frame by this much. `lean` = how far the wind leans the flame: metres at one flame
     *  height for each m/s (it was 0.07: "would also expect the fire to be affected by the wind, looks like only the smoke is"; `?firelean=0` = 0.07) */
    react: FIRE_REACT, lean: FIRE_LEAN,
    /** HOW MANY SAMPLES OF THE FLAME A PIXEL'S RAY TAKES (4‥64; `?firesteps=N`, the lab's row): the flame's price is this × the pixels it covers, and a flame
     *  this thin (sigma 2.5) never goes opaque, so no ray stops early. 40 is the count the maintainer's own numbers were tuned at; fewer is cheaper and bands
     *  sooner. A lever for a timing on a real GPU: nobody has timed the flame, and the count's price is a model. */
    steps: FIRE_STEPS },
  /** THE SMOKE (the solver's units: 6 /m of extinction a unit of density, +1.6 m/s² a unit of heat): how high over the coals the source's middle is as a share of the
   *  flame's height (its foot, a radius lower, stays over a standing man's head on a drum: tools/qa/fire-check.ts holds it), the source's radius (m) and its least width in cells, what it lets out a second, how hot, how fast it leaves, and how hard the air is dragged along;
   *  filed afresh every `every` s for that long; only for a fire within `viewR` m of what the view looks at; `on` false = a fire with no smoke (`?firesmoke=0`) */
  smoke: { on: true, up: 1.9, radius: 0.26, cells: 4, density: 1, temp: 21, speed: 0.9, push: 6, jitter: 0.5, every: 1, viewR: 18, lean: 0.12 },
  /** THE FLAME AS GAS (the maintainer's pick, 10-23: "Drive it from our 3D smoke solver"; "i'm curious how far we can push our existing smoke solver … if we can
   *  make the finer cells work well with our existing brick stuff"): a second LOOK source, on the solver's FINE lattice (2.2 cm cells, the breath's), filed at
   *  the coals of a fire within `viewR` m of what the view looks at while the solver draws — HEAT, with next to no smoke in it (`density`: thin enough that a
   *  sight line through it keeps its light), which the solver lifts by its own buoyancy, curls and leans in the wind. The solver lets thin gas on that lattice
   *  go at once; while such a fire burns it is told to keep gas hotter than `keep` (smoke/types.ts keepHot → sparse.fineKeep; put back to 0 when no fire asks),
   *  so the heat lasts as long as its own cooling takes — that is the flame's height. The picture draws the flame FROM THAT HEAT (the solver publishes a fine
   *  brick's heat; fire.wgsl fireFlameG): white-hot where it is as hot as `ref`, cooling as it climbs, no flame under `lo` of that; the noise only tears its
   *  skin. Its middle `up` of the flame's height over the coals, `radius` m wide and `cells` at least, `density` and `temp` a second, leaving at `speed` m/s;
   *  filed afresh every `every` s; a fire eases to it and back over 1 / `ease` s. While it is gas the DRAWN smoke is off (the fire's smoke is the solver's).
   *  `on` false = the flame of noise: the page's default until the gas has been seen (`?firegas=1`; a row in the fire lab). While it is on, gun gas and
   *  breath hotter than `keep` linger as long as the flame does. SET on five stills of the real page on the software adapter (the pass, its storm blowing 0.5 m/s
   *  at the drum): a white heart, orange body and red tip with no haze, one streamer about a metre and a half long that the wind leans some 45° and curls;
   *  `temp` 12 at `speed` 1.2 was thinner and lay lower. One streamer, not the noise's field of tongues: the solver's cells are two centimetres and its
   *  source is one soft ball. NEVER SEEN ON A GPU, never seen moving. */
  gas: { on: false, up: 0.1, radius: 0.2, cells: 6, density: 0.3, temp: 22, speed: 1.8, push: 8, jitter: 0.6, every: 0.5, viewR: 12, keep: 0.8, ref: 3.2, lo: 0.2, ease: 1.5 },
  /** THE SOUND: the bed's level at the fire and each crack's (× how hard the crack is), and how long one bed voice is held before the next takes over (the
   *  mixer lets a followed voice go after its own time, and one it never took — the mixer off, a page in the background — is asked for again then) */
  bed: 0.85, crack: 0.9, bedSecs: 12,
  /** UNDER THE FOG OF WAR a fire is drawn as the team last saw it (the picture only; the page's ?firefog=0 puts it off): a fire is part of the place, and the
   *  fog's picture already had its lamp lighting the yard round a drum with a bare lid and no flame (the maintainer, playing the pass in plan mode: "weird that
   *  fire doesn't show up in fog of war"). It goes by the fog's memory of the fire's own lamp (fogofwar.ts, RtLight.fog / fogGhost): burning and known to burn =
   *  drawn wherever it stands; lit again where nobody saw = only where the team sees; out where nobody saw = still burning where the team does not see.
   *  false = never over ground the fog hides, as it was. Its SMOKE is not this row's: smoke over floor nobody sees is the fog's own rule (fogofwar.ts FOG.air: drawn there; `?fogair=0` = hidden, a grenade's too). Its EMBERS are particles and are cut over unseen floor like any the team did not make (FOG.ours) */
  fog: true,
  /** the renderer takes this many fires (four at most: its uniform's size), nearest the view first, none past `drawR` m of what it looks at; the wind a flame and
   *  its embers are shown is capped at `windMax` m/s (a storm lays the smoke over, not the flame flat) */
  max: 4, drawR: 70, windMax: 3,
};

/** what the renderer is handed for one fire: render/passes.ts FireRecord (setFires → shaders/fire.wgsl FireRec) */
export type FireDraw = FireRecord;
export interface FireStats { fires: number; lit: number; frames: number; cracks: number; /** the light's swing this run: least and most of the authored strength, and their sum and count */ lo: number; hi: number; sum: number; n: number }
/** WHAT OF A FIRE IS THE HOST'S AND NOT THE GAME'S: whether its smoke is filed hangs on a solver drawing, on the graphics preset on (settings.fireSmoke) and on
 *  where the view looks, and its bed is a voice the mixer holds — none of which a recording or a snapshot carries. So the book of what was filed and asked for
 *  is kept on the HOST, beside the list the renderer is handed (`engine.hostBooks.fire`, host/api.ts HostBooks; `Game.engine` is in no snapshot): two games that differ only in
 *  their picture are the same game. WHO ABANDONS THE MOMENT SAYS SO: the book is dropped where the solver is emptied and
 *  the encounter ends — a restart, and with it a file's or a checkpoint's load (game.ts restartEncounter), and a save in memory put back (host/putback.ts, which drops every host book as one) —
 *  and a fresh one is begun on the next frame that moves the clock: the smoke is filed and the bed asked for on that frame, and the abandoned moment's voice
 *  lets go. (Also when the clock has gone BACK on the book, `time`: a rollback on a host that says nothing, the harness.) A frame that moves no clock (`dt` 0:
 *  the kit page's still, a card's frozen still, a load's own paint) neither reads nor writes it.
 *  `bed`, `smoke` = by a fire's place among the level's, the frame (`n`, counted in this book) it last burned with its bed asked for, and last had its smoke
 *  filed: the frame before = it goes on, anything else = it starts now — so a fire that comes within the view's reach, or whose preset starts to draw it,
 *  smokes at once and not at the next second's mark, and one lit again asks for its bed at once; `smokes`, `beds` = how many this run. No rule reads any of
 *  it back. NOT KNOWN TO IT: whether the mixer still holds the bed — a page frozen past the mixer's own hold (audio.ts FOLLOW_SECS) resumes with no bed until
 *  the next `bedSecs` mark. */
export interface FireShown { n: number; time: number; /** fires (by their own count, as `bed` and `gas` are) a round or a blast went into since the last frame: each throws embers once (FIRE.hardy), and when each fire was last stirred (by the same count) */ stir?: number[]; stirAt?: number[]; bed: number[]; smoke: number[]; smokes: number; beds: number; /** embers: what each fire still owes (a share of one), and how many were filed this run */ ember: number[]; embers: number; /** the gas: the frame each fire's source was last kept up, how far each has eased to its gas (0‥1), sources filed this run */ gas: number[]; gasMix: number[]; gases: number; /** what the solver was last told to keep (FIRE.gas.keep while a fire's flame is gas, else 0) */ kept?: number }
const states = new SideMap<Game, FireStats>('fire.states');
const fresh = (): FireStats => ({ fires: 0, lit: 0, frames: 0, cracks: 0, lo: Infinity, hi: -Infinity, sum: 0, n: 0 });
function stateOf(g: Game) { let s = states.get(g); if (!s) { s = fresh(); states.set(g, s); } return s; }
/** the counts a probe or the panel reads, to read now and not to keep: a game the fire has not run in yet gets a blank row of its own, and none is made for it
 *  (a reader must not add a row to the game's state) */
export function fireStats(g: Game): FireStats { return states.get(g) ?? fresh(); }
/** the host's side of it, for the panel's line and the tools; undefined before the first frame a fire burns in, and from a restart or a load until the clock next moves */
export function fireShown(g: Game): Readonly<FireShown> | undefined { return g.engine.hostBooks?.fire; }

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
  // smooth noise at each rate, not a sine: four sines come round again and read as breathing. Weighed by the root of the weights' squares, so the swing the table names is kept
  const si = Math.floor(seed * 65535);
  for (let i = 0; i < K.rates.length; i++) { const x = K.rates[i] * time + h01(si + i * 71), k = Math.floor(x), u = x - k, e = u * u * (3 - 2 * u), c = si + i * 7919;
    s += K.weights[i] * (2 * (h01(c + k * 131) * (1 - e) + h01(c + (k + 1) * 131) * e) - 1); w += K.weights[i] * K.weights[i]; }
  let f = 1 + K.depth * s / Math.max(Math.sqrt(w), 1e-6);
  for (const p of firePops(seed, time, K.kickSecs * 4)) f += K.kick * p.hard * Math.exp(-(time - p.at) / K.kickSecs);
  return Math.max(K.least, Math.min(K.most, f));
}

/** where the fire's mouth is and how wide: the glowing box the level hung on the lamp, or failing one a hand under the lamp */
function mouthOf(g: Game, t: LightTarget): { pos: Vec3; r: number; lid: number } {
  const b = t.boxes.length ? g.engine.world.statics[t.boxes[0]] : null;
  if (b) return { pos: [b.c[0], b.c[1] + b.h[1], b.c[2]], r: Math.min(b.h[0], b.h[2]) * FIRE.mouth, lid: Math.min(b.h[0], b.h[2]) };
  return { pos: [t.pos[0], t.pos[1] - 0.16, t.pos[2]], r: 0.19 * FIRE.mouth, lid: 0 };   // (no lid: no bed of coals either, only the flame)
}

/** how hot a fire burns (0‥1: its lamp's share of its authored strength) and whether it burns at all */
const heatOf = (t: LightTarget) => Math.max(0, Math.min(1, t.factor));
const burns = (t: LightTarget) => heatOf(t) > 0.001 && t.light!.enabled;
/** the wind at a fire's flame: as it blows, how hard, and what leans the flame (capped) */
function windAt(g: Game, mouth: Vec3): { wv: Vec3; wl: number; wind: [number, number] } {
  const wv = g.wind.at([mouth[0], mouth[1] + FIRE.height * 0.6, mouth[2]]), wl = Math.hypot(wv[0], wv[2]), wk = wl > FIRE.windMax ? FIRE.windMax / wl : 1;
  return { wv, wl, wind: [wv[0] * wk, wv[2] * wk] };
}
/** the look's numbers as the renderer takes them (fire.wgsl FireLook's sixteen, in its order) */
function lookRow(): number[] { const L = FIRE.look; return [L.gain, L.core, L.sigma, L.speed, L.tall, L.torn, L.plume, L.shimmer, L.soot, L.breathe, FIRE.gas.ref, FIRE.gas.lo, L.react, L.lean, L.steps, 0]; }
/** whether a round or a blast leaves `t` burning: a fire, with the rule on (FIRE.hardy). To combat.ts's and destruction.ts's fixture rules such a fire is no
 *  fixture at all (a lamp behind one can still be shot, nothing is counted against the encounter's fixtures); its own box blown away still takes it (breakFixtureBox). */
export function fireHolds(t: LightTarget): boolean { return FIRE.on && FIRE.hardy && isFire(t); }
/** … and what the hit does to it instead: a crack now, and a throw of embers on the fire's next frame — the mixer and the host's book: nothing kept, nothing the
 *  game reads; one a fire in `stirGap` s, however many rounds of a burst go into it */
/** did a round that stopped at `p`, in static `ix`, stop in this fire? Its own box — or the drum under its mouth: the fire's own box is the glowing lid, a
 *  finger thick, and the drum it burns in is boxes of the level's that name no fire, so a round into the drum says nothing by its index. */
export function fireStruck(g: Game, t: LightTarget, p: Vec3, ix: number): boolean {
  if (t.boxes.includes(ix)) return true;
  const M = mouthOf(g, t), b = g.engine.world.statics[ix], r = Math.max(M.lid * 1.7, 0.3);   // (a drum's wall stands a little outside its lid)
  if (!b || Math.hypot(b.c[0] - M.pos[0], b.c[2] - M.pos[2]) > 0.05 || b.c[1] > M.pos[1]) return false;   // (a box that stands on the fire's own axis, under its mouth: not the wall behind it, not the ground)
  return p[1] <= M.pos[1] + 0.05 && Math.hypot(p[0] - M.pos[0], p[2] - M.pos[2]) <= r;
}
export function fireStir(g: Game, t: LightTarget) {
  const P = g.engine.hostBooks?.fire; if (!P || !burns(t)) return;
  let ix = 0; for (const x of g.targets) { if (x === t) break; if (isFire(x)) ix++; }
  const at = (P.stirAt ??= []); if (g.time - (at[ix] ?? -1e9) < FIRE.stirGap) return;   // (each fire by its own clock: a grenade between two stirs both)
  at[ix] = g.time; (P.stir ??= []).push(ix);
  g.audio.play('fireCrack', mouthOf(g, t).pos, FIRE.crack * heatOf(t), { rate: 0.7 });
}
/** OUT, BUT STILL LIT IN THE FOG'S PICTURE (the team has not seen it go out: RtLight.fogGhost, fogofwar.ts): the remembered pool stays a fire's — its steady
 *  strength, its tint, its reach, its place in the flame and its size — and not the level's dimmer, paler, shorter lamp at the lid. The picture only: the lamp is
 *  out, nobody reads it. Only under the fog's full picture with FIRE.fog on (that is what says a ghost); with either off the fog remembers the level's lamp. */
function held(g: Game, t: LightTarget) {
  const l = t.light!, K = FIRE;
  if (!l.steady) l.steady = { intensity: 0, pos: [t.pos[0], t.pos[1], t.pos[2]], radius: l.radius, color: [l.color[0], l.color[1], l.color[2]], range: l.range };
  const s = l.steady, c0 = s.color ?? l.color, w = K.warm;
  s.intensity = Math.max(1e-4, t.baseIntensity * K.bright); l.radius = Math.max(s.radius, K.size * mouthOf(g, t).r); l.pos[0] = t.pos[0]; l.pos[1] = t.pos[1] + K.lift; l.pos[2] = t.pos[2];   // (in the body of the flame and as big as it, as it burned; no flicker, no wander)
  l.color[0] = c0[0] * (w[0] ?? 1); l.color[1] = c0[1] * (w[1] ?? 1); l.color[2] = c0[2] * (w[2] ?? 1); l.range = (s.range ?? l.range) * K.reach;
}
/** the lamp back as the level hung it: where, and nothing said to the steady readers (its strength is updateTargets' own again the frame it paints) */
function plain(t: LightTarget) { const l = t.light!; l.pos[0] = t.pos[0]; l.pos[1] = t.pos[1]; l.pos[2] = t.pos[2]; if (l.steady !== undefined) { l.radius = l.steady.radius; if (l.steady.range !== undefined) l.range = l.steady.range; const c0 = l.steady.color; if (c0) { l.color[0] = c0[0]; l.color[1] = c0[1]; l.color[2] = c0[2]; } l.steady = undefined; } }

/** Once a frame, straight behind every paint of the lamps (game.ts behind updateTargets; with `dt` 0 behind a checkpoint's load and a clean restart, which paint
 *  them too: the lamp, its place and the coals as this clock has them, and nothing filed) and with the wind this frame's. */
export function updateFire(g: Game, dt: number) {
  const E = g.engine;
  if (!FIRE.on) {
    if (states.get(g)) { for (const t of g.targets) if (isFire(t)) plain(t); states.delete(g); if (E.fires?.length) E.fires = []; if (E.hostBooks?.fire?.kept) g.smoke.keepHot?.(0); if (E.hostBooks) E.hostBooks.fire = undefined; }   // (put off in a running page: the lamp back where the level hung it, its strength is updateTargets' again)
    return;
  }
  let any = false; for (const t of g.targets) if (isFire(t)) { any = true; break; }
  if (!any) { if (E.fires?.length) E.fires = []; const P0 = E.hostBooks?.fire; if (P0?.kept) { P0.kept = 0; g.smoke.keepHot?.(0); } return; }   // (nothing of this file runs on a floor with no fire)
  const T = stateOf(g), K = FIRE, time = g.time, was = time - Math.max(dt, 0);
  const moved = dt > 0; let P: FireShown | null = null;   // (the host's book, on a frame that moves the clock only)
  if (moved) { P = E.hostBooks?.fire ?? null; if (!P || was < P.time - 1e-9) P = (E.hostBooks ??= {}).fire = { n: 0, time: 0, bed: [], smoke: [], smokes: 0, beds: 0, ember: [], embers: 0, gas: [], gasMix: [], gases: 0 }; P.n++; P.time = time; }
  const focus = E.viewFocus ?? g.player.char.pos, drawing = g.smoke.drawing?.() === true && g.engine.settings?.fireSmoke !== false;   // (… and the graphics preset on draws a fire's smoke: the floor rung does not, ui/quality.ts FIRE SMOKE SHED)
  let fires = 0, lit = 0;
  if (moved) T.frames++;
  for (const t of g.targets) {
    if (!isFire(t)) continue;
    const ix = fires++;
    const l = t.light!, heat = heatOf(t);
    if (!burns(t)) {   // (out: while the fog's picture has it lit it is held as a fire's lamp, and for the one frame before the fog has had its say)
      const ghost = (l.fogGhost ?? 0) > 0, first = !!l.steady && !l.steady.out;
      if (K.fog && (ghost || first)) { held(g, t); l.steady!.out = true; } else plain(t);
      continue; }
    lit++;
    const seed = fireSeed(t), fl = fireFlicker(seed, time), M = mouthOf(g, t), si = Math.floor(seed * 65535);
    // the light: the authored lamp × the flicker, its place wandering with the flames; what a reader of the place's STEADY light takes it for is the authored lamp
    if (!l.steady) l.steady = { intensity: 0, pos: [t.pos[0], t.pos[1], t.pos[2]], radius: l.radius, color: [l.color[0], l.color[1], l.color[2]], range: l.range };
    l.steady.out = false; l.radius = Math.max(l.steady.radius, K.size * M.r);   // (as big as what burns, and never smaller than the level made it)
    l.steady.intensity = t.baseIntensity * t.factor * K.bright;
    { const c0 = l.steady.color ?? l.color, w = K.warm; l.color[0] = c0[0] * (w[0] ?? 1); l.color[1] = c0[1] * (w[1] ?? 1); l.color[2] = c0[2] * (w[2] ?? 1); }
    l.range = (l.steady.range ?? l.range) * K.reach;
    l.intensity = l.steady.intensity * fl;
    l.pos[0] = t.pos[0] + K.wander * Math.sin(TAU * (0.83 * time + h01(si + 5))) * Math.sin(TAU * (2.9 * time + h01(si + 6)));
    l.pos[2] = t.pos[2] + K.wander * Math.sin(TAU * (0.71 * time + h01(si + 7))) * Math.sin(TAU * (3.3 * time + h01(si + 8)));
    l.pos[1] = t.pos[1] + K.lift + K.wanderUp * Math.max(-1, Math.min(1, (fl - 1) / Math.max(K.depth, 1e-6)));   // (up with the flicker, by no more than the table says: a crack's kick is past the swing and would snap the lamp half as far again in a frame)
    { const ck = t.factor * K.coals * (1 + K.coalSwing * (fl - 1)); for (const bi of t.boxes) { const bx = g.engine.world.statics[bi]; if (bx) bx.emissive = [t.baseEmissive[0] * ck, t.baseEmissive[1] * ck, t.baseEmissive[2] * ck]; } }   // (updateTargets painted it at its authored glow a moment ago, and does again the frame the switch goes off)
    if (moved) { T.lo = Math.min(T.lo, fl); T.hi = Math.max(T.hi, fl); T.sum += fl; T.n++; }
    const { wv, wl } = windAt(g, M.pos), d = Math.hypot(M.pos[0] - focus[0], M.pos[2] - focus[2]);
    // the embers: GPU particles, for a fire near the view — a steady few off the flame, and a throw with each crack. The host's: filed by its own book and its own
    // seeds (never the particles' serial, which the game's own effects count off), so a game with the picture and one without are the same game
    const PX = P && K.embers > 0 && d < K.emberR ? gpuFx(g) : null, flameH = K.height * K.look.tall;
    const ember = (n: number, hard: number, k: number) => PX!.emit('spark', [M.pos[0], M.pos[1] + flameH * (0.25 + 0.3 * hard), M.pos[2]], [wv[0] * 0.15, 1, wv[2] * 0.15], n, { shape: 'cone', spread: 0.5 + 0.5 * hard, speed: K.emberSpeed * (1 + 1.6 * hard), speedJit: 0.6,
      life: K.emberLife * (1 - 0.45 * hard), lifeJit: 0.45, size: K.emberSize, sizeJit: 0.4, posJit: M.r * 0.7, ember: Math.min(0.99, K.emberGain * (0.5 + 0.5 * heat)), seed: (Math.imul(si + 1, 0x9E3779B1) ^ Math.imul(k + 1, 0x85EBCA77)) >>> 0 });
    if (P?.stir?.length && P.stir.includes(ix)) { if (PX && K.emberCrack > 0) { const n = Math.round(K.emberCrack * 2); ember(n, 1, P.embers); P.embers += n; } }   // (a round or a blast went into it: FIRE.hardy)
    if (PX) { const owe = (P!.ember[ix] ?? 0) + K.embers / Math.max(K.emberLife, 0.1) * heat * dt, n = Math.floor(owe); P!.ember[ix] = owe - n; if (n > 0) { ember(n, 0, P!.embers); P!.embers += n; } }
    // the cracks: the one that fell in this frame, for the ear and (a throw of embers) for the eye
    if (moved) for (const p of firePops(seed, time, 1.5)) if (p.at > was && p.at <= time) { T.cracks++; g.audio.play('fireCrack', M.pos, K.crack * (0.5 + 0.5 * p.hard) * heat, { rate: 0.8 + 0.5 * p.seed });
      if (PX && K.emberCrack > 0) { const n = Math.round(K.emberCrack * (0.4 + 0.6 * p.hard)); ember(n, p.hard, P!.embers); P!.embers += n; } }
    // the bed: one held voice, asked for when the fire starts to burn (the first frame, lit again after being out) and handed on every `bedSecs`
    if (P) { const slot = Math.floor(time / K.bedSecs), goes = P.bed[ix] === P.n - 1; P.bed[ix] = P.n;
      if (slot !== Math.floor(was / K.bedSecs) || !goes) { P.beds++; const book = P, end = (slot + 1) * K.bedSecs + 0.35, me = t, at = M.pos;
        g.audio.play('fireBed', at, K.bed, { follow: () => FIRE.on && E.hostBooks?.fire === book && g.time < end && g.time >= end - K.bedSecs - 0.4 && me.factor > 0.001 ? { pos: at, k: BED_K * Math.min(1, me.factor), t: g.time } : null }); } }
    // the smoke: a short source on the solver, filed afresh every `every` s while the fire is near the view
    if (P && drawing && K.smoke.on && d < K.smoke.viewR) { const B = K.smoke, slot = Math.floor(time / B.every), goes = P.smoke[ix] === P.n - 1; P.smoke[ix] = P.n;
      if (slot !== Math.floor(was / B.every) || !goes) { P.smokes++;
        const sk = wl > 8 ? 8 / wl : 1, dir: Vec3 = [wv[0] * sk * B.lean, 1, wv[2] * sk * B.lean];
        g.smoke.emit({ pos: [M.pos[0], M.pos[1] + K.height * B.up, M.pos[2]], dir, speed: B.speed, radius: B.radius, minVoxels: B.cells, density: B.density * heat, temperature: B.temp * heat, ttl: B.every, age: 0, kind: 'cloud',
          push: B.push, jitter: B.jitter, lattice: 'coarse', look: true }); } }
    // the flame as gas: a short source on the solver's fine lattice at the coals, filed afresh every `every` s while the fire is near the view; the picture eases to it
    if (P) { const G = K.gas, goes = drawing && G.on && d < G.viewR;
      if (goes) { const slot = Math.floor(time / G.every), kept = P.gas[ix] === P.n - 1; P.gas[ix] = P.n;
        if (slot !== Math.floor(was / G.every) || !kept) { P.gases++;
          g.smoke.emit({ pos: [M.pos[0], M.pos[1] + K.height * G.up, M.pos[2]], dir: [0, 1, 0], speed: G.speed, radius: G.radius, minVoxels: G.cells, density: G.density * heat, temperature: G.temp * heat, ttl: G.every, age: 0, kind: 'cloud',
            push: G.push, jitter: G.jitter, lattice: 'fine', look: true }); } }
      P.gasMix[ix] = Math.min(1, Math.max(0, (P.gasMix[ix] ?? 0) + (goes ? dt : -dt) * G.ease)); }
  }
  if (P?.stir?.length) P.stir.length = 0;
  if (P) { const hot = K.gas.on && P.gas.some(n => n === P!.n) ? K.gas.keep : 0; if (hot !== P.kept) { P.kept = hot; g.smoke.keepHot?.(hot); } }   // (the solver keeps hot gas on its fine lattice only while a fire's flame is that gas)
  T.fires = fires; T.lit = lit;
  fireDraws(g);
}
/** THE FIRES THE PICTURE DRAWS this frame (engine.fires; the picture only, nothing here is kept or read by the game): every burning one near the view, and under
 *  the fog of war each as the team last saw it (FIRE.fog, by the fog's memory of the fire's own lamp: RtLight.fog / fogGhost). Called by updateFire, and by the
 *  game again straight behind the fog's own turn (game.ts), which is what says this frame's classes: a fire put out where nobody sees keeps its flame in the
 *  fog from the very frame it goes out. Every number is a closed form of the clock, so the two calls of a frame agree but for the fog's word. */
export function fireDraws(g: Game) {
  const E = g.engine, K = FIRE;
  if (!K.on) return;
  const time = g.time, focus = E.viewFocus ?? g.player.char.pos, list: (FireDraw & { d: number })[] = [], P = E.hostBooks?.fire;
  let fires = 0;
  for (const t of g.targets) {
    if (!isFire(t)) continue;
    const ix = fires++;
    const l = t.light!, lit = burns(t);
    // out, and nobody on the team saw it go out: where the team does not see, the fog's picture has its lamp lit still (the lamp's own ghost) and its flame on it
    if (!lit && !(K.fog && (l.fogGhost ?? 0) > 0)) continue;
    const M = mouthOf(g, t), d = Math.hypot(M.pos[0] - focus[0], M.pos[2] - focus[2]);
    if (!(d < K.drawR)) continue;
    const seed = fireSeed(t);
    list.push({ pos: M.pos, r: M.r, h: K.height, heat: lit ? heatOf(t) : 1, seed, time: time % 4096, wind: windAt(g, M.pos).wind, flick: fireFlicker(seed, time), bed: M.lid * K.bedR, fog: !lit ? 2 : !K.fog || l.fog === 1 ? 1 : 0, gas: lit ? P?.gasMix[ix] ?? 0 : 0, d });
  }
  const cap = Math.max(0, Math.min(4, Math.floor(K.max)));
  if (list.length > cap) { list.sort((a, b) => a.d - b.d); list.length = cap; }   // (which ones, not in what order: the composite orders them ray by ray)
  if (list.length || E.fires?.length) E.fires = list;
  if (list.length) E.fireLook = lookRow();
}
/** one line for the panel / the probes */
export function fireSummary(g: Game): string {
  if (!FIRE.on) return 'fire: the switch is off';
  const T = fireStats(g), P = g.engine.hostBooks?.fire;
  return `fire ▸ ${T.lit} of ${T.fires} burning, ${g.engine.fires?.length ?? 0} drawn · light ${T.n ? `${T.lo.toFixed(2)}‥${T.hi.toFixed(2)} (mean ${(T.sum / T.n).toFixed(3)})` : '—'} · ${T.cracks} cracks, ${P?.smokes ?? 0} smoke sources, ${P?.embers ?? 0} embers, ${P?.gases ?? 0} gas sources, ${P?.beds ?? 0} bed voices`;
}
