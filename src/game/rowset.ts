// A MISSION ROW'S OWN HOUR AND WEATHER (scene/scenarios.ts ScenarioEntry.hour / weather). A tutorial mission's level is built for one hour and one sky (a fuel
// halt at dusk in dust, a plan laid by day); its row used to open at the level's own night whatever its author meant, and at whatever hour and weather the
// visitor's last pick had left on the link.
//   · THE RULE: a visit that boots a mission on a level whose row names an hour is started at that hour, and the same, alone, for the weather. THE ROW'S OWN
//     WINS over `hour=` / `weather=` on the link: every link the page builds (the sheet, the next mission, the loadout, a quit) carries the visitor's standing
//     picks, and those are his for the missions that take a pick — they pass through such a row untouched and are his again after it.
//   · THE HOUR IS THE LEVEL'S, named on its rows (rowOfQuery): a query that boots any mission on a level file whose row names one is started in it — at
//     another seed or team size too (a tool's `roomclear=<seed>`, `squad=3`). So only a row with a level file of its own may name one, and every row of
//     one level file names the same (the check is red otherwise): the sheet, which reads the row picked, and the boot, which reads the query, then agree.
//   · WHERE: main.ts, before the weather, the snow and the hour are read off the page's query (rowSettings writes the keys onto that URLSearchParams, never
//     the address); scenarioRun.ts startFromQuery for a headless tool, on its own copy of the query. Like an `hour=` a tool asks for, what a start lays on
//     stays on that game after the quit — a level is loaded at the stand-up, so the game it stays on runs that level's rows only.
//   · THE SHEET (ui/missions.ts): no Hour row and no Weather row is drawn for such a row, H and J do nothing on it, the note of the one that IS drawn reads
//     the row's own for the other; its link is any row's link. The debugger's weather buttons say so and do nothing on a row with its own weather.
//   · A RECORDING from before the key replays with the switch off: journal.ts applyKnobs for a tool, rowsetTape for the page's tape player (read at boot,
//     before the rule runs). A CHECKPOINT made on a row before it named a weather is refused once it does ('made in other weather': the page is compiled
//     for one); `?rowset=0` opens the row as it was to load it.
// ONE switch, ROWSET.on: ON in the page (`?rowset=0` = the link's hour and weather as ever), OFF in the module and on the frozen harness stand (`TPS_ROWSET=1`);
// a FROZEN_HOLDS row, in the knob registry and a journal's tables (a recording from before the key replays with it off). Off, or no row naming one = the build
// as it was. A level built for snow names no weather (its own stands: weatherKinds.ts SNOW_LEVELS). The check: tools/qa/rowset-check.ts (`ROWSET_BREAK=1`).
// Draws no die, reads no clock, keeps no state. Type-only game imports.
import type { ScenarioEntry } from '../scene/scenarios';
import { ALL_MISSIONS, specOfQuery } from '../scene/scenarioList';
import type { HourId } from './hours';
import type { WeatherKind } from './weatherKinds';

export const ROWSET = { on: false };
/** `ROWSET_BREAK=1` (the check's): no row has an hour or a weather of its own */
const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.ROWSET_BREAK ?? '') === '1'; } catch { return false; } })();
const live = () => ROWSET.on && !BREAK;

const own = (e: ScenarioEntry | null | undefined): e is ScenarioEntry => !!e && !!e.level && !!(e.hour || e.weather);
/** the hour this row is always started at, or null: the visitor's pick */
export function rowHour(e: ScenarioEntry | null | undefined): HourId | null { return live() && own(e) ? e.hour ?? null : null; }
/** the weather this row is always started in, or null: the visitor's pick (or the level's own) */
export function rowWeather(e: ScenarioEntry | null | undefined): NonNullable<ScenarioEntry['weather']> | null { return live() && own(e) ? e.weather ?? null : null; }
/** the row whose own hour or weather a query is started in, or null: the first row of the query's level file that names one (THE HOUR IS THE LEVEL'S, above) */
export function rowOfQuery(search: string | URLSearchParams, list: ScenarioEntry[] = ALL_MISSIONS): ScenarioEntry | null {
  if (!live()) return null;
  const s = specOfQuery(search); return s?.level ? list.find(e => own(e) && e.level === s.level) ?? null : null;
}
/** the row's own hour and weather WRITTEN ONTO a query (over whatever it carried); returns what was put on */
export function rowSettings(q: URLSearchParams, list: ScenarioEntry[] = ALL_MISSIONS): { hour?: HourId; weather?: WeatherKind } {
  const e = rowOfQuery(q, list), put: { hour?: HourId; weather?: WeatherKind } = {}; if (!e) return put;
  if (e.hour) { q.set('hour', e.hour); put.hour = e.hour; }
  if (e.weather) { q.set('weather', e.weather); put.weather = e.weather; }
  return put;
}
/** the page's tape player, as it reads a recording's tables at boot (replay/engineplay.ts): one from before the key is played at its query's hour and weather —
 *  journal.ts applyKnobs says the same afterwards, too late for a rule that runs before the game exists */
export function rowsetTape(tables: Record<string, unknown>) { const t = tables.ROWSET; if (t === null || typeof t !== 'object') ROWSET.on = false; }
