// THE BENCHMARK'S SCENES — the floors a benchmark run plays, each a mission of the list (scene/scenarioList.ts) on its own level, taken by the hands-off player
// (host/handsoff.ts) on a seed that names the deal and the dice. Plain data: the page (ui/bench.ts) plays them in this order, one page load each, and
// tools/qa/bench-seeds.ts plays them headless over a set of seeds and names the seed kept here (its header has the rule; `--check` says when a kept seed has gone stale).
import type { HandsOffPlan } from './handsoff';

export interface BenchSceneDef {
  /** its word in the report and on the tool's command line */
  id: string;
  /** what the report calls it */
  name: string;
  /** the mission played: a room clear row of SCENARIOS */
  scn: string;
  /** played on Hard */
  hard: boolean;
  /** the seed: the deal (`roomclear=N`) and the game's die (`seed=N`) */
  seed: number;
  /** the most seconds of play it gets */
  secs: number;
  /** Sam cannot go down (the page's god mode, as the HUD then says): the scene runs for as long as the floor takes, whatever his luck in a doorway */
  god: boolean;
  /** what the hands do beyond taking each held room by its nearest door */
  plan: Omit<HandsOffPlan, 'seed' | 'cap'>;
}
/** the set's name in a report: a run under another set of scenes is not read against this one's */
export const BENCH_SET = 'floors-1';
export const BENCH_SCENES: BenchSceneDef[] = [
  { id: 'snow', name: 'the pass, night snow', scn: 'pass-four', hard: true, seed: 1, secs: 240, god: true, plan: {} },
  { id: 'dark', name: 'the block, dark', scn: 'block-four', hard: true, seed: 1, secs: 240, god: true, plan: { breaker: true } },
  { id: 'storm', name: 'the compound, storm', scn: 'compound-four', hard: true, seed: 1, secs: 240, god: true, plan: {} },
];
