// THE WEATHER OVER THE HOUR (src/game/hours.ts underWeather; weather.ts Weather.setKind → hourWeatherChanged): a level started at another hour AND in a picked
// weather — `probes.ts hourwx`.
//   hourwx-cloud      the weather's cloud over the hour's light: every kind at midday on the compound — sun and sky at cloudLight(hour, cloud) of the hour's own
//                     (all the light on open ground at cloudSun, the sky's share of it at cloudShare), the disc and the colours by cloudSoft; the meter's stand-in
//                     in the open falls with the cloud and reads the very lights the picture draws; a room nobody's sun reaches reads as at midday; the grey
//                     day (an hour with its own cloud) moves only under more cloud than its own; a strength set by hand stands, and can be handed back
//   hourwx-storm      who runs the rain: a picked weather at every hour; no weather picked = the hour holds the level's own storm off, and the night gets it back;
//                     a kind put in and taken away under a running hour; a kind at night leaves the moon, the sky and the lamps as the level has them
//   hourwx-save       a checkpoint made at an hour under a weather carries both and whose number the sun's strength is (the cloud's, or a hand's)
//   hourwx-query      'hour=…&weather=…' on the query a scenario is started from, in either order, is the run a boot at that hour in that weather plays
//   hourwx-air        the two things the joined build changed under a picked weather: a stroke of lightning is in the meter's stand-in (open sky, not under a
//                     roof; never with no weather picked), and a loud sound is placed off the dry path while a small one is still drowned
//   hourwx-sheet      the mission sheet: the Hour row and the Weather row together — both keys on every link, each once, either taken off alone
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
import { withDom, El } from './scenario-picker-probes.ts';

const HR = await import(`${ROOT}/src/game/hours.ts`);
const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { SCENARIOS, pickSearch } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
const { HOUR, HOURS, applyHour, hourOf, hourSun, hourLightAt, sunStrength, sunGiven, setSunStrength, sunToCloud, cloudSun, cloudSoft, cloudLight } = HR;
const { WEATHER_BOOT, WEATHER_KINDS, WEATHER_PRESETS } = WK;

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const quiet = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const entryOf = (id: string) => SCENARIOS.find((e: any) => e.id === id);
const levelOf = (file: string) => loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
/** a game stood up at an hour, in a weather (null = none picked), as the page's ?hour= / ?weather= (and ?sun=) stand it — the visit's module state put back after */
async function stand(id: string | null, hour: string, kind: string | null, sun: number | null = null, seed = 7): Promise<any> {
  Math.random = seeded(seed); const keep = { ...HOUR };
  HOUR.id = hour; HOUR.sun = sun ?? 1; HOUR.sunGiven = sun !== null; HOUR.dry = true; WEATHER_BOOT.kind = kind;
  try { return await quiet(() => standUp(id ? { level: levelOf(entryOf(id).level) } : {})); } finally { Object.assign(HOUR, keep); WEATHER_BOOT.kind = null; }
}
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const near = (a: number, b: number, e = 1e-9) => Math.abs(a - b) <= e;
/** the hour's light on a level face of open ground, by the hour's own arithmetic: its sun's RtLight and the live sky on the stand-in's dome (hours.ts skyShare's sum) */
function upOf(g: any): number {
  const S = g.engine.settings, sun = hourSun(g), zen = lum(S.skyZenith), hor = lum(S.skyHorizon), s = (d: number) => Math.sin(d * Math.PI / 180);
  const dome = 2 * Math.PI * ((zen) * (1 - s(70)) * 1 + (zen) * (s(70) - s(32)) * s(50) + (hor + (zen - hor) * Math.min(1, s(16) * 2.5)) * s(32) * s(16));
  return lum(sun.color) * sun.intensity * -sun.dir[1] + dome;
}
function rigOf(g: any): string {
  const S = g.engine.settings;
  return JSON.stringify({ lights: g.engine.lights.lights.filter((l: any) => !l.transient && l.ttl < 0).map((l: any) => [l.name, l.group, l.kind, l.enabled, l.intensity, l.color, l.dir, l.radius, l.volumetric]), on: g.targets.map((t: any) => [t.name, t.on, t.broken]), sky: [S.skyZenith, S.skyHorizon], haze: S.hazeDensity, exposure: S.exposure });
}

export async function hourwxCloud(): Promise<boolean> {
  const F = family('hourwx-cloud: a picked weather\'s cloud dims the hour\'s sun — one number for the picture and the meter\'s stand-in');
  const D = HOURS.midday, rows: string[] = []; let ok = true, okSky = true, okSoft = true, okSum = true;
  // the place the stand-in reads brightest at a clear midday (open ground in full sun) and one it reads darkest (a room the day does not reach)
  const W0 = await stand('compound-four', 'midday', null), g0 = W0.game, P: number[][] = [];
  for (let x = 1; x < 40; x += 2) for (let z = 1; z < 28; z += 2) P.push([x + 0.13, 1.2, z + 0.21]);
  const E0 = P.map(p => lightEstimateAt(g0, p)), H0 = P.map(p => hourLightAt(g0, p)), top = H0.indexOf(Math.max(...H0)), low = E0.indexOf(Math.min(...E0));   // (top: where the HOUR's light is strongest — full sun, no lamp's help)
  const S0 = g0.engine.settings, sky0 = [lum(S0.skyZenith), lum(S0.skyHorizon)];
  const open: Record<string, number> = { none: E0[top] }, room: Record<string, number> = { none: E0[low] }, up0 = upOf(g0);
  for (const k of WEATHER_KINDS) {
    const W = await stand('compound-four', 'midday', k), g = W.game, sun = hourSun(g), c = WEATHER_PRESETS[k].cloud, [want, skyK] = cloudLight(D, c), soft = cloudSoft(c), S = g.engine.settings;
    const I = sun.intensity, r = sun.radius, wantR = D.sun.radius + (0.25 - D.sun.radius) * soft;
    open[k] = lightEstimateAt(g, P[top]); room[k] = lightEstimateAt(g, P[low]);
    if (!(g.weather.kind === k && near(sunStrength(g), want) && near(I, D.sun.intensity * want) && !sunGiven(g))) ok = false;
    if (!(near(lum(S.skyZenith), sky0[0] * skyK, 1e-6) && near(lum(S.skyHorizon), sky0[1] * skyK, 1e-6) && near(lum(sun.color), lum(D.sun.color), 1e-6))) okSky = false;
    const up = upOf(g); if (!near(up / up0, cloudSun(c), 1e-6)) okSum = false;
    if (!(near(r, wantR, 1e-9) && near(sun.volumetric, D.sun.volumetric * (1 - soft), 1e-9) && (soft > 0 || skyK !== 1) === (JSON.stringify(S.skyZenith) !== JSON.stringify(D.sky.zenith)))) okSoft = false;
    rows.push(`${k} (cloud ${c}): sun ×${sunStrength(g).toFixed(3)} = ${I.toFixed(2)}, sky ×${skyK.toFixed(2)}, level ground ${(up / up0).toFixed(3)} of clear, disc ${r.toFixed(3)} rad, open ground reads ${open[k].toFixed(2)}, the dark room ${room[k].toFixed(3)}`);
  }
  F.verdict(ok && near(sunStrength(g0), 1) && hourSun(g0).intensity === D.sun.intensity, 'at midday in each weather the sun stands at cloudLight\'s share of the hour\'s own (nothing of it under a solid deck); with no weather picked it is the hour\'s own, untouched', `no weather: ×1 = ${D.sun.intensity} · ` + rows.join(' · '));
  F.verdict(okSky && okSoft && okSum, 'the sky takes the share the sun gives up: its luminance at cloudLight\'s factor, and sun + sky on level open ground exactly 1 − 0.75·cloud^3.4 of the clear hour\'s (Kasten & Czeplak); past half cover the disc spreads, the shafts leave the dust and the colour drains — at the luminance the model gives', `clear-hour sky luminance zenith ${sky0[0].toFixed(3)} horizon ${sky0[1].toFixed(3)} × the factor in every weather: ${okSky ? 'yes' : 'NO'} · level ground = cloudSun: ${okSum ? 'yes' : 'NO'} · disc, shafts and greying by cloudSoft: ${okSoft ? 'yes' : 'NO'}`);
  const order = ['clear', 'dust', 'fog', 'overcast', 'rain', 'downpour'];
  const falls = order.every((k, i) => i === 0 || open[k] <= open[order[i - 1]] + 1e-9) && open.clear <= open.none + 1e-9 && open.downpour < 0.5 * open.none && open.downpour > 0.1 * open.none;
  const roomSame = order.every(k => near(room[k], room.none, 1e-9));
  F.verdict(falls && roomSame, 'the meter\'s stand-in follows: open ground reads less under each heavier cloud (under a downpour less than half a clear midday, and more than a tenth: the sky is still up there), and a room the day does not reach reads exactly as it did', `open ground: none ${open.none.toFixed(2)} → ${order.map(k => `${k} ${open[k].toFixed(2)}`).join(' → ')} · the room ${room.none.toFixed(3)} throughout`);
  { // an hour that is itself a weather: the grey day's numbers already hold a deck (HourDef.cloud) — a picked weather moves them only past it
    const G = HOURS.overcast, base = await stand('compound-four', 'overcast', null), sky = lum(base.game.engine.settings.skyZenith), rows: string[] = []; let same = true, less = true;
    for (const k of WEATHER_KINDS) { const W = await stand('compound-four', 'overcast', k), g = W.game, c = WEATHER_PRESETS[k].cloud, kS = sunStrength(g), kK = lum(g.engine.settings.skyZenith) / sky;
      if (c <= G.cloud) { if (!(kS === 1 && near(kK, 1, 1e-9) && hourSun(g).radius === G.sun.radius)) same = false; } else if (!(kS < 1 && kK < 1 && near(upOf(g) / upOf(base.game), cloudSun(c) / cloudSun(G.cloud), 1e-6))) less = false;
      rows.push(`${k} sun ×${kS.toFixed(2)} sky ×${kK.toFixed(2)}`); }
    F.verdict(same && less && G.cloud === 0.9, 'the grey day under a clear, dusty, foggy or overcast pick is the grey day (its own deck is the heavier); rain and a downpour darken its sun and its sky, level open ground by exactly the two covers\' ratio', rows.join(' · ')); }
  { // a strength set by hand (?sun=) stands against the cloud; the slider after a cloud-set sun makes it the hand's
    const W = await stand('compound-four', 'midday', 'rain', 0.8), g = W.game, a = sunStrength(g), ga = sunGiven(g);
    const W2 = await stand('compound-four', 'dusk', 'rain'), g2 = W2.game, b = sunStrength(g2); setSunStrength(g2, 0.9); applyHour(g2, 'midday'); const c2 = sunStrength(g2), gv2 = sunGiven(g2), sky2 = lum(g2.engine.settings.skyZenith); sunToCloud(g2); const e2 = sunStrength(g2);
    const W3 = await stand('compound-four', 'dusk', 'rain'), g3 = W3.game; applyHour(g3, 'dawn'); const d3 = sunStrength(g3), I3 = hourSun(g3).intensity;
    const mid = cloudLight(HOURS.midday, 0.95), dawn = cloudLight(HOURS.dawn, 0.95)[0];
    F.verdict(a === 0.8 && ga && near(b, cloudLight(HOURS.dusk, 0.95)[0]) && c2 === 0.9 && gv2 && near(sky2, lum(HOURS.midday.sky.zenith) * mid[1], 1e-6) && near(e2, mid[0]) && !sunGiven(g2) && near(d3, dawn) && near(I3, HOURS.dawn.sun.intensity * dawn) && !sunGiven(g3),
      '?sun= beside a weather is the sun\'s strength whatever the cloud; a slider set under the cloud stays through a change of hour (the sky still the cloud\'s) until it is handed back; left alone, the next hour\'s sun is under the same cloud', `?sun=0.8 in rain: ×${a} · dusk in rain ×${b.toFixed(3)}, set to 0.9, → midday ×${c2}, handed back ×${e2.toFixed(3)} · dusk in rain → dawn ×${d3.toFixed(3)}`); }
  return F.done();
}

export async function hourwxStorm(): Promise<boolean> {
  const F = family('hourwx-storm: a picked weather runs at every hour; with none picked an hour holds the level\'s own storm off');
  { const rows: string[] = []; let ok = true;
    for (const [h, k] of [['midday', 'rain'], ['dawn', 'fog'], ['dusk', 'dust'], ['overcast', 'downpour']] as const) {
      const W = await stand('compound-four', h, k), g = W.game; for (let i = 0; i < 30; i++) W.step(1 / 60);
      const P = WEATHER_PRESETS[k], fr = g.engine.weather, good = g.weather.enabled && g.weather.kind === k && g.weather.rainRate === P.rain && (fr.rain > 0) === (P.rain > 0) && !!g.weather.fog === !!P.fog && (fr.fog !== 0) === !!P.fog && hourOf(g) === h;
      if (!good) ok = false; rows.push(`${h} + ${k}: weather ${g.weather.enabled ? 'on' : 'OFF'}, rain drawn ${fr.rain.toFixed(2)}, fog ${fr.fog ? 'in the frame' : 'none'}`);
    }
    F.verdict(ok, 'rain at midday rains, fog at dawn stands, dust at dusk blows, a downpour on a grey day pours: the picked weather is on and in the frame the renderer draws, thirty frames in', rows.join(' · ')); }
  { // the veil's glow: the frame's fog word carries the gain × (daylight left ∕ the sky's factor) by day, the packed gain at night; what the eyes read never moves
    const gain = (w: number) => (w >>> 28) * 0.25, rows: string[] = []; let ok = true;
    for (const [h, k, want] of [['night', 'fog', 1], ['midday', 'fog', 0.5], ['dawn', 'fog', 0.75], ['overcast', 'fog', 1], ['midday', 'downpour', 0.25], ['dusk', 'dust', 1]] as const) {
      const W = await stand('compound-four', h, k), g = W.game; for (let i = 0; i < 3; i++) W.step(1 / 60);
      const got = gain(g.engine.weather.fog ?? 0), sim = g.weather.fog?.gain;
      if (got !== want || sim !== WEATHER_PRESETS[k].fog!.gain) ok = false; rows.push(`${h} + ${k}: glow ${got} (the eyes' fog record ${sim})`);
    }
    const W = await stand('compound-four', 'midday', 'fog'), g = W.game; W.step(1 / 60); applyHour(g, 'night'); W.step(1 / 60); const back = gain(g.engine.weather.fog ?? 0);
    F.verdict(ok && back === 1, 'the fog\'s veil glows with the daylight left, not with the sky the cloud brightened: half the packed glow at midday, three quarters at dawn, as packed at night, on a grey day and back at night after an hour', rows.join(' · ') + ` · midday → night ${back}`); }
  { // the ground a picked rain wets: on every start-card level the slabs it darkens are the lot and ground with open sky over some of it (asked of the level's
    // collision, not of the rule's own roofs), the compound's yard and the barracks' courtyard among them; the level's own storm wets the lot alone, as it did
    const rows: string[] = []; let ok = true, yards = 0, compoundWet = 1;
    const big = (b: any) => b.h[0] > 18 && b.h[2] > 12;
    const sky = (g: any, b: any) => { for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const x = b.c[0] + b.h[0] * i * 0.24, z = b.c[2] + b.h[2] * j * 0.24; if (!g.col.solidBlocked([x, 0.3, z], [x, 9, z])) return true; } return false; };
    for (const e of SCENARIOS as any[]) {
      const W = await stand(e.level ? e.id : null, 'night', 'rain'), g = W.game; for (let i = 0; i < 5; i++) W.step(1 / 60);
      const T = (g.weather as any).touched as any[], wet = T.map(t => t.box), other = wet.filter(b => !big(b));
      const own = WK.snowLevel(String(e.level ?? '').replace(/\.json$/, '')) && g.weather.kind === 'snow';   // (a level built for snow keeps its own weather — game/weatherKinds.ts SNOW_LEVELS, the switch on: the picked rain never falls there, so nothing is wet)
      const good = own ? wet.length === 0 : wet.length >= 1 && wet.every(b => (b.flags & 128) !== 0) && other.every(b => sky(g, b));
      if (!good) ok = false; yards += other.length; if (e.id === 'compound-four') compoundWet = wet.length;
      rows.push(`${e.id}: ${wet.length} wet${own ? ' (its own weather, snow: the pick refused)' : ''}${other.length ? ` (${other.map(b => `${(4 * b.h[0] * b.h[2]).toFixed(0)} m²`).join(', ')} beside the lot)` : ''}${good ? '' : ' — NOT ALL UNDER OPEN SKY'}`);
    }
    const base = (g: any) => g.engine.world.statics.find((b: any) => Math.abs(b.h[0] - 16) < 0.01 && Math.abs(b.h[2] - 10) < 0.01 && b.c[1] + b.h[1] < 0.003);
    const A = await stand('compound-four', 'night', null), ga = A.game; for (let i = 0; i < 5; i++) A.step(1 / 60); const dry = [...base(ga).albedo], own = ((ga.weather as any).touched as any[]).length;
    const B = await stand('compound-four', 'midday', 'rain'), gb = B.game; for (let i = 0; i < 5; i++) B.step(1 / 60); const wetA = [...base(gb).albedo], wetK = base(gb).wetK;
    gb.weather.setKind(null); for (let i = 0; i < 5; i++) B.step(1 / 60); const back = [...base(gb).albedo], backK = base(gb).wetK;
    F.verdict(ok && yards >= 2 && own <= (WK.WX_OWN.roofs ? compoundWet : 1) && wetK === 0.5 && String(wetA) === String(dry) && backK === undefined && String(back) === String(dry), 'a picked rain wets the open ground of whatever level it falls on, and only ground with sky over it — darker for the renderer alone (Box.wetK), the albedo a round\'s material is read from untouched; the level\'s own storm wets the lot alone (under the level\'s own roofs — WX_OWN.roofs, the shipped stand — no more ground than the picked rain does); the pick taken away, the yard is as authored', rows.join(' · ') + ` · compound, its own storm: ${own} wet, yard albedo ${dry.map(x => x.toFixed(2))} → rain at midday ${wetA.map(x => x.toFixed(2))} × ${wetK} to the renderer → pick taken away ${back.map(x => x.toFixed(2))} × ${backK ?? 1}`); }
  { const W = await stand('compound-four', 'night', null), g = W.game, rigN = rigOf(g), onN = g.weather.enabled;
    const snapN = JSON.stringify(g.weather.snapshot());
    applyHour(g, 'midday'); const heldA = !g.weather.enabled;
    g.weather.setKind('rain'); const onB = g.weather.enabled, kB = sunStrength(g);
    g.weather.setKind(null); const heldC = !g.weather.enabled, kC = sunStrength(g), skyC = JSON.stringify(g.engine.settings.skyZenith) === JSON.stringify(HOURS.midday.sky.zenith), rC = hourSun(g).radius;
    applyHour(g, 'night'); const back = g.weather.enabled, rigBack = rigOf(g) === rigN, storm = g.weather.storm, snapBack = JSON.stringify(g.weather.snapshot()) === snapN;
    F.verdict(onN && heldA && onB && near(kB, cloudLight(HOURS.midday, 0.95)[0]) && heldC && kC === 1 && skyC && rC === HOURS.midday.sun.radius && back && rigBack && storm === 0.7 && snapBack,
      'no weather picked: midday holds the level\'s storm off; rain picked under it runs and dims the sun; taken away again the storm is held once more and the sun, its disc and the sky are the hour\'s own; the night gets its storm (its dice and the stroke it had due) and its whole light rig back as found', `night storm ${onN ? 'on' : 'off'} → midday ${heldA ? 'held' : 'ON'} → rain ${onB ? 'on' : 'OFF'} ×${kB.toFixed(3)} → none ${heldC ? 'held' : 'ON'} ×${kC} → night ${back ? 'on' : 'OFF'}, rig ${rigBack ? 'identical' : 'CHANGED'}`); }
  { // the level's storm switched OFF before the hour came (the panel): a weather picked and taken away under the hour leaves it off, and so does the night
    const W = await stand('compound-four', 'night', null), g = W.game; g.weather.setEnabled(false);
    applyHour(g, 'dusk'); g.weather.setKind('rain'); const on = g.weather.enabled; g.weather.setKind(null); const off = !g.weather.enabled; applyHour(g, 'dawn'); g.weather.setKind('fog'); g.weather.setKind(null); const off2 = !g.weather.enabled; applyHour(g, 'night');
    F.verdict(on && off && off2 && !g.weather.enabled, 'a storm that was off when the hour came stays off: rain picked under the hour runs, taken away the level\'s own storm is not switched on in its place — through a change of hour too — and the night does not bring back what it never had', `rain ${on ? 'on' : 'OFF'} → none ${off ? 'off' : 'ON'} → dawn, fog, none ${off2 ? 'off' : 'ON'} → night ${g.weather.enabled ? 'ON' : 'off'}`); }
  { // a kind at night: nothing of the level's light is the cloud's
    const A = await stand('compound-four', 'night', null), B = await stand('compound-four', 'night', 'overcast'), C = await stand('compound-four', 'night', 'downpour');
    const same = rigOf(A.game) === rigOf(B.game) && rigOf(A.game) === rigOf(C.game);
    applyHour(C.game, 'dusk'); applyHour(C.game, 'night'); const round = rigOf(C.game) === rigOf(A.game) && C.game.weather.kind === 'downpour' && C.game.weather.enabled;
    F.verdict(same && round, 'at night a picked weather leaves the moon, the lamps, the sky and the exposure as the level has them (the cloud dims a sun, never the moon); an hour laid over a downpour and taken off leaves that night exactly, the downpour still on', `steady lights, switches, sky, haze, exposure: none = overcast = downpour ${same ? 'yes' : 'NO'} · after dusk and back: ${round ? 'identical' : 'CHANGED'}`); }
  return F.done();
}

export async function hourwxSave(): Promise<boolean> {
  const F = family('hourwx-save: a checkpoint carries the hour, the weather, and whose number the sun\'s strength is');
  // the office: checkpoints are the solo night's (a squad staged on the floor refuses a save)
  const W = await stand(null, 'dusk', 'rain', null, 5), g = W.game; for (let i = 0; i < 20; i++) W.step(1 / 60);
  const kRain = cloudLight(HOURS.dusk, 0.95)[0], a = W.snapshot('dusk rain'); setSunStrength(g, 0.6); const b = W.snapshot('dusk rain by hand');
  const W2 = await stand(null, 'night', null, null, 5), g2 = W2.game; await quiet(() => W2.restore(JSON.parse(JSON.stringify(a))));
  const got = { hour: hourOf(g2), kind: g2.weather.kind, k: sunStrength(g2), given: sunGiven(g2), I: hourSun(g2)?.intensity, on: g2.weather.enabled };
  g2.weather.setKind('fog'); const moved = sunStrength(g2);   // (left to the cloud: another weather moves it)
  const W3 = await stand(null, 'night', null, null, 5), g3 = W3.game; await quiet(() => W3.restore(JSON.parse(JSON.stringify(b))));
  const got3 = { k: sunStrength(g3), given: sunGiven(g3) }; g3.weather.setKind('fog'); const held = sunStrength(g3);
  F.verdict(a.hour?.id === 'dusk' && a.hour?.given === false && near(a.hour?.sun, kRain) && a.weather?.kind === 'rain' && got.hour === 'dusk' && got.kind === 'rain' && near(got.k, kRain) && !got.given && near(got.I, HOURS.dusk.sun.intensity * kRain) && got.on && near(moved, cloudLight(HOURS.dusk, 0.7)[0])
    && b.hour?.given === true && b.hour?.sun === 0.6 && got3.k === 0.6 && got3.given && held === 0.6,
    'saved at dusk in rain and loaded into a fresh night: dusk, rain running, the sun under the rain\'s cloud and still the cloud\'s to move; saved with the strength set by hand: that number, and it stays under another weather', `file ${JSON.stringify(a.hour)} + weather ${a.weather?.kind} → ${got.hour} in ${got.kind} ×${got.k.toFixed(3)} (${got.given ? 'set' : 'cloud'}) → fog ×${moved.toFixed(3)} · file ${JSON.stringify(b.hour)} → ×${got3.k} (${got3.given ? 'set' : 'cloud'}) → fog ×${held}`);
  return F.done();
}

export async function hourwxQuery(): Promise<boolean> {
  const F = family('hourwx-query: hour= and weather= on the query a scenario is started from');
  const e = entryOf('compound-four');
  const runOf = async (hour: string, kind: string | null, query: string) => { const W = await stand('compound-four', hour, kind, null, 31); await quiet(() => startFromQuery(W.game, new URLSearchParams(pickSearch(e, '') + query))); for (let i = 0; i < 60 * 8; i++) W.step(1 / 60);
    const w = W.game.weather, S = W.game.engine.settings;
    return { hour: hourOf(W.game), kind: w.kind, sun: sunStrength(W.game), d: hashDigest(digestGame(W.game, true)), air: JSON.stringify([w.kind, w.enabled, w.storm, w.rainRate, w.wind, w.fog, w.roofs, S.skyZenith, S.skyHorizon, hourSun(W.game)?.intensity ?? null]) }; };
  const boot = await runOf('midday', 'fog', ''), q1 = await runOf('night', null, '&hour=midday&weather=fog'), q2 = await runOf('night', null, '&weather=fog&hour=midday'), hourOnly = await runOf('midday', null, ''), wxOnly = await runOf('night', 'fog', ''), night = await runOf('night', null, '');
  const q3 = await runOf('night', null, '&hour=dusk&weather=rain&sun=0.5'), kFog = cloudLight(HOURS.midday, 0.7)[0];
  F.verdict(boot.hour === 'midday' && boot.kind === 'fog' && boot.d === q1.d && boot.d === q2.d && boot.air === q1.air && boot.air === q2.air && boot.air !== hourOnly.air && boot.air !== wxOnly.air && near(q1.sun, kFog) && q1.kind === 'fog' && q2.kind === 'fog' && q1.hour === 'midday' && near(q2.sun, kFog) && hourOnly.sun === 1 && wxOnly.hour === 'night' && boot.d !== night.d && q3.hour === 'dusk' && q3.kind === 'rain' && q3.sun === 0.5,
    'eight seeded seconds of the compound at midday in fog digest the same booted that way or handed \'hour=midday&weather=fog\' in either order, with the same air (the weather\'s kind, rain, wind, fog and roofs) and the same sun and sky each way — not the plain night\'s run, not midday\'s air alone nor the fog\'s alone; sun= beside them is the strength', `boot ${boot.d} ×${boot.sun.toFixed(3)} · query ${q1.d} · other order ${q2.d} · midday alone ${hourOnly.d} ×${hourOnly.sun} · fog alone ${wxOnly.d} · night ${night.d} · dusk + rain + sun=0.5: ×${q3.sun}`);
  return F.done();
}

export async function hourwxAir(): Promise<boolean> {
  const F = family('hourwx-air: lightning in the meter\'s stand-in and loud sounds on the dry path — under a picked weather only');
  const WX = await import(`${ROOT}/src/game/weather.ts`);
  const P: number[][] = []; for (let x = 1; x < 40; x += 2) for (let z = 1; z < 28; z += 2) P.push([x + 0.13, 1.2, z + 0.21]);
  const stroke = { bearing: 0.6, elevDeg: 55, distKm: 0.5, peak: 18 };
  const lit = (g: any) => { const w = g.weather, E0 = P.map(p => lightEstimateAt(g, p)), S0 = P.map(p => lightEstimateAt(g, p, undefined, true)); const f = w.strike(stroke);
    const E1 = P.map(p => lightEstimateAt(g, p)), S1 = P.map(p => lightEstimateAt(g, p, undefined, true)); let open = 0, openLit = 0, roof = 0, roofLit = 0;
    P.forEach((p, i) => { const up = E1[i] > E0[i] + 1; if (w.underRoof(p[0], p[2])) { roof++; if (up) roofLit++; } else { open++; if (up) openLit++; } });
    return { fired: !!f, open, openLit, roof, roofLit, any: E1.some((e, i) => e !== E0[i]), steady: S1.every((e, i) => e === S0[i]) }; };
  { const A = lit((await stand('compound-four', 'night', 'downpour')).game), B = lit((await stand('compound-four', 'midday', 'rain')).game), N = lit((await stand('compound-four', 'night', null)).game);
    F.verdict(A.fired && A.openLit >= 0.5 * A.open && A.roofLit <= 0.1 * A.roof && A.steady && B.fired && B.openLit >= 0.5 * B.open && N.fired && !N.any,
      'a stroke fired over the compound in a downpour: the stand-in reads it under open sky (most points out of a wall\'s shadow jump by more than 1) and not under a roof, and what the PLACE lights (the steady reading) does not move; at midday in rain too; with no weather picked the level\'s own storm stays out of the stand-in, as on the base',
      `night downpour: ${A.openLit} of ${A.open} open points lit, ${A.roofLit} of ${A.roof} roofed · midday rain: ${B.openLit} of ${B.open}, ${B.roofLit} of ${B.roof} · no weather picked: ${N.any ? 'MOVED' : 'nothing moved'}`); }
  { const W = await stand('compound-four', 'night', 'rain'), g = W.game, w = g.weather, out = P.find(p => !w.underRoof(p[0], p[2]))!, src = [out[0] + 6, 1, out[2]];
    const k = w.hearMask(out), raw = g.col.sound.propagate(src, out).pathLen, heard = WX.hearPath(g, src, out).pathLen, loud = WX.loudLen(g, heard, out);
    WX.WX_SIM.loudDry = false; const asWas = WX.loudLen(g, heard, out); WX.WX_SIM.loudDry = true;
    const g0 = (await stand('compound-four', 'night', null)).game, none = WX.loudLen(g0, 17.25, out), dry = (await stand('compound-four', 'night', 'fog')).game, fog = WX.loudLen(dry, 17.25, out);
    F.verdict(k > 1.5 && near(heard, raw * k, 1e-9) && near(loud, raw, 1e-9) && asWas === heard && none === 17.25 && fog === 17.25,
      'in rain a small sound\'s path is stretched by the noise at the ear (it carries less far) and a loud one is placed off the path as it is in the air; the switch back gives the first cut\'s; with no weather picked, or a dry one, the length is the very number handed in',
      `rain outdoors: mask ×${k.toFixed(2)} · a 6 m path heard as ${heard.toFixed(2)} m, a shot placed off ${loud.toFixed(2)} m (first cut: ${asWas.toFixed(2)}) · none ${none} · fog ${fog}`); }
  return F.done();
}

export async function hourwxSheet(): Promise<boolean> {
  const F = family('hourwx-sheet: the mission sheet\'s Hour row and Weather row together');
  await withDom('?quality=high&mute', async () => {
    const M = await import(`${ROOT}/src/ui/missions.ts`); const host = new El('DIV'); const S = M.openMissions({ root: host as any, search: '?quality=high&mute&hourwx' });
    try {
      const ownWx = (h: string) => WK.snowLevelOfQuery(new URLSearchParams(h.slice(h.indexOf('?') + 1)));   // (a level built for snow keeps its own weather: its row's link never carries the Weather row's pick — game/weatherKinds.ts SNOW_LEVELS)
      const hrefs = () => host.all(e => e.cls.has('mrow')).map(e => e.attrs.href ?? ''), once = (h: string, k: string) => (h.match(new RegExp(`[?&]${k}=`, 'g')) ?? []).length === 1;
      const rowsOf = () => host.all(e => e.cls.has('mdiff') && !(e.cls.has('mway') && e.cls.has('na')) && e.style.display !== 'none').map(e => e.cls.has('mhour') ? 'hour' : e.cls.has('mwx') ? 'weather' : e.cls.has('mway') ? 'way' : e.cls.has('mlever') ? 'lever' : 'defenders').join(',');   // (the Way in row is the room clear's: shown only where the mission names more than one way in; the three lever rows — fog of war, enemy AI, enemy kit, ui/levers.ts — sit right under the defenders' switch; a row the sheet is not showing — the sticky cameras' lever off a quiet mission, ui/levers.ts — is not a row under the plan)
      S.select('compound-four'); const h0 = hrefs();
      S.hour('midday'); S.setWeather('rain'); const h1 = hrefs(), go1 = host.all(e => e.cls.has('mgo'))[0]?.attrs.href ?? '', sel1 = S.hrefOf(S.selected);
      S.hour('night'); const h2 = hrefs();
      S.hour('dawn'); S.setWeather(null); const h3 = hrefs();
      const rowsTwo = rowsOf(); S.select('rescue-registry'); const rowsOne = rowsOf(); S.select('compound-four');
      F.verdict(rowsTwo === 'defenders,lever,lever,lever,hour,weather,way' && rowsOne === 'defenders,lever,lever,lever,hour,weather' && h0.every(h => !/hour=|weather=/.test(h)) && h1.every(h => once(h, 'hour') && /hour=midday/.test(h) && (ownWx(h) ? !/weather=/.test(h) : once(h, 'weather') && /weather=rain/.test(h))) && go1 === sel1 && /levelFile=compound\.json/.test(go1)
        && h2.every(h => !/hour=/.test(h) && (ownWx(h) ? !/weather=/.test(h) : /weather=rain/.test(h))) && h3.every(h => /hour=dawn/.test(h) && !/weather=/.test(h)),
        'three rows under the plan (defenders with its three levers under it, hour, weather), and a fourth, the way in, only on a mission with more than one; nothing picked = no key on any link; Midday and Rain picked = both keys, once each, on every row\'s link and the start button\'s; either taken off alone leaves the other', `compound: ${rowsTwo} · registry: ${rowsOne} · ${go1} · night + rain: ${h2[0]} · dawn alone: ${h3[0]}`);
      { const again = () => { M.closeMissions(); return M.openMissions({ root: host as any, search: '?quality=high&mute&hourwx' }); };
        S.setWeather(null); const seq: string[] = []; for (let i = 0; i < 7; i++) { M.missionsKey({ code: 'KeyJ' }); seq.push(S.weather ?? 'as it is'); } M.missionsKey({ code: 'KeyJ', shiftKey: true } as any); const backOne = S.weather;
        const keys = seq.join(' ') === 'clear overcast rain downpour fog dust as it is' && backOne === 'dust';
        S.hour('dusk'); S.setWeather('dust'); const R = again(), kept = R.hourNow === 'dusk' && R.weather === 'dust'; R.hour('night'); R.setWeather(null); const R2 = again();
        const n = { dayRain: M.weatherNote('rain', 'midday'), dayNone: M.weatherNote(null, 'midday'), nightRain: M.weatherNote('rain', 'night'), greyFog: M.weatherNote('fog', 'overcast'), nightIn: M.hourNote('night', 'rain'), night: M.hourNote('night', null) };
        F.verdict(keys && kept && R2.hourNow === 'night' && R2.weather === null && /by day/.test(n.dayRain) && /^no weather picked/.test(n.dayNone) && n.nightRain === WK.weatherWords('rain') && !/by day/.test(n.greyFog) && !/storm/.test(n.nightIn) && /storm/.test(n.night),
          'J walks the weathers as H walks the hours (Shift+J back); the list closed and opened again on the same page remembers both picks alike; the two lines of words follow the pair (a weather by day says what its cloud does to the sun, no weather by day says the day is dry, a weather at night does not promise the level\'s storm)', `J ×7: ${seq.join(' → ')}, Shift+J: ${backOne} · reopened at dusk in dust: ${kept ? 'yes' : 'NO'} · "${n.dayRain}" · "${n.dayNone}" · "${n.nightIn}"`); }
      M.closeMissions(); const S2 = M.openMissions({ root: host as any, search: '?levelFile=compound.json&roomclear&squad4&hour=dusk&weather=fog&mute' });
      const href = S2.hrefOf(S2.selected);
      F.verdict(S2.hourNow === 'dusk' && S2.weather === 'fog' && once(href, 'hour') && once(href, 'weather'), 'opened over a page already at an hour in a weather (a quit back to the list): both rows open on them and the links carry each once', `${S2.hourNow} · ${S2.weather} · ${href}`);
    } finally { M.closeMissions(); }
  });
  return F.done();
}
