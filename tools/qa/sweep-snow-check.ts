// The F8 sweep's two snow flips against the game's own snow tables (src/ui/sweepSnow.ts): when each refuses and why, what it writes, that it puts it back.
// 'one snow in one air off' first, then the wisps' row ('blown snow wisps: the combed streak of before').
// A stand-in game (no level, no GPU): only what snowing / oneAirOn read. On a build from before one air the one check is that the row is refused by name.
//   bun run tools/qa/sweep-snow-check.ts   (exit 0 = all pass)
import { oneAirFlip, wispMotesFlip } from '../../src/ui/sweepSnow';
import * as snowFx from '../../src/game/snowFx';
import { SNOW_LOOK } from '../../src/game/weatherKinds';
import { snowLookConfig } from '../../src/render/frame';
import { AIR_SIM } from '../../src/game/airSim';
let red = 0; const check = (ok: boolean, w: string) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${w}`); if (!ok) red++; };
const L = SNOW_LOOK as unknown as Record<string, unknown>, has = typeof L.oneAir === 'boolean' && typeof (snowFx as any).oneAirOn === 'function';
const was = { ...L }, cfg = snowLookConfig.grains, cfgW = snowLookConfig.wisps, air = AIR_SIM.on;
const g: any = { engine: { weather: { snow: 1 }, air: {}, settings: { airSim: true } } };
L.grains = true; snowLookConfig.grains = true; AIR_SIM.on = true;
if (!has) { const r = oneAirFlip(g); check(typeof r === 'string' && /not one snow in one air/.test(r), `a build from before one air: refused by name (${r})`); }
else {
  L.oneAir = true;
  { g.engine.weather.snow = 0; const r = oneAirFlip(g); check(typeof r === 'string' && /no snow falls/.test(r), `no snow falling: refused (${r})`); g.engine.weather.snow = 1; }
  { L.oneAir = false; const r = oneAirFlip(g); check(typeof r === 'string' && /already/.test(r), `the page opened with the snow of before: nothing to flip (${r})`); L.oneAir = true; }
  { g.engine.settings.airSim = false; const r = oneAirFlip(g); check(typeof r === 'string' && /no simulated air/.test(r), `snow with the wind sim off: refused (${r})`); g.engine.settings.airSim = true; }
  { delete g.engine.air; const r = oneAirFlip(g); check(typeof r === 'string' && /no simulated air/.test(r), 'snow on a page that built no air field: refused'); g.engine.air = {}; }
  { L.grains = false; const r = oneAirFlip(g); check(typeof r === 'string' && /grains are switched off/.test(r), `the grains switched off: refused, it would be the wind sim row twice (${r})`); L.grains = true; }
  { const r = oneAirFlip(g);
    if (typeof r === 'string') check(false, `snow riding the air should flip (${r})`);
    else {
      check(JSON.stringify(r.from) === '{"oneAir":true}' && JSON.stringify(r.to) === '{"oneAir":false}', `from ${JSON.stringify(r.from)} to ${JSON.stringify(r.to)}`);
      const before = JSON.stringify(L), undo = r.apply();
      check(L.oneAir === false && Object.keys(L).every(k => k === 'oneAir' || JSON.parse(before)[k] === L[k]), 'the flip writes the one switch and nothing else of the table');
      check((snowFx as any).oneAirOn(g) === false && snowFx.grainsOn(g) === true, 'flipped, the snow is the one of before: not one air, the grains run');
      check(typeof oneAirFlip(g) === 'string', 'while it is flipped the row has nothing more to flip');
      undo(); check(JSON.stringify(L) === before && (snowFx as any).oneAirOn(g) === true && snowFx.grainsOn(g) === false, 'the undo leaves the table exactly as it was: one air again, no grains');
    } }
}
{ // the wisps' row: motes to none and the streak's own stretch, both back as they stood
  const W = snowFx.SNOWWISPS as unknown as Record<string, number>, w0 = { ...W }, st = snowFx.wispStats(g);
  L.wisps = true; snowLookConfig.wisps = true; st.active = true; st.why = 'blowing';
  { g.engine.weather.snow = 0; const r = wispMotesFlip(g); check(typeof r === 'string' && /no snow falls/.test(r), `wisps, no snow falling: refused (${r})`); g.engine.weather.snow = 1; }
  { L.wisps = false; const r = wispMotesFlip(g); check(typeof r === 'string' && /switched off/.test(r), `the wisps switched off: refused (${r})`); L.wisps = true; }
  { snowLookConfig.wisps = false; const r = wispMotesFlip(g); check(typeof r === 'string' && /switched off/.test(r), 'a page whose shaders were built without wisps: refused'); snowLookConfig.wisps = true; }
  { W.motes = 0.03; const r = wispMotesFlip(g); check(typeof r === 'string' && /already the combed streak/.test(r), `motes too few to make a sixteenth: the wisps are streaks already, nothing to flip (${r})`); W.motes = w0.motes; }
  { st.active = false; st.why = 'the air is too slow to lift snow'; const r = wispMotesFlip(g); check(r === 'no wisp blows here right now: the air is too slow to lift snow', `no wisp in the air: refused with the snow's own reason (${r})`); st.active = true; st.why = 'blowing'; }
  { const r = wispMotesFlip(g);
    if (typeof r === 'string') check(false, `wisps blowing as motes should flip (${r})`);
    else {
      check(JSON.stringify(r.from) === JSON.stringify({ motes: w0.motes, stretch: w0.stretch }) && JSON.stringify(r.to) === '{"motes":0,"stretch":0.3}', `from ${JSON.stringify(r.from)} to ${JSON.stringify(r.to)}`);
      W.life = 8; const long = wispMotesFlip(g) as { settleMs?: number }; W.life = w0.life;
      check(r.settleMs === Math.ceil(w0.life * (1 + w0.lifeJit) * 1000) + 1500 && long.settleMs === Math.ceil(8 * (1 + w0.lifeJit) * 1000) + 1500, `the wait it names is a wisp's longest life and a second and a half, off the table as it stands (${r.settleMs} ms; with an 8 s life ${long.settleMs})`);
      const before = JSON.stringify(W), look0 = snowFx.wispLookByte(), undo = r.apply();
      check(W.motes === 0 && W.stretch === 0.3 && Object.keys(W).every(k => k === 'motes' || k === 'stretch' || JSON.parse(before)[k] === W[k]), 'the flip writes the motes and the stretch and nothing else of the table');
      check(look0 >= 16 && snowFx.wispLookByte() < 16, `flipped, a wisp filed now carries no motes: the shader takes the streak branch (look byte ${look0} → ${snowFx.wispLookByte()})`);
      check(typeof wispMotesFlip(g) === 'string', 'while it is flipped the row has nothing more to flip');
      undo(); check(JSON.stringify(W) === before && snowFx.wispLookByte() === look0, 'the undo leaves the table exactly as it was');
      { W.stretch = 0.2; const u2 = r.apply(); u2(); check(W.stretch === 0.2 && W.motes === w0.motes, 'a number tuned between the take\'s start and the flip is what the undo puts back, not the one read at the start'); W.stretch = w0.stretch; }
    } }
  for (const k of Object.keys(w0)) W[k] = w0[k];
}
for (const k of Object.keys(was)) L[k] = was[k]; snowLookConfig.grains = cfg; snowLookConfig.wisps = cfgW; AIR_SIM.on = air;
process.exit(red ? 1 : 0);
