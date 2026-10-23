// THE FIRE LAB — a place to stand by an open fire and move its numbers while it burns. The page opened with ?firelab (the dev server's /firelab: the pass at
// night, you beside the brazier in front of the tea room) gets its own system in the panel, open from the first frame:
//   every number of the flame's look (game/fire.ts FIRE.look → render/shaders/fire.wgsl FireLook), of its embers, its light and its smoke, as live sliders ·
//   the build's numbers back by a button · the numbers as they stand copied out as one line of text, to hand back
//   'they can't notice you' and 'nothing hurts' (both on to begin with: the lab is for the picture) · a line that says what the fires are doing right now
// Nothing here is the game's: it writes the same table the game reads, and two of the sandbox's flags. Without the word none of it is made.
import type { Game } from '../game/game';
import type { Panel } from '../ui/panel';
import type { Vec3 } from '../math/vec';
import { FIRE, isFire, fireSummary } from '../game/fire';

export const FIRELAB = { on: false, unseen: true, safe: true, stood: false };
export const FIRELAB_SYSTEM = 'Fire lab';
type Table = Record<string, unknown>;
interface Num { t: () => Table; key: string; label: string; min: number; max: number; step: number; tip: string }
const LOOK = () => FIRE.look as unknown as Table, TOP = () => FIRE as unknown as Table, SMOKE = () => FIRE.smoke as unknown as Table, GASES = () => FIRE.gas as unknown as Table;
const FLAME: Num[] = [
  { t: LOOK, key: 'gain', label: 'how bright the whole flame is', min: 0, max: 3, step: 0.05, tip: 'times all of its light: up for a hotter, paler fire, down for a dim red one' },
  { t: LOOK, key: 'core', label: 'how white-hot its heart is', min: 0, max: 4, step: 0.05, tip: 'times the light of the hottest part only: this is what the bloom spreads into a glow' },
  { t: LOOK, key: 'sigma', label: 'how solid it is', min: 2, max: 30, step: 0.5, tip: 'low = a thin veil you see the wall through, high = a solid body of flame with hard tongues' },
  { t: LOOK, key: 'speed', label: 'how fast it climbs', min: 0.2, max: 3, step: 0.05, tip: 'times the speed its shapes rise and flutter at' },
  { t: LOOK, key: 'tall', label: 'how tall it is', min: 0.5, max: 2.5, step: 0.05, tip: 'times the height of its tongues' },
  { t: LOOK, key: 'torn', label: 'how torn it is', min: 0, max: 2, step: 0.05, tip: '0 = one smooth teardrop, 2 = ragged tongues that split and lick sideways' },
  { t: LOOK, key: 'breathe', label: 'how hard it puffs', min: 0, max: 2, step: 0.05, tip: 'the rings that swell and climb up the flame, about twice a second' },
  { t: LOOK, key: 'soot', label: 'how dark its cool edge is', min: 0, max: 1, step: 0.05, tip: 'the dark red skin and tips: 0 = the flame fades out clean, 1 = a sooty edge that hides what is behind it' },
  { t: LOOK, key: 'plume', label: 'smoke off its tips', min: 0, max: 2, step: 0.05, tip: 'the smoke drawn straight over the flame, lit orange from below. 0 = none (the drifting smoke lower down is its own row)' },
  { t: LOOK, key: 'shimmer', label: 'heat shimmer, m', min: 0, max: 0.04, step: 0.001, tip: 'how far the hot air over the fire pushes the picture behind it aside. 0 = none' },
  { t: TOP, key: 'height', label: 'the flame\'s own height, m', min: 0.3, max: 1.6, step: 0.05, tip: 'the height the game gives the flame over the coals (its smoke and its light sit by this too)' },
];
const EMBERS: Num[] = [
  { t: TOP, key: 'embers', label: 'how many are in the air', min: 0, max: 120, step: 1, tip: 'about this many alight over one fire at once. 0 = none' },
  { t: TOP, key: 'emberLife', label: 'how long one glows, s', min: 0.5, max: 6, step: 0.1, tip: 'longer and they climb higher before they go out' },
  { t: TOP, key: 'emberSpeed', label: 'how fast one leaves, m/s', min: 0.2, max: 4, step: 0.1, tip: 'its speed off the coals: the hot air lifts it from there' },
  { t: TOP, key: 'emberSize', label: 'how thick its streak is, m', min: 0.002, max: 0.02, step: 0.001, tip: 'half a centimetre is a point of light; more reads as a burning flake' },
  { t: TOP, key: 'emberGain', label: 'how bright one is', min: 0.05, max: 0.99, step: 0.01, tip: 'as a share of a bullet spark\'s light' },
  { t: TOP, key: 'emberCrack', label: 'a crack throws this many more', min: 0, max: 60, step: 1, tip: 'when the wood cracks a burst leaves at once, harder' },
];
const LIGHT: Num[] = [
  { t: TOP, key: 'depth', label: 'how far the light swings', min: 0, max: 0.8, step: 0.02, tip: 'the flicker of the light the fire throws on the yard: 0 = a steady lamp' },
  { t: TOP, key: 'kick', label: 'a crack\'s flash', min: 0, max: 1, step: 0.05, tip: 'what a crack adds to the light for an instant' },
  { t: TOP, key: 'coals', label: 'how bright the coals stay', min: 0, max: 1, step: 0.02, tip: 'the glowing lid\'s share of the glow the level gave it' },
  { t: TOP, key: 'wander', label: 'how far the light wanders, m', min: 0, max: 0.3, step: 0.01, tip: 'the shadows on the ground sway by this much' },
];
const DRIFT: Num[] = [
  { t: SMOKE, key: 'density', label: 'how much smoke it lets out', min: 0, max: 8, step: 0.1, tip: 'the drifting smoke the wind carries off (the game\'s own smoke: thick enough and it hides people)' },
  { t: SMOKE, key: 'temp', label: 'how hot it leaves', min: 0, max: 80, step: 1, tip: 'hotter smoke climbs faster and higher before the wind takes it' },
  { t: SMOKE, key: 'speed', label: 'how fast it leaves, m/s', min: 0, max: 5, step: 0.1, tip: 'its speed up out of the flame' },
];
const GAS: Num[] = [
  { t: GASES, key: 'density', label: 'how much hot gas it lets out', min: 0.2, max: 6, step: 0.1, tip: 'more gas is a taller, fuller flame (and more for a sight line to lose light in)' },
  { t: GASES, key: 'temp', label: 'how hot the gas leaves', min: 0, max: 40, step: 0.5, tip: 'hotter gas climbs faster: a taller, quicker flame' },
  { t: GASES, key: 'speed', label: 'how fast it leaves the coals, m/s', min: 0, max: 4, step: 0.1, tip: 'its speed up out of the drum' },
  { t: GASES, key: 'radius', label: 'how wide the coals let it out, m', min: 0.08, max: 0.3, step: 0.01, tip: 'the drum\'s mouth is 0.24 m' },
  { t: GASES, key: 'jitter', label: 'how unsteady the source is', min: 0, max: 1.5, step: 0.05, tip: 'the gas leaves in uneven puffs: this is what makes the flame curl' },
  { t: GASES, key: 'ref', label: 'gas this dense is white-hot', min: 0.05, max: 1, step: 0.01, tip: 'lower and more of the flame is white-hot; higher and only its heart is' },
  { t: GASES, key: 'lo', label: 'no flame in gas thinner than this share', min: 0.02, max: 0.6, step: 0.01, tip: 'lower and the flame reaches higher before it turns to smoke' },
];
const ALL = [...FLAME, ...EMBERS, ...LIGHT, ...DRIFT, ...GAS];

/** is this page the lab (the word on its address) */
export const fireLabAsked = (q: URLSearchParams): boolean => q.has('firelab');

/** a long stride from the nearest fire, on whichever side is open ground with nothing standing on it, facing it */
function stand(game: Game): boolean {
  const me = game.player.char.pos; let t = null as ReturnType<typeof game.targets.find> | null, best = 1e9;
  for (const x of game.targets) { if (!isFire(x)) continue; const d = Math.hypot(x.pos[0] - me[0], x.pos[2] - me[2]); if (d < best) { best = d; t = x; } }
  if (!t) return false;
  const at = t.pos; let pos: Vec3 = [at[0] + 1.6, 0, at[2]], yaw = -Math.PI / 2;
  for (const a of [Math.PI * 0.5, Math.PI, 0, -Math.PI * 0.5, Math.PI * 0.75, Math.PI * 0.25]) {
    const p: Vec3 = [at[0] + Math.sin(a) * 1.6, 0, at[2] + Math.cos(a) * 1.6];
    if (!game.col.solidBlocked([p[0], 1, p[2]], [at[0], 1.2, at[2]]) && !game.engine.world.raycast([p[0], 2.2, p[2]], [0, -1, 0], 2.0)) { pos = p; yaw = a + Math.PI; break; }
  }
  game.teleportPlayer(pos); game.player.char.bodyYaw = yaw; game.player.char.aimYaw = yaw; game.player.holstered = true;
  return true;
}

/** ONCE, after the panel is built: the lab's system, its rows, the panel open on it */
export function fireLabBoot(game: Game, panel: Panel) {
  FIRELAB.on = true;
  const was = ALL.map(n => n.t()[n.key] as number), wasSmoke = FIRE.smoke.on, wasGas = FIRE.gas.on;
  let copied = '';
  const back = (rows: Num[]) => () => { for (const n of rows) n.t()[n.key] = was[ALL.indexOf(n)]; };
  const asText = () => JSON.stringify({ look: { ...FIRE.look }, ...Object.fromEntries([...EMBERS, ...LIGHT, FLAME[FLAME.length - 1]].map(n => [n.key, n.t()[n.key]])), smoke: Object.fromEntries(DRIFT.map(n => [n.key, n.t()[n.key]])), gas: { on: FIRE.gas.on, ...Object.fromEntries(GAS.map(n => [n.key, n.t()[n.key]])) } });
  panel.system(FIRELAB_SYSTEM, { icon: '♨', short: 'fire', title: 'stand by a fire and move its numbers while it burns' });
  const now = panel.section('Right now', { open: true });
  panel.text(now, () => fireSummary(game));
  panel.buttons(now, 'you', [{ text: 'stand me by the fire', run: () => { stand(game); }, title: 'back to a long stride from the nearest drum, hands empty' }]);
  panel.toggleBox(now, 'they can\'t notice you', () => FIRELAB.unseen, v => { FIRELAB.unseen = v; }, 'on: nobody sees or hears you, so you can look at the fire. Off: the real guards');
  panel.toggleBox(now, 'nothing hurts you', () => FIRELAB.safe, v => { FIRELAB.safe = v; }, 'god mode while the lab is open');
  const fl = panel.section('The flame', { open: true, reset: back(FLAME), resetTitle: 'the flame\'s numbers back to the build\'s' });
  for (const n of FLAME) panel.slider(fl, n.label, n.min, n.max, n.step, () => n.t()[n.key] as number, v => { n.t()[n.key] = v; }, n.tip);
  const ga = panel.section('The flame as gas in the smoke solver', { open: true, reset: () => { back(GAS)(); FIRE.gas.on = wasGas; }, resetTitle: 'the gas\'s numbers back to the build\'s' });
  panel.toggleBox(ga, 'the flame is gas the solver carries', () => FIRE.gas.on, v => { FIRE.gas.on = v; }, 'on: hot gas is let out at the coals into the smoke solver\'s fine cells and the flame is drawn from where that gas is, so it curls, leans and climbs as the solver moves it. Off: the flame of noise above. The rows above still colour it; how torn it is tears its skin');
  for (const n of GAS) panel.slider(ga, n.label, n.min, n.max, n.step, () => n.t()[n.key] as number, v => { n.t()[n.key] = v; }, n.tip);
  const em = panel.section('Embers', { open: true, reset: back(EMBERS), resetTitle: 'the embers\' numbers back to the build\'s' });
  for (const n of EMBERS) panel.slider(em, n.label, n.min, n.max, n.step, () => n.t()[n.key] as number, v => { n.t()[n.key] = v; }, n.tip);
  const li = panel.section('Its light on the yard', { open: false, reset: back(LIGHT), resetTitle: 'the light\'s numbers back to the build\'s' });
  for (const n of LIGHT) panel.slider(li, n.label, n.min, n.max, n.step, () => n.t()[n.key] as number, v => { n.t()[n.key] = v; }, n.tip);
  const sm = panel.section('The drifting smoke', { open: false, reset: () => { back(DRIFT)(); FIRE.smoke.on = wasSmoke; }, resetTitle: 'the smoke\'s numbers back to the build\'s' });
  panel.toggleBox(sm, 'the fire lets smoke out', () => FIRE.smoke.on, v => { FIRE.smoke.on = v; }, 'the smoke the wind carries off, in the game\'s own smoke');
  for (const n of DRIFT) panel.slider(sm, n.label, n.min, n.max, n.step, () => n.t()[n.key] as number, v => { n.t()[n.key] = v; }, n.tip);
  const out = panel.section('Hand the numbers back', { open: true });
  panel.buttons(out, 'numbers', [{ text: 'copy them', run: () => { copied = asText(); try { navigator.clipboard?.writeText(copied).catch(() => { /* refused: the line below shows them */ }); } catch { /* no clipboard here: the line below shows them */ } }, title: 'the numbers as they stand, as one line of text on the clipboard (and shown below)' }]);
  panel.text(out, () => copied || 'Move the sliders until it looks right, then copy the numbers and paste them where you send notes.');
  game.playerInvisible = FIRELAB.unseen; game.godMode = FIRELAB.safe;   // (you are stood by the fire on the page's first frame, once the mission has put its people down: fireLabFrame)
  panel.show(FIRELAB_SYSTEM);
}
/** ONCE A PAGE FRAME, before the game's update: the lab's two flags, and (the first frame a fire is there) you beside it */
export function fireLabFrame(game: Game) {
  if (!FIRELAB.on) return; game.playerInvisible = FIRELAB.unseen; game.godMode = FIRELAB.safe;
  if (!FIRELAB.stood) FIRELAB.stood = stand(game);
}
