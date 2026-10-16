// THE HOUR (src/game/hours.ts): a level started at another time of day than the night it was authored for — `probes.ts hours`.
//   hours-night       night is no record: every hour laid over each squad map and taken off again leaves the light list, the switches, the sky, haze, exposure
//                     and the storm exactly as found; at night the meter's stand-in gets nothing from the module; a seeded run after a round trip digests as one
//                     that never left the night
//   hours-light       what an hour is, on each of the four squad maps: the sun in the moon's place, the outside lamps on their photocell, the stand-in's meter
//                     in the open, under a roof, in a shut room and behind a door leaf shut then open; the one number that dims the sun
//   hours-restart     a restart and a checkpoint keep the hour (lamps out again, one sun, the file's `hour`; a night's file carries none and loads as night)
//   hours-team        the squad's own rule by the same light: a stack on a yard door by night, at midday and at dusk — weapon lights follow the place's light
//   hours-sheet       ?hour= and its aliases, the link helper, the mission sheet's Hour row and H key on the real screen over a fake DOM
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const HR = await import(`${ROOT}/src/game/hours.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { nvgSummary } = await import(`${ROOT}/src/game/nvg.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SCENARIOS, pickSearch } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { HOUR, HOURS, HOUR_IDS, applyHour, hourOf, hourSun, hourLightAt, hourIdOf, hourHref, initHour, setSunStrength, sunStrength } = HR;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** the loud squad maps (scene/scenarioList.ts ids → their level files) */
export const SQUAD_MAPS = ['compound-four', 'block-squads', 'barracks-four', 'warehouse-four'];
const entryOf = (id: string) => SCENARIOS.find((e: any) => e.id === id);
const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
async function stand(id: string, seed = 7): Promise<any> { Math.random = seeded(seed); HOUR.id = 'night'; HOUR.sun = 1; HOUR.dry = true; return quiet(() => standUp({ level: levelOf(entryOf(id).level) })); }
const DAY = HOUR_IDS.filter((h: string) => h !== 'night');
/** everything an hour may touch, as one string */
function rigOf(g: any): string {
  const S = g.engine.settings;
  return JSON.stringify({ lights: g.engine.lights.lights.map((l: any) => [l.name, l.group, l.kind, l.enabled, l.intensity, l.peakIntensity, l.color, l.dir, l.radius, l.volumetric]), on: g.targets.map((t: any) => [t.name, t.on, t.broken]),
    sky: [S.skyZenith, S.skyHorizon], haze: S.hazeDensity, exposure: S.exposure, storm: g.weather.enabled });
}
/** sample points over the floor at chest height, off the statics */
function grid(g: any, step = 2): number[][] { const P: number[][] = []; for (let x = 1; x < 40; x += step) for (let z = 1; z < 28; z += step) P.push([x + 0.13, 1.2, z + 0.21]); return P; }
const vis = (g: any, E: number) => g.visibilityOf(E) as number;

export async function hoursNight(): Promise<boolean> {
  const F = family('hours-night: night is no record — the level as authored, before and after any hour');
  const bad: string[] = [], detail: string[] = [];
  for (const id of SQUAD_MAPS) {
    const W = await stand(id), g = W.game, P = grid(g);
    const rig0 = rigOf(g), est0 = P.map(p => lightEstimateAt(g, p)), add0 = P.map(p => hourLightAt(g, p));
    let trips = 0, same = true;
    for (const h of [...DAY, 'dusk', 'midday']) { applyHour(g, h); if (rigOf(g) === rig0) same = false; applyHour(g, 'night'); if (rigOf(g) !== rig0) same = false; trips++; }
    applyHour(g, 'dawn'); applyHour(g, 'overcast'); applyHour(g, 'night'); if (rigOf(g) !== rig0) same = false;   // (hour → hour → night)
    const est1 = P.map(p => lightEstimateAt(g, p));
    const ok = same && hourOf(g) === 'night' && hourSun(g) === null && add0.every(v => v === 0) && est0.every((v, i) => v === est1[i]);
    if (!ok) bad.push(id); detail.push(`${id}: ${trips + 1} round trips, rig ${same ? 'identical' : 'CHANGED'}, ${P.length} meter points ${est0.every((v, i) => v === est1[i]) ? 'identical' : 'CHANGED'}`);
  }
  F.verdict(bad.length === 0, 'every hour laid over each squad map and taken off again: the light list, every switch, sky, haze, exposure and the storm exactly as found, and the stand-in\'s meter reads what it read', detail.join(' · '));
  // a seeded run after a round trip ≡ one that never left the night
  { const run = async (trip: boolean) => { const W = await stand('compound-four', 11), g = W.game; if (trip) { applyHour(g, 'midday'); applyHour(g, 'night'); }
      await quiet(() => startFromQuery(g, new URLSearchParams(pickSearch(entryOf('compound-four'), '')))); let h = ''; for (let i = 0; i < 60 * 12; i++) { W.step(1 / 60); if (i % 60 === 59) h += hashDigest(digestGame(g, true)) + ' '; } return h; };
    const a = await run(false), b = await run(true);
    F.verdict(a === b && a.length > 0, 'twelve seeded seconds of the compound entry after a midday round trip digest as the run that never left the night', `${a.split(' ').length - 1} digests, ${a === b ? 'identical' : 'DIFFERENT'} (last ${a.trim().split(' ').pop()})`); }
  return F.done();
}

export async function hoursLight(): Promise<boolean> {
  const F = family('hours-light: the sun in the moon\'s place, the lamps on a photocell, the hour in the meter\'s stand-in');
  const rigBad: string[] = [], rigD: string[] = [], lit: string[] = [], litBad: string[] = [];
  let doorSeen = 0; const doorD: string[] = [];
  for (const id of SQUAD_MAPS) {
    const W = await stand(id), g = W.game, P = grid(g, 1.5), L = g.engine.lights.lights;
    const night = P.map(p => lightEstimateAt(g, p)), moonAt = L.findIndex((l: any) => l.kind === 2), ext = g.targets.filter((t: any) => t.group === 'exterior'), extOn0 = ext.map((t: any) => t.on);
    for (const h of DAY) {
      applyHour(g, h); const D = HOURS[h], sun = hourSun(g), at = L.indexOf(sun);
      const okRig = !!sun && sun.kind === 2 && at === moonAt + 1 && L.filter((l: any) => l.kind === 2 && l.enabled).length === 1 && !L[moonAt].enabled && sun.intensity === D.sun.intensity && Math.abs(-sun.dir[1] - Math.sin(D.sun.elevDeg * Math.PI / 180)) < 1e-9
        && ext.every((t: any, i: number) => t.on === (D.lamps ? extOn0[i] : false)) && g.engine.settings.exposure === D.exposure && g.weather.enabled === false && g.targets.filter((t: any) => t.group !== 'exterior').every((t: any) => t.on === true || t.on === false);
      if (!okRig) rigBad.push(`${id}@${h}`);
      // the meter's stand-in: the open (the brightest fifth of the points) reads as the hour should; points the hour does not reach read exactly as at night
      const E = P.map(p => lightEstimateAt(g, p)), add = E.map((e, i) => e - night[i]), sorted = [...E].sort((a, b) => b - a), open = vis(g, sorted[Math.floor(P.length * 0.1)]), same = add.filter(a => a === 0).length, less = add.filter(a => a < -1e-9).length;
      const want = h === 'midday' ? 0.9 : h === 'overcast' ? 0.6 : 0.35;
      // (a point can read LESS than at night only where an outside lamp the photocell has put out was lighting it)
      const okLit = open >= want && same >= P.length * 0.08 && (D.lamps ? less === 0 : true);
      if (!okLit) litBad.push(`${id}@${h}`); lit.push(`${id}@${h}: open ${open.toFixed(2)} · untouched ${same}/${P.length}${less ? ` · darker ${less}` : ''}`);
      applyHour(g, 'night');
    }
    rigD.push(`${id}: moon at ${moonAt}, ${ext.length} outside lamps`);
    // a door leaf: the darkest side of a door whose other side stands in the midday open — shut, then open
    applyHour(g, 'midday');
    for (const d of g.doors.list) {
      const c = d.frameCentre, nx = -Math.sin(d.def.closedDir), nz = Math.cos(d.def.closedDir); const A = [c[0] + nx * 1.2, 1.2, c[2] + nz * 1.2], B = [c[0] - nx * 1.2, 1.2, c[2] - nz * 1.2];
      const a0 = hourLightAt(g, A), b0 = hourLightAt(g, B); if (Math.max(a0, b0) < 2 || Math.min(a0, b0) > 0.2) continue;
      const In = a0 < b0 ? A : B, shut = hourLightAt(g, In), was = d.angle;
      const hi = d.def.maxAngle ?? 1.5, lo = d.def.minAngle ?? -1.5; d.angle = Math.abs(hi) >= Math.abs(lo) ? Math.min(hi, 1.5) : Math.max(lo, -1.5); d.place(); const open = hourLightAt(g, In);
      doorD.push(`${id} ${d.def.name}: shut ${vis(g, shut).toFixed(2)} → open ${vis(g, open).toFixed(2)}`); if (open > shut + 0.02) doorSeen++; d.angle = was; d.place(); break;
    }
    applyHour(g, 'night');
  }
  F.verdict(rigBad.length === 0, 'at each hour on each squad map: one sun, directional, right after the moon in the list, the moon out, the outside lamps as authored at dawn and dusk and out at midday and under overcast, the hour\'s exposure, the storm held', rigD.join(' · ') + (rigBad.length ? ` — NOT: ${rigBad.join(', ')}` : ''));
  F.verdict(litBad.length === 0, 'the stand-in\'s meter by the hour: the open reads lit (midday ≥ 0.9, overcast ≥ 0.6, dawn and dusk ≥ 0.35 of the meter), and points no sun or sky reaches read exactly as at night', lit.join(' · ') + (litBad.length ? ` — NOT: ${litBad.join(', ')}` : ''));
  F.verdict(doorD.length === 0 || doorSeen > 0, 'a door between the midday open and a darker room: the room side reads brighter with the leaf open than shut on at least one of them (the leaf is asked every time)', doorD.join(' · ') || 'no such door on these maps');
  // the one number
  { const W = await stand('compound-four'), g = W.game, P = grid(g, 1.5); applyHour(g, 'midday');
    const E1 = P.map(p => lightEstimateAt(g, p)), H1 = P.map(p => hourLightAt(g, p)), top = H1.indexOf(Math.max(...H1)); setSunStrength(g, 0.25); const Eq = lightEstimateAt(g, P[top]), I = hourSun(g).intensity; setSunStrength(g, 0); const E0 = lightEstimateAt(g, P[top]), sky = hourLightAt(g, P[top]); setSunStrength(g, 1);
    F.verdict(I === HOURS.midday.sun.intensity * 0.25 && Eq < E1[top] && E0 < Eq && sky > 0 && sunStrength(g) === 1 && lightEstimateAt(g, P[top]) === E1[top],
      'the sun\'s strength is one number: at 0.25 the light\'s intensity is a quarter and the sunlit point reads less, at 0 only the sky is left, back at 1 it reads what it read', `sunlit point ${E1[top].toFixed(2)} → ${Eq.toFixed(2)} → ${E0.toFixed(2)} (sky alone ${sky.toFixed(2)})`); }
  return F.done();
}

export async function hoursRestart(): Promise<boolean> {
  const F = family('hours-restart: a restart and a checkpoint keep the hour');
  { const W = await stand('compound-four'), g = W.game; applyHour(g, 'midday'); const rig = rigOf(g), ext = g.targets.filter((t: any) => t.group === 'exterior');
    for (let i = 0; i < 30; i++) W.step(1 / 60); await quiet(() => g.restartEncounter()); for (let i = 0; i < 5; i++) W.step(1 / 60);
    const suns = g.engine.lights.lights.filter((l: any) => l.name === 'sun').length;
    F.verdict(hourOf(g) === 'midday' && suns === 1 && ext.length > 0 && ext.every((t: any) => !t.on) && JSON.parse(rigOf(g)).exposure === JSON.parse(rig).exposure,
      'after a restart at midday: still midday, one sun, the outside lamps out again (the level\'s reset had put them back as authored)', `hour ${hourOf(g)} · suns ${suns} · outside lamps on: ${ext.filter((t: any) => t.on).length}/${ext.length}`); }
  { // the office: checkpoints are the solo night's (a squad staged on the floor refuses a save)
    Math.random = seeded(5); HOUR.id = 'night'; const W: any = await quiet(() => standUp()), g = W.game; for (let i = 0; i < 20; i++) W.step(1 / 60);
    const night = W.snapshot('night'); applyHour(g, 'dusk'); setSunStrength(g, 0.5); for (let i = 0; i < 20; i++) W.step(1 / 60); const dusk = W.snapshot('dusk'), text = JSON.stringify(dusk);
    Math.random = seeded(5); const W2: any = await quiet(() => standUp()), g2 = W2.game; const before = hourOf(g2); await quiet(() => W2.restore(JSON.parse(text))); const got = hourOf(g2), k = sunStrength(g2), I = hourSun(g2)?.intensity;
    await quiet(() => W2.restore(night)); const back = hourOf(g2);
    F.verdict(!('hour' in night) && dusk.hour?.id === 'dusk' && dusk.hour?.sun === 0.5 && before === 'night' && got === 'dusk' && k === 0.5 && I === HOURS.dusk.sun.intensity * 0.5 && back === 'night' && hourSun(g2) === null,
      'a checkpoint saved at dusk carries the hour and the sun\'s strength and puts a fresh night game at dusk; a night\'s file carries no hour and loads as the night', `night file hour: ${JSON.stringify(night.hour)} · dusk file hour: ${JSON.stringify(dusk.hour)} · fresh game ${before} → ${got} (sun ×${k}) → ${back}`); }
  { // the hour handed over on a scenario's query (a measuring tool's way in) is the hour the page's boot lays on: the same run, digest for digest
    const e = entryOf('compound-four'); const runOf = async (boot: string, query: string) => { Math.random = seeded(31); HOUR.sun = 1; HOUR.dry = true; HOUR.id = boot; let W: any; try { W = await quiet(() => standUp({ level: levelOf(e.level) })); } finally { HOUR.id = 'night'; }
      await quiet(() => startFromQuery(W.game, new URLSearchParams(pickSearch(e, '') + query))); for (let i = 0; i < 60 * 8; i++) W.step(1 / 60); return { hour: hourOf(W.game), sun: sunStrength(W.game), d: hashDigest(digestGame(W.game, true)) }; };
    const a = await runOf('midday', ''), b = await runOf('night', '&hour=midday'), c = await runOf('night', ''), d = await runOf('night', '&hour=dusk&sun=0.5');
    F.verdict(a.hour === 'midday' && b.hour === 'midday' && a.d === b.d && c.hour === 'night' && c.d !== a.d && d.hour === 'dusk' && d.sun === 0.5,
      '?hour= on the query a scenario is started from (a tool\'s way in) is the hour a boot at that hour plays: eight seeded seconds of the compound digest the same either way, and not as the night', `boot midday ${a.d} · query midday ${b.d} · night ${c.d} · query dusk at half sun: ${d.hour} ×${d.sun}`); }
  return F.done();
}

export async function hoursTeam(): Promise<boolean> {
  const F = family('hours-team: the squad\'s weapon lights follow the hour\'s light — the rule reads the place, not the clock');
  const rows: string[] = []; const got: Record<string, { lights: number; goggles: number; placeVis: number }> = {};
  for (const h of ['night', 'midday', 'dusk']) {
    Math.random = seeded(21); HOUR.sun = 1; HOUR.dry = true; HOUR.id = h; const e = entryOf('compound-four');
    let W: any; try { W = await quiet(() => standUp({ level: levelOf(e.level) })); } finally { HOUR.id = 'night'; } const g = W.game;   // (the visit's hour is module state: never left set for the next probe)
    await quiet(() => startFromQuery(g, new URLSearchParams(pickSearch(e, ''))));
    const team = g.guards.filter((x: any) => x.team === 'operative' && x.unit);
    // the team told to stack on the front door, from the yard, Sam's own light on — which frees theirs (nvg.ts: 'your light'): what burns is then the light
    // rule's alone (guards.ts LIGHTS — off wherever the place itself reads lit)
    const door = g.doors.byName('front'), O = g.orders; await quiet(() => O.give('stack', O.targetAt(door.frameCentre))); g.player.pistol.lightOn = true; g.player.rifle.lightOn = true;
    let lights = 0, goggles = 0, n = 0;
    for (let i = 0; i < 60 * 14; i++) { W.step(1 / 60); if (i >= 60 * 4 && i % 20 === 19) { n++; const s = nvgSummary(g) as string; lights += (s.match(/ light(?= ·|$)/g) ?? []).length; goggles += (s.match(/ goggles(?= ·|$)/g) ?? []).length; } }
    const at = team[0].char.pos; got[h] = { lights: lights / n, goggles: goggles / n, placeVis: vis(g, lightEstimateAt(g, [at[0], 1.2, at[2]], () => true, true)) };
    rows.push(`${h}: the stack's place reads ${got[h].placeVis.toFixed(2)}, weapon lights on ${got[h].lights.toFixed(1)} of ${team.length}, goggles down ${got[h].goggles.toFixed(1)}`);
  }
  F.verdict(got.night.lights >= 3 && got.midday.placeVis > 0.8 && got.midday.lights === 0 && got.dusk.lights <= got.night.lights,
    'the same team stacking on the same door with its lights freed: by night the weapon lights burn (something along each man\'s gun is dark, lamp or no lamp); at midday the yard reads lit throughout and none does — nothing but the light changed', rows.join(' · '));
  return F.done();
}

export async function hoursSheet(): Promise<boolean> {
  const F = family('hours-sheet: ?hour= and the mission sheet\'s Hour row');
  { const ids = ['dawn', 'midday', 'overcast', 'dusk', 'night'].map(hourIdOf).join(','), al = ['noon', 'day', 'afternoon', 'sunset', 'DUSK', '', 'teatime', null].map(hourIdOf).join(',');
    const keep = { ...HOUR }; let a: any, b: any, c: any, d: any; try { initHour(new URLSearchParams('?levelFile=compound.json&roomclear&hour=noon&sun=0.4')); a = { ...HOUR }; HOUR.sun = 1; initHour(new URLSearchParams('?roomclear')); b = { ...HOUR }; initHour(new URLSearchParams('?hour=dusk&noweather')); c = { ...HOUR }; initHour(new URLSearchParams('?hour=constructor')); d = { ...HOUR }; } finally { Object.assign(HOUR, keep); }
    F.verdict(ids === 'dawn,midday,overcast,dusk,night' && al === 'midday,midday,overcast,dusk,dusk,night,night,night' && a.id === 'midday' && a.sun === 0.4 && b.id === 'night' && b.sun === 1 && c.id === 'dusk' && c.dry === false && d.id === 'night' && hourIdOf('__proto__') === 'night',
      '?hour= takes the five names and a few plain words for them; anything else, or no flag, is the night; ?sun= is the strength; ?noweather leaves the storm to its own flag', `${ids} · ${al} · ${JSON.stringify(a)} · ${JSON.stringify(b)}`);
    const h = [hourHref('?levelFile=compound.json&roomclear&squad4', 'dusk'), hourHref('?roomclear&hour=dusk&mute', 'midday'), hourHref('?roomclear&hour=dusk&mute', 'night'), hourHref('?hour=dawn', 'night'), hourHref('', 'dawn'), hourHref('?hourly=1&hour', 'night')];
    F.verdict(JSON.stringify(h) === JSON.stringify(['?levelFile=compound.json&roomclear&squad4&hour=dusk', '?roomclear&mute&hour=midday', '?roomclear&mute', '', '?hour=dawn', '?hourly=1']), 'a link takes one hour: put on, replaced, and taken off for the night (the bare link is the level as it was made)', h.join('  ·  ')); }
  await withDom('?quality=high&mute', async () => {
    const M = await import(`${ROOT}/src/ui/missions.ts`); const host = new El('DIV'); const S = M.openMissions({ root: host as any, search: '?quality=high&mute' });
    try {
      const btns = () => host.all(e => !!e.attrs['data-hour']), litOf = () => btns().filter(e => e.cls.has('on')).map(e => e.attrs['data-hour']).join(','), hrefs = () => host.all(e => e.cls.has('mrow')).map(e => e.attrs.href ?? '');
      S.select('compound-four'); const l0 = litOf(), h0 = hrefs();
      const seq: string[] = []; for (let i = 0; i < 5; i++) { M.missionsKey({ code: 'KeyH' }); seq.push(S.hourNow); } M.missionsKey({ code: 'KeyH', shiftKey: true } as any); const backOne = S.hourNow;
      btns().find(e => e.attrs['data-hour'] === 'midday')?.onclick?.(); const l1 = litOf(), h1 = hrefs(), go = host.all(e => e.cls.has('mgo'))[0]?.attrs.href ?? '', note = host.all(e => e.cls.has('mhour'))[0]?.all(e => e.cls.has('dn'))[0]?.textContent ?? '';
      const foot = host.all(e => e.cls.has('mfoot'))[0]?.textContent ?? '';
      F.verdict(btns().length === 5 && l0 === 'night' && h0.every(h => !/hour=/.test(h)) && JSON.stringify(seq) === JSON.stringify(['dawn', 'midday', 'overcast', 'dusk', 'night']) && backOne === 'dusk' && l1 === 'midday' && h1.every(h => /[?&]hour=midday$/.test(h)) && go === S.hrefOf(S.selected) && /hour=midday/.test(go) && /levelFile=compound\.json/.test(go) && /12:30/.test(note) && /H hour/.test(foot),
        'the sheet opens on the night with no hour on any link; H walks dawn → midday → overcast → dusk → night (Shift+H back); a click on Midday lights it, says its clock, and puts hour=midday on every row\'s link and the start button\'s', `lit ${l0} → ${l1} · H: ${seq.join(' ')} · ${go} · “${note.slice(0, 60)}…”`);
      M.closeMissions(); const S2 = M.openMissions({ root: host as any, search: '?levelFile=compound.json&roomclear&squad4&hour=dusk&mute' });
      F.verdict(S2.hourNow === 'dusk' && S2.selected.id === 'compound-four' && /hour=dusk/.test(S2.hrefOf(S2.selected)) && (S2.hrefOf(S2.selected).match(/hour=/g) ?? []).length === 1, 'opened over a page already at an hour (a quit back to the list): the row opens on that hour and the links carry it once', `${S2.hourNow} · ${S2.hrefOf(S2.selected)}`);
    } finally { M.closeMissions(); }
  });
  return F.done();
}
