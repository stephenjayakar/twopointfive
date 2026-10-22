// ROWSET-CHECK: a mission row's own hour and weather (src/game/rowset.ts ROWSET; scene/scenarios.ts ScenarioEntry.hour / weather).
//   bun run tools/qa/rowset-check.ts            (both stands: TPS_PROFILE=shipped in front for the page's; `probes.ts rowset`, family `missions`)
//   ROWSET_BREAK=1 bun run tools/qa/rowset-check.ts      must FAIL: no row has an hour or a weather of its own
// The switch is held ON for the lines that read the rule (it is off on the frozen stand) and put back; two lines read it OFF.
// WHAT IT SAYS:
//   · the rule alone: a query that boots a row with its own hour and weather gets both, OVER an `hour=` / `weather=` it carried; the same level at another
//     seed and team size gets them too; a row on the bundled office has none whatever it names; a query that boots no row is left to the character; the
//     switch off, nothing is put on; a recording from before the key puts the switch off for the page's tape player, one made with it leaves it
//   · the rows as shipped: only a Tutorial row with a level file of its own names an hour or a weather, each one a level can be started in, none on a level
//     built for snow, and the rows of one level file name the same
//   · a start through game/scenarioRun.ts startFromQuery (the harness's way in, and what the page's boot does after main.ts ran the same rule over its own
//     query): the game stands at the row's hour and in its weather, with `hour=dawn` on the query too, and the caller's query is not written on; the
//     switch off, the query's hour is laid on, as ever
//   · the mission sheet (ui/missions.ts): the Hour and Weather rows are not drawn for the row and H and J do nothing on it; its link is any row's link (no
//     key unpicked, the visitor's picks once picked); a row that names only an hour keeps its Weather row, whose note reads for the row's hour; one that
//     names only a weather keeps its Hour row, whose note says the weather is the mission's own
//   · the switch is the page's: pageSwitches raises it and `?rowset=0` puts it off (read in the source), this stand has it as its profile says, FROZEN_HOLDS
//     has its row, and main.ts runs the rule after the page's switches and the tape's tables and before it reads the weather, the snow and the hour
// EXIT: 0 = every line holds · 1 = one does not. Headless: no GPU, nothing here saw a picture.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function rowsetCheck(): Promise<boolean> {
  const { standUp, ROOT } = await import('./headless.ts');
  const { withDom, El } = await import('./scenario-picker-probes.ts');
  const HR = await import(`${ROOT}/src/game/hours.ts`);
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { ROWSET, rowSettings, rowOfQuery, rowHour, rowsetTape } = await import(`${ROOT}/src/game/rowset.ts`);
  const { startFromQuery, quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { SCENARIOS, ALL_MISSIONS, LESSON_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`);

  const C = { log: console.log, error: console.error, warn: console.warn }, log = C.log;
  const hush = () => { console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = C.log; console.error = C.error; console.warn = C.warn; };
  let bad = 0;
  const say = (ok: boolean, what: string, got = '') => { log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}${got ? ` — ${got}` : ''}`); if (!ok) bad++; };
  const qs = (s: string) => new URLSearchParams(String(s).replace(/^[^?]*\?/, ''));
  log(`=== rowset-check (${process.env.TPS_PROFILE === 'shipped' ? 'the page\'s stand' : 'the frozen stand'}${process.env.ROWSET_BREAK === '1' ? ', ROWSET_BREAK' : ''}) ===`);
  const on0 = ROWSET.on; let stood = on0;   // (stood: the switch as a stand-up leaves it — the frozen stand's raise word is read there)
  // the rows the lines below borrow: a mission with a level file of its own, and a plain one on the bundled office; their own keys are put on for a line and
  // taken off after it
  const plainRow = (e: any) => e.kind === 'roomclear' && !e.hour && !e.weather;
  const L = SCENARIOS.find((e: any) => plainRow(e) && e.level && !WK.SNOW_LEVELS.includes(e.level.replace(/\.json$/, ''))), E = SCENARIOS.find((e: any) => plainRow(e) && !e.level);
  const base = String(scenarioQuery(L)), baseE = String(scenarioQuery(E));
  const own = (e: any, hour?: string, weather?: string) => { if (hour) e.hour = hour; else delete e.hour; if (weather) e.weather = weather; else delete e.weather; };
  try {
    ROWSET.on = true;
    { // the rule alone
      own(L, 'dusk', 'dust'); own(E, 'midday', 'fog');
      const a = qs(base), putA = rowSettings(a), b = qs(base + '&hour=dawn&weather=rain'), putB = rowSettings(b);
      const c = qs(base.replace(/roomclear(=\d+)?/, 'roomclear=7').replace(/&squad4\b|&squad=\d/, '') + '&squad=3'), putC = rowSettings(c);
      const o = qs(baseE), putO = rowSettings(o), officeHour = rowHour(E);
      const d = qs('?quality=high&mute'), putD = rowSettings(d);
      ROWSET.on = false; const e = qs(base), putE = rowSettings(e);
      ROWSET.on = true; rowsetTape({ ROWSET: { on: true } }); const tapeNew = ROWSET.on; rowsetTape({ STARTLE: { on: true } }); const tapeOld = ROWSET.on; ROWSET.on = true;
      own(L); own(E);
      say(a.get('hour') === 'dusk' && a.get('weather') === 'dust' && putA.hour === 'dusk' && putA.weather === 'dust', 'a query that boots the row gets the row\'s own hour and weather', `${a}`);
      say(b.get('hour') === 'dusk' && b.get('weather') === 'dust' && putB.hour === 'dusk' && b.getAll('hour').length === 1, 'the row\'s own win over an hour and a weather the query carried', `${b}`);
      say(c.get('hour') === 'dusk' && c.get('weather') === 'dust' && putC.hour === 'dusk', 'the same level at another seed and team size is started in them too', `${c}`);
      say(`${o}` === `${qs(baseE)}` && !putO.hour && officeHour === null, 'a row on the bundled office has none, whatever it names', `${o}`);
      say(`${d}` === `${qs('?quality=high&mute')}` && !putD.hour && !putD.weather, 'a query that boots no row is left to the character', `${d}`);
      say(`${e}` === `${qs(base)}` && !putE.hour && !putE.weather, 'the switch off, nothing is put on', `${e}`);
      say(tapeNew === true && tapeOld === false, 'a recording from before the key puts the switch off for the page\'s tape player, one made with it leaves it', `${tapeNew} · ${tapeOld}`);
    }
    { // the rows as shipped
      const rows = [...new Set([...ALL_MISSIONS, ...LESSON_MISSIONS])] as any[], named = rows.filter(e => e.hour || e.weather);
      const wrong = named.filter(e => e.group !== 'tutorial' || !e.level || (e.hour && !HR.HOUR_IDS.includes(e.hour)) || (e.weather && !WK.isWeatherKind(e.weather)) || (e.weather && WK.SNOW_LEVELS.includes(String(e.level ?? '').replace(/\.json$/, ''))));
      const split = named.filter(e => rows.some(x => x.level === e.level && (x.hour !== e.hour || x.weather !== e.weather)));
      say(!wrong.length && !split.length, 'only a Tutorial row with a level file of its own names an hour or a weather, each one a level can be started in, none on a level built for snow, and the rows of one level file name the same', `${named.length} row(s) name one: ${named.map(e => `${e.id} ${e.hour ?? '·'}/${e.weather ?? '·'}`).join(', ') || 'none'}${wrong.length ? ` · wrong: ${wrong.map(e => e.id).join(', ')}` : ''}${split.length ? ` · a level file whose rows differ: ${split.map(e => e.id).join(', ')}` : ''}`);
    }
    { // a start through startFromQuery
      hush(); const W: any = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', L.level), 'utf8'))) }); unhush();
      stood = ROWSET.on; ROWSET.on = true;   // (the stand-up writes the stand's switches: held on again for these lines)
      const g = W.game, at = () => `${HR.hourOf(g)}/${g.weather?.kind ?? 'none'}`, at0 = at();
      const start = (q: string | URLSearchParams) => { hush(); const r = startFromQuery(g, q); unhush(); const v = r.why ? `refused: ${r.why}` : at(); hush(); quitScenario(g); unhush(); return v; };
      own(L, 'dusk', 'dust'); const mine = start(base), theirs = qs(base + '&hour=dawn'), was = `${theirs}`, asked = start(theirs), kept = `${theirs}` === was;
      hush(); HR.applyHour(g, 'night'); unhush();
      ROWSET.on = false; const off = start(base + '&hour=dawn'); ROWSET.on = true; own(L);
      say(mine === 'dusk/dust' && asked === 'dusk/dust', 'started by its own query, the game stands at the row\'s hour and in its weather, with another hour on the query too', `${mine} · with hour=dawn: ${asked} (before: ${at0})`);
      say(kept, 'the caller\'s query is not written on', was);
      say(off.startsWith('dawn/'), 'the switch off, the query\'s hour is laid on, as ever', off);
    }
    await withDom('?quality=high&mute', async () => { // the mission sheet (a search of its own: the sheet remembers a pick by the search it was opened on)
      const M = await import(`${ROOT}/src/ui/missions.ts`);
      const host = new El('DIV'); const S = M.openMissions({ root: host as any, search: '?quality=high&mute&rowsetcheck' });
      try {
        const rowsOf = () => host.all((e: any) => e.cls.has('mdiff') && e.style.display !== 'none').map((e: any) => e.cls.has('mhour') ? 'hour' : e.cls.has('mwx') ? 'weather' : '').filter(Boolean).join(',');
        const noteOf = (c: string) => host.all((e: any) => e.cls.has('dn') && e.parentElement?.cls.has(c))[0]?.textContent ?? '';
        const me = S.list.find((m: any) => m.scenario === L), other = S.list.find((m: any) => m.scenario === E);
        if (!me || !other) { say(false, 'the sheet lists the two borrowed rows', `${!!me} ${!!other}`); return; }
        const again = () => { S.select(other.id); S.select(me.id); };   // (a repaint of the row)
        S.select(me.id); const plainRows = rowsOf(), p0 = S.hrefOf(me);
        own(L, 'dusk', 'dust'); again(); const rows = rowsOf(), h0 = S.hrefOf(me), startsIn = `${S.startHour}/${S.startWeather}`;
        const key = (code: string) => M.missionsKey({ code, repeat: false }); key('KeyH'); key('KeyJ'); const keyH = S.hourNow, keyJ = S.weather;
        S.hour('midday'); S.setWeather('overcast'); const h1 = S.hrefOf(me), o1 = S.hrefOf(other), still = `${S.startHour}/${S.startWeather}`;
        own(L, 'dusk'); again(); const rowsHourOnly = rowsOf(), noteMine = noteOf('mwx');
        own(L); S.hour('dusk'); again(); const notePlain = noteOf('mwx'); S.hour('night'); again(); const noteNight = noteOf('mwx');
        own(L, undefined, 'dust'); again(); const rowsWxOnly = rowsOf(), hourNote = noteOf('mhour');
        const once = (h: string, k: string, v: string) => (h.match(new RegExp(`[?&]${k}=`, 'g')) ?? []).length === 1 && new RegExp(`[?&]${k}=${v}(&|$)`).test(h);
        say(plainRows === 'hour,weather' && rows === '' && keyH === 'night' && keyJ === null && startsIn === 'dusk/dust' && still === 'dusk/dust', 'the Hour and Weather rows are not drawn for the row, H and J do nothing on it, and it starts in its own whatever is picked', `plain: '${plainRows}' · its own: '${rows}' · after H and J: ${keyH}, ${keyJ} · starts in ${startsIn}, after Midday and Overcast ${still}`);
        say(h0 === p0 && !/hour=|weather=/.test(h0) && once(h1, 'hour', 'midday') && once(h1, 'weather', 'overcast') && once(o1, 'hour', 'midday'), 'its link is any row\'s link: no key unpicked, the visitor\'s picks once picked', `${h0} · ${h1}`);
        say(rowsHourOnly === 'weather' && noteMine !== '' && noteMine === notePlain && noteMine !== noteNight, 'a row that names only an hour keeps its Weather row, and the note reads for the row\'s hour', `'${noteMine}' · at night it reads '${noteNight}'`);
        say(rowsWxOnly === 'hour' && /the mission's own weather/.test(hourNote), 'a row that names only a weather keeps its Hour row, and the note says the weather is the mission\'s own', `'${hourNote}'`);
      } finally { own(L); own(E); try { S.hour('night'); S.setWeather(null); } catch { /* the sheet is gone */ } M.closeMissions(); }
    });
    { // the switch is the page's
      const prof = readFileSync(resolve(ROOT, 'src/host/profile.ts'), 'utf8'), wrote = prof.includes("ROWSET.on = q.get('rowset') !== '0';");
      const want = process.env.TPS_ROWSET !== undefined ? process.env.TPS_ROWSET === '1' : process.env.TPS_PROFILE === 'shipped';
      const src = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8'), p = src.indexOf('pageSwitches(q)'), t = src.indexOf('tape?.tables()'), r = src.indexOf('rowSettings(q)'), w = src.indexOf('initWeather(q)'), h = src.indexOf('initHour(q)'), s = src.indexOf('snowLevelOfQuery(q)');
      say(wrote && stood === want && FROZEN_HOLDS['ROWSET.on'] === 'TPS_ROWSET=1', 'the page raises the switch and ?rowset=0 puts it off (pageSwitches), this stand has it as its profile says, and the frozen stand\'s list has its row', `on this stand: ${stood} · ${FROZEN_HOLDS['ROWSET.on']}`);
      say(p > 0 && t > 0 && p < r && t < r && r < w && r < h && r < s, 'main.ts runs the rule after the page\'s switches and the tape\'s tables, and before it reads the weather, the snow and the hour');
    }
  } finally { ROWSET.on = on0; own(L); own(E); unhush(); }
  log(bad ? `=== rowset-check: FAIL (${bad} line(s) do not hold) ===` : '=== rowset-check: ALL PASS ===');
  return !bad;
}
if (import.meta.main) process.exit((await rowsetCheck()) ? 0 : 1);
