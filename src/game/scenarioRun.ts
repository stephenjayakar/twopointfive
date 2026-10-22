// STARTING AND QUITTING A SCENARIO (scene/scenarioList.ts is the list and the query helpers; ui/menu.ts the picker): the one code path from the page's query
// string to a staged scenario — main.ts calls startFromQuery at boot whether the URL was typed or a picker row loaded it — and the one way back out of whichever
// is up to the plain night floor the start card sits over (quitScenario). The probes (tools/qa/scenario-picker-probes.ts) call the same two functions.
// Type-only game imports but difficulty.ts's one function: nothing here is built from another game module's exports at load (src/game is one import cycle).
import type { Game } from './game';
import { hourFromQuery } from './hours';   // (called inside startFromQuery only)
import { difficultyHere } from './difficulty';   // (called inside startScenario only)
import { weatherOfSearch } from './weatherKinds';   // (tables and pure functions: no game import)
import { kitSoloStand } from './kit';   // (called inside startFromQuery only)
import { quietFogOfQuery, quietCamsOfQuery, quietFogStart, quietFogEnd, soloFogLink, type QuietRung } from './quietfog';
import { stickyVisitSet } from './stickycam';   // (called inside functions only)
import { ALL_MISSIONS, TRAINING_MISSIONS, TUTORIAL_MISSIONS, specOfQuery, teamWords, type ScenarioSpec } from '../scene/scenarioList';
import type { ScenarioEntry } from '../scene/scenarios';
import type { SquadSize } from './loadout';

const WORDS: Record<ScenarioSpec['kind'], string> = { nightbreach: 'night breach', roomclear: 'room clear', rescue: 'hostage rescue', quiet: 'quiet mission' };

/** the query's level is a Training lesson's (no fog lever, no mission cameras there) */
const lessonLevel = (q: URLSearchParams): boolean => TRAINING_MISSIONS.some(e => e.level === q.get('levelFile')) || TUTORIAL_MISSIONS.some(e => e.level === q.get('levelFile'));
/** fog of war on a page with no scenario up: only if the URL asks (?fow / ?fogofwar, and no ?nofow / ?nofogofwar) */
export function plainFog(q: URLSearchParams): boolean { return !(q.has('nofow') || q.has('nofogofwar')) && (q.has('fow') || q.has('fogofwar')); }
/** the rung of the fog lever a QUIET mission's query asks to be played under (quietfog.ts: `quietfog=team|cones|own` on a quiet mission's link, put there by
 *  the mission sheet's lever; 'off' = none — every quiet mission until the lever is moved — and always on a Training lesson's level and with the rule off) */
/** the sticky cameras a link hands the player for the visit WHERE ITS FOG RUNS (a quiet mission's own, never a lesson's — quietfog.ts quietCamsOfQuery): one
 *  rule for the staging below and for the loadout screen that shows them on his card before he deploys (ui/loadout.ts lentNow) */
/** the link is one the quiet fog reads: a quiet mission's, or the solo night's own where that rule is up (quietfog.ts soloFogLink: `solo`, nothing staged) */
const quietLike = (q: URLSearchParams): boolean => { const s = specOfQuery(q); return s ? s.kind === 'quiet' : soloFogLink(q); };
export const quietCamsOfLink = (q: URLSearchParams): number => (quietLike(q) ? quietCamsOfQuery(q, lessonLevel(q)) : 0);
export function quietRungOfQuery(q: URLSearchParams): QuietRung { return quietLike(q) ? quietFogOfQuery(q, lessonLevel(q)) : 'off'; }   // (the kind as the start reads it: `quiet` beside `roomclear` is the room clear)
/** fog of war as a query string asks for it: ?nofow / ?nofogofwar off, ?fow / ?fogofwar on, else on under the room clear and the rescue — and on a quiet
 *  mission whose link carries a rung of the fog lever (quietRungOfQuery) */
/** two links stand in the same fog: on or off, the same rung, the same cameras handed (the screens' no-load start asks it of the page and the link) */
export function sameFog(a: string | URLSearchParams, b: string | URLSearchParams): boolean {
  const sig = (s: string | URLSearchParams) => { const q = typeof s === 'string' ? new URLSearchParams(s.replace(/^[^?]*\?/, '')) : s; return `${fogOfQuery(q)}|${quietRungOfQuery(q)}|${quietCamsOfLink(q)}`; };
  return sig(a) === sig(b);
}
export function fogOfQuery(q: URLSearchParams): boolean {
  if (q.has('nofow') || q.has('nofogofwar')) return false;
  const four = q.has('squad4') && !q.has('nightbreach') && !q.has('rescue') && !q.has('quiet');
  return q.has('fow') || q.has('fogofwar') || q.has('roomclear') || q.has('rescue') || four || quietRungOfQuery(q) !== 'off';
}

/** Stage `spec` on this game: the squad's size written to the knob the staging reads, then the scenario's own start(). Returns its refusal, or null. */
export function startScenario(g: Game, spec: ScenarioSpec): string | null {
  if (spec.kind !== 'roomclear') difficultyHere('');   // (difficulty.ts HARD_AT: a level's own hard rows are its room clear's — roomclear.ts start() names the structure)
  if (spec.kind === 'quiet') { /* the quiet mission stages its own one partner (quiet.ts): neither knob is its */ }
  else if (spec.kind !== 'rescue') g.nightBreach.knobs.squad = spec.squad; else g.rescue.knobs.squad = spec.squad;   // (the rescue stages its own team off its own knob)
  const why = spec.kind === 'quiet' ? g.quiet.start(spec.seed ?? null, spec.squad ? 1 : 0) : spec.kind === 'roomclear' ? g.roomClear.start(spec.seed) : spec.kind === 'nightbreach' ? g.nightBreach.start() : g.rescue.start();
  if (why) { console.error(`?${spec.kind} refused: ${why}`); g.msg(`${WORDS[spec.kind]} refused — ${why}`); }
  return why;
}

/** The page's boot: fog of war as the query asks, then the scenario it names, staged and waiting (none named: nothing started — the start card's floor).
 *  `?squad4` alone is the room clear with the four, beside `?nightbreach` that scenario with four, beside `?rescue` ignored with a warning. A REFUSED start
 *  (the sandbox's 'no AI' ticked, say) leaves the plain floor: fog of war as a URL without the scenario would have it, the reason returned for the card. */
export function startFromQuery(g: Game, search: string | URLSearchParams): { spec: ScenarioSpec | null; why: string | null } {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  if (q.has('squad4') && q.has('rescue') && !q.has('roomclear') && !q.has('nightbreach')) console.warn('?squad4 beside ?rescue: the hostage rescue never read that flag and stages its own pair — its size is ?squad=N (0 to 4)');
  hourFromQuery(g, q);   // (?hour= on the query a tool hands over: the same hour the page's own boot lays on — nothing without the key)
  g.fogOfWar.on = fogOfQuery(q);
  quietFogStart(q, g.fogOfWar.on ? quietRungOfQuery(q) : 'off');   // (a quiet mission's rung of the fog lever on the fog's two rows for the visit; none: whatever an earlier start here held is let go of)
  // ?weather=<kind> on this path too (a headless tool hands its query here; on the page main.ts already stood the game up in it — the same kind, a no-op). No key: left as it is.
  { const wx = weatherOfSearch(q); if (wx && g.weather && g.weather.kind !== wx) g.weather.setKind(wx); }
  const spec = specOfQuery(q);
  stickyVisitSet(g, g.fogOfWar.on ? quietCamsOfLink(q) : 0);   // (the cameras a quiet mission's link hands out — stickycam.ts: read where the card is put on the player, at this staging and every restart; none where the link's own ?nofow put the fog off — nothing for a camera to show)
  const why = spec ? startScenario(g, spec) : null;
  if (why) { g.fogOfWar.on = plainFog(q); quietFogEnd(); stickyVisitSet(g, 0); g.nightBreach.knobs.squad = 2; g.rescue.knobs.squad = 2; }
  kitSoloStand(g, !spec);   // (the harness's shipped stand only — kit.ts: the page asks the same of its own URL in main.ts, after this call)
  return { spec, why };
}
/** a refusal in the card's words: 'Room clear did not start: the AI is switched off' */
export function refusalWords(spec: ScenarioSpec, why: string): string { const w = WORDS[spec.kind]; return `${w[0].toUpperCase() + w.slice(1)} did not start: ${why}`; }

/** which scenario is up on this game right now (the room clear IS the night breach on its own layout: asked first) */
export function activeScenario(g: Game): ScenarioSpec['kind'] | null {
  return g.roomClear?.active ? 'roomclear' : g.nightBreach?.active ? 'nightbreach' : g.rescue?.active ? 'rescue' : g.quiet?.active ? 'quiet' : null;
}
/** the teammates the scenario that is up has staged (dead or alive: the men it put on the floor) */
export function teamOf(g: Game) { return g.rescue?.active ? g.rescue.ops : g.nightBreach?.active ? g.nightBreach.ops : g.quiet?.active ? g.quiet.ops : []; }

/** The scenario that is up, in the picker's words: its row of the list when it has one (same kind and team size on this page's level file — `levelFile`: the
 *  URL's, null on the bundled office; deployed at another size than any row's own — the loadout, game/loadout.ts — the first row of that kind on that level
 *  names it), else the kind's plain name (a hand-typed combination, a start from the Tab panel). Null: none is up. */
export function runningScenario(g: Game, levelFile: string | null = null, list: ScenarioEntry[] = ALL_MISSIONS): { kind: ScenarioSpec['kind']; squad: SquadSize; entry: ScenarioEntry | null; title: string; team: string; saves?: boolean } | null {
  const kind = activeScenario(g); if (!kind) return null;
  const squad = (kind === 'quiet' ? g.quiet.squad : Math.min(4, teamOf(g).length)) as SquadSize;
  const here = list.filter(e => e.kind === kind && (e.level ?? null) === levelFile), entry = here.find(e => e.squad === squad) ?? here[0] ?? null;
  if (kind === 'quiet') return { kind, squad, entry, title: entry?.title ?? 'Quiet mission', team: teamWords({ squad }), saves: !squad };   // (alone it is the plain night's checkpoints — savestate.ts: the card offers them)
  return { kind, squad, entry, title: entry?.title ?? WORDS[kind][0].toUpperCase() + WORDS[kind].slice(1), team: teamWords({ squad }) };
}

/** Quit whichever scenario is up, back to the floor the start card sits over: its cast gone, the shift back, a fresh night encounter, the squad knob at the
 *  pair and fog of war as a URL with no scenario on it would have it (`fog`). Returns what was stopped (null: nothing was up). */
export function quitScenario(g: Game, fog = false): ScenarioSpec['kind'] | null {
  const was = activeScenario(g);
  if (was) stickyVisitSet(g, 0);   // (before the stop: a quiet mission's stop restarts the encounter, and the card put on that fresh player must not read the mission's cameras)
  if (was === 'roomclear') g.roomClear.stop(); else if (was === 'nightbreach') g.nightBreach.stop(); else if (was === 'rescue') g.rescue.stop(); else if (was === 'quiet') g.quiet.stop();
  if (was) { g.nightBreach.knobs.squad = 2; g.rescue.knobs.squad = 2; g.fogOfWar.on = fog; quietFogEnd(); stickyVisitSet(g, 0); }
  return was;
}
