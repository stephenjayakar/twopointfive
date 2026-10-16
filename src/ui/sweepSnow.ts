// The F8 sweep's row 'one snow in one air off' (ui/perfsweep.ts): the game's half of it, kept out of perfsweep.ts so that file imports nothing of the game at run time
// (tools/qa/perf-sweep-logic.ts stands it on a fake page). main.ts hands `oneAirFlip` to the sweep. The wisps' row (`wispMotesFlip`) is at the foot.
//
// WHAT IT PRICES: the snow as the page opens it — one snow in one air (game/weatherKinds.ts SNOW_LOOK.oneAir: the flakes and the wisps ride the simulated air, no
// grains of their own) — against the snow of before it: flakes on the plain storm wind, wisps in gust patches, the blown grains a layer of their own. The switch is
// read every frame, so it is written live and put back. The wind sim steps on both sides (the grains read the air too): what the solver itself costs is the
// 'wind sim off' row's to say.
//
// READ LOOSELY: a build from before one air has neither the key nor snowFx's oneAirOn, and the row is skipped there by name.
import type { Game } from '../game/game';
import * as snowFx from '../game/snowFx';
import { SNOW_LOOK } from '../game/weatherKinds';
import type { SweepFlip } from './perfsweep';

/** the flip and its undo, or the reason it does not apply on this page right now */
export function oneAirFlip(g: Game): SweepFlip | string {
  const L = SNOW_LOOK as unknown as Record<string, unknown>, on = (snowFx as unknown as { oneAirOn?: (g: Game) => boolean }).oneAirOn;
  if (typeof L.oneAir !== 'boolean' || !on) return "this build's snow is not one snow in one air";
  if (!snowFx.snowing(g)) return 'no snow falls here (it wants a snow level)';
  if (!L.oneAir) return 'the snow is already the one of before here (?snowair=0)';
  if (!on(g)) return 'the snow has no simulated air to ride here (the wind sim is off, or the page built none)';
  if (!L.grains) return 'the blown grains are switched off here: without them this is the wind sim row again';
  return { from: { oneAir: true }, to: { oneAir: false }, apply: () => { L.oneAir = false; return () => { L.oneAir = true; }; } };
}

/** the streak's own length: SNOWWISPS.stretch as it stood when a wisp was a combed streak (a puff of motes only leans, at 0.12) */
const STREAK_STRETCH = 0.3;
/** THE ROW 'blown snow wisps: the combed streak of before'. WHAT IT PRICES: a wisp drawn as a puff of motes (SNOWWISPS.motes; particles_draw.wgsl wispMotes: three
 *  sheets of cells a pixel) against the streak it was (three noises a pixel on a longer quad). The update is the same on both sides; all of the difference is
 *  fragment work in the particle draw. A wisp is drawn with the look and the stretch it was FILED with (wispLookByte, the colour word), so the sweep waits out a
 *  wisp's longest life on each side (and a second and a half to spare), off the table as it stands. A blast's puffs are filed with the same look byte and their
 *  own short stretch: under the flip they are streaks too, shorter than a wisp's ever were. What is in the air is asked ONCE, as the take begins. */
export function wispMotesFlip(g: Game): SweepFlip | string {
  const W = snowFx.SNOWWISPS;
  if (!snowFx.snowing(g)) return 'no snow falls here (it wants a snow level)';
  if (!snowFx.wispsOn(g)) return 'the wisps are switched off here (?snowwisps=0)';
  if (snowFx.wispLookByte() < 16) return 'the wisps are already the combed streak here (SNOWWISPS.motes at 0)';
  const st = snowFx.wispStats(g); if (!st.active) return `no wisp blows here right now: ${st.why}`;
  return { from: { motes: W.motes, stretch: W.stretch }, to: { motes: 0, stretch: STREAK_STRETCH }, settleMs: Math.ceil(W.life * (1 + W.lifeJit) * 1000) + 1500,
    apply: () => { const was = { motes: W.motes, stretch: W.stretch }; W.motes = 0; W.stretch = STREAK_STRETCH; return () => { W.motes = was.motes; W.stretch = was.stretch; }; } };
}
