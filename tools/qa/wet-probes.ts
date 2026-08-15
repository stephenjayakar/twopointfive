// The 'wet' family (game/wet.ts — the weather's other half: whoever stands in the rain soaks), run through probes.ts:
//   bun run tools/qa/probes.ts wet | wet-soak | wet-roof | wet-off | wet-reset | wet-cast | wet-prints | wet-shading   [--verbose]
// PASS / FAIL each, all headless (the CPU model is the model; what the renderer makes of the numbers is judged in the browser):
//   wet-soak      Sam under the open sky at rain rate 1 soaks 0 → 1 in ~6 s (WET.soakPerSec × (0.4 + 0.6 × rate)) with his beads up before him; walked
//                 back inside the coat dries at WET.dryPerSec (about 25 s to nothing) and the beads are gone in WET.beadRunoffSecs; a lighter rain soaks slower;
//                 the interior footprint is respected to the metre (a man a step inside the facade stays dry, a step outside it soaks)
//   wet-roof      a roof over his head keeps him dry outdoors: under a canopy box pushed into the collision layer he stays at 0 while a man beside it soaks;
//                 the roofed stair-tower landing (weather.ts ANNEX) is dry; a street lamp's head is no umbrella (a man right under it soaks); the sky test is
//                 cached (a handful of ray fans a second per man, not one a frame)
//   wet-off       the storm switched off (= ?noweather), or held by day (the breach's daylight), or a dry storm (rate 0): a minute outdoors leaves everybody at 0
//   wet-reset     restartEncounter hands back a dry Sam and dry guards; a soaked corpse in the lot keeps soaking (a body is a Character too)
//   wet-cast      spawned units (the QRF's men, the breach's cast — spawnUnit) carry the field and soak / dry by the same rule as the shift
//   wet-prints    a soaked Sam come indoors leaves at most WET.prints footprints ('wetprint' decals), fainter each step, each retired inside WET.printFadeSecs;
//                 none while still out in the rain, none from a dry man, none with decals off; the drips need the GPU particles (none headless) — counted 0, no throw
//   wet-shading   what the renderer is handed: wetInstance writes zeros for a dry man and with the switch off, the man's numbers otherwise; game.ts's instance
//                 upload carries them (floats 8‥19 of his CharInst) only while settings.wetChars is on AND he is wet, zeros the frame after either goes
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const wet = await import(`${ROOT}/src/game/wet.ts`);
const { WET, WET_DEFAULTS, WET_STATS, WET_LINE_ALL, updateWetness, openSky, inRain, rainNow, soak, dryAll, wetPrints, wetInstance, everyCharacter, underRoofRect } = wet;
const { CHAR_INST_BYTES } = await import(`${ROOT}/src/anim/characters.ts`);
const { setDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { spawnUnit } = await import(`${ROOT}/src/game/guards.ts`);
const { makeBox } = await import(`${ROOT}/src/scene/boxes.ts`);
const { INTERIOR, ANNEX } = await import(`${ROOT}/src/game/weather.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** park everybody: nobody walks, hears or shoots — the storm and the wet model alone act; storm 0 = rain without strokes (a stroke's light is not the point here) */
function quiet(W: any, rainRate = 1) { const { game } = W; game.playerInvisible = true; game.godMode = true; for (const gd of game.guards) { gd.hold = true; gd.pinned = true; } game.weather.storm = 0; game.weather.rainRate = rainRate; Object.assign(WET, WET_DEFAULTS); }
const LOT: Vec3 = [16, 0, 26.2];          // open asphalt south of the facade, under nothing
const LOBBY: Vec3 = [7, 0, 19.5];         // indoors
async function fresh(seed = 11, rainRate = 1) { Math.random = seeded(seed); const W = await standUp(); quiet(W, rainRate); return W; }
function stepSecs(W: any, secs: number) { for (let i = 0; i < Math.round(secs / DT); i++) W.step(DT); }

// ---------------------------------------------------------------- wet-soak
export async function wetSoak() {
  const F = family('wet-soak: soaks under the sky in ~6 s, dries indoors over ~25, beads first up and first gone, the footprint to the metre (wet.ts updateWetness)');
  const W = await fresh(); const { game } = W;
  const c = game.player.char;
  game.teleportPlayer([...LOT]); W.step(DT);
  { const f: string[] = [];
    if (!(rainNow(game) > 0.99)) f.push(`rainNow ${rainNow(game)} (want 1: storm on, rate 1)`);
    if (!openSky(game, c)) f.push('openSky false in the middle of the lot');
    if (!inRain(game, c)) f.push('inRain false');
    const trace: string[] = []; let tHalf = -1, tFull = -1, beadsAtHalf = 0;
    for (let i = 1; i <= 9 / DT; i++) { W.step(DT); const t = i * DT; if (tHalf < 0 && c.wet >= 0.5) { tHalf = t; beadsAtHalf = c.beads; } if (tFull < 0 && c.wet >= 1) tFull = t; if (i % 60 === 0) trace.push(`${t.toFixed(0)}s ${f2(c.wet)}/${f2(c.beads)}`); }
    const want = 1 / (WET.soakPerSec * 1.0);   // rate 1: (0.4 + 0.6) = 1
    if (!(tFull > 0 && Math.abs(tFull - want) < 0.35)) f.push(`soaked at ${f2(tFull)} s (want ≈ ${f2(want)})`);
    if (!(beadsAtHalf > 0.9)) f.push(`beads only ${f2(beadsAtHalf)} when the coat passed 0.5 (they should be up first)`);
    if (!(c.wetRain > 0.9)) f.push(`wetRain ${f2(c.wetRain)} (want → 1)`);
    F.verdict(f.length === 0, 'in the lot at rate 1: openSky, inRain, coat 0 → 1 in 1/soakPerSec s (±0.35), beads full before the coat is half, wetRain → the rate', f.join('; ') || `soaked at ${f2(tFull)} s, half at ${f2(tHalf)} s with beads ${f2(beadsAtHalf)}; ${trace.join(' · ')}`); }
  { // indoors: dries
    game.teleportPlayer([...LOBBY]); W.step(DT);
    const f: string[] = [];
    if (openSky(game, c) || inRain(game, c)) f.push('still counted in the rain a frame after coming inside');
    let tBeads = -1, tDry = -1; const w0 = c.wet;
    for (let i = 1; i <= 40 / DT; i++) { W.step(DT); const t = i * DT; if (tBeads < 0 && c.beads <= 0) tBeads = t; if (tDry < 0 && c.wet <= 0) tDry = t; }
    if (!(tBeads > 0 && Math.abs(tBeads - WET.beadRunoffSecs) < 0.3)) f.push(`beads gone at ${f2(tBeads)} s (want ≈ ${WET.beadRunoffSecs})`);
    const wantDry = w0 / WET.dryPerSec; if (!(tDry > 0 && Math.abs(tDry - wantDry) < 0.6)) f.push(`dry at ${f2(tDry)} s (want ≈ ${f2(wantDry)})`);
    if (c.wetRain !== 0) f.push(`wetRain ${c.wetRain} once dry (want 0)`);
    F.verdict(f.length === 0, 'walked back inside: out of the rain that frame, beads gone in beadRunoffSecs, the coat at 0 after wet/dryPerSec s, wetRain cleared', f.join('; ') || `beads gone ${f2(tBeads)} s, dry ${f2(tDry)} s (from ${f2(w0)})`); }
  { // a lighter rain soaks slower: rate 0.3 → (0.4 + 0.18) = 0.58 of the downpour's pace
    const W2 = await fresh(12, 0.3); const c2 = W2.game.player.char; W2.game.teleportPlayer([...LOT]); W2.step(DT);
    let t9 = -1; for (let i = 1; i <= 14 / DT; i++) { W2.step(DT); if (t9 < 0 && c2.wet >= 0.9) t9 = i * DT; }
    const want = 0.9 / (WET.soakPerSec * (0.4 + 0.6 * 0.3));
    const f: string[] = []; if (!(t9 > 0 && Math.abs(t9 - want) < 0.5)) f.push(`0.9 at ${f2(t9)} s (want ≈ ${f2(want)})`); if (!(c2.beads > 0.5 && c2.beads < 0.6)) f.push(`beads settle at ${f2(c2.beads)} (want 0.35 + 0.65 × 0.3 = 0.545)`);
    F.verdict(f.length === 0, 'rate 0.3: the coat rises at (0.4 + 0.6 × 0.3) of the downpour\'s pace and the beads settle at 0.35 + 0.65 × rate', f.join('; ') || `0.9 at ${f2(t9)} s (want ${f2(want)}), beads ${f2(c2.beads)}`); }
  { // the footprint to the metre: a step inside the south facade (z 23.4, inside INTERIOR's z1 = 24) vs a step outside it (z 24.9)
    const W3 = await fresh(13); const g3 = W3.game; const c3 = g3.player.char; const gd = g3.guards[0];
    g3.teleportPlayer([20, 0, 23.4]); gd.char.pos = [20, 0, 24.9]; gd.char.update(0);
    stepSecs(W3, 4);
    const f: string[] = [];
    if (c3.wet !== 0) f.push(`Sam a step inside the wall got wet ${f2(c3.wet)}`);
    if (!(gd.char.wet > 0.5)) f.push(`the man a step outside it only ${f2(gd.char.wet)} after 4 s`);
    if (!underRoofRect([INTERIOR[0] + 0.01, 0, INTERIOR[1] + 0.01]) || underRoofRect([INTERIOR[2] + 0.3, 0, INTERIOR[3] + 0.3])) f.push('underRoofRect disagrees with INTERIOR at its corners');
    F.verdict(f.length === 0, 'a man 0.6 m inside the south facade stays dry while one 0.9 m outside it soaks (the weather\'s INTERIOR rectangle, the one the rain is drawn by)', f.join('; ') || `inside ${f2(c3.wet)}, outside ${f2(gd.char.wet)}`); }
  return F.done();
}

// ---------------------------------------------------------------- wet-roof
export async function wetRoof() {
  const F = family('wet-roof: a roof over his head keeps a man dry outdoors; the stair tower is roofed; the sky ray is cached (wet.ts openSky)');
  const W = await fresh(21); const { game } = W;
  // a canopy: a 3 × 3 m slab 2.6 m up over a spot on the empty north lawn, pushed into the collision layer's dynamic occluders (what a real canopy box would be to solidBlocked)
  const under: Vec3 = [12, 0, 1.7], beside: Vec3 = [17, 0, 1.7];
  const canopy = makeBox({ c: [under[0], 2.6, under[2]], h: [1.5, 0.05, 1.5], albedo: [0.3, 0.3, 0.3] });
  game.col.dynamicBoxes.push(canopy);
  const c = game.player.char; const gd = game.guards[0];
  game.teleportPlayer([...under]); gd.char.pos = [...beside]; gd.char.update(0);
  const rays0 = WET_STATS.skyTests;
  stepSecs(W, 6);
  const rays = WET_STATS.skyTests - rays0;
  { const f: string[] = [];
    if (underRoofRect(under) || underRoofRect(beside)) f.push('test spots are inside a no-rain rectangle (probe staging wrong)');
    if (c.wet !== 0 || c.beads !== 0) f.push(`under the canopy: wet ${f2(c.wet)} beads ${f2(c.beads)}`);
    if (openSky(game, c)) f.push('openSky true under the canopy');
    if (!(gd.char.wet > 0.9)) f.push(`beside it: only ${f2(gd.char.wet)} after 6 s`);
    // cache: 2 outdoor men × 6 s ÷ 0.25 s ≈ 48 rays (+ the odd extra call from summary / probes); one a frame each would be 720
    if (rays > 80) f.push(`${rays} sky rays in 6 s for two outdoor men (the 0.25 s cache is not holding)`);
    if (rays < 20) f.push(`only ${rays} sky rays in 6 s (is the test running at all?)`);
    F.verdict(f.length === 0, 'under a 3 m canopy on the north lawn he stays bone dry (openSky false) while a man 4 m off soaks; ~4 rays a second per outdoor man, not 60', f.join('; ') || `under ${f2(c.wet)}, beside ${f2(gd.char.wet)}; ${rays} sky rays in 6 s`); }
  { // walk out from under it: wet within the cache interval + the soak
    game.teleportPlayer([14.6, 0, 1.7]); let tWet = -1;
    for (let i = 1; i <= 2 / DT; i++) { W.step(DT); if (tWet < 0 && c.wet > 0) tWet = i * DT; }
    const f: string[] = []; if (!(tWet > 0 && tWet <= 0.25 + 2 * DT)) f.push(`first wet ${f2(tWet)} s after stepping out (cache is 0.25 s)`);
    F.verdict(f.length === 0, 'stepping out from under it he starts to soak within the cache interval (≤ 0.25 s + a frame)', f.join('; ') || `first wet at ${f2(tWet)} s`); }
  { // the cobra head of the south street lamp (16, 5.05, 26.45) is right over a man at (16, 26.3): one ray up says 'roof', the fan of five says 'sky'
    const W3 = await fresh(23); const g3 = W3.game; const c3 = g3.player.char;
    g3.teleportPlayer([16.0, 0, 26.3]); stepSecs(W3, 4);
    const f: string[] = []; if (!openSky(g3, c3)) f.push('openSky false under the lamp head'); if (!(c3.wet > 0.5)) f.push(`only ${f2(c3.wet)} after 4 s under it`);
    F.verdict(f.length === 0, 'standing right under the south lamp\'s head he still soaks (its housing and arm cover two rays of the five, not three)', f.join('; ') || `wet ${f2(c3.wet)} at ${c3.pos.map((x: number) => x.toFixed(2)).join(',')}`); }
  { // the annex: the QRF's roofed landing outside the west stair door
    const W2 = await fresh(22); const g2 = W2.game; const c2 = g2.player.char;
    const landing: Vec3 = [(ANNEX[0] + ANNEX[2]) / 2, 0, (ANNEX[1] + ANNEX[3]) / 2];
    g2.teleportPlayer([...landing]); stepSecs(W2, 4);
    const f: string[] = []; if (c2.wet !== 0) f.push(`wet ${f2(c2.wet)} on the stair landing`); if (!underRoofRect(c2.pos)) f.push(`underRoofRect false at ${c2.pos.map((x: number) => x.toFixed(2))}`);
    F.verdict(f.length === 0, 'the west stair tower\'s landing (weather.ts ANNEX — no rain drawn there) keeps him dry', f.join('; ') || `at ${c2.pos.map((x: number) => x.toFixed(2)).join(',')}: wet ${f2(c2.wet)}`); }
  return F.done();
}

// ---------------------------------------------------------------- wet-off
export async function wetOff() {
  const F = family('wet-off: no storm, no rain, no soaking — off, day, or a dry storm (wet.ts rainNow)');
  const cases: { name: string; set: (W: any) => void }[] = [
    { name: 'weather.setEnabled(false) (= ?noweather)', set: W => W.game.weather.setEnabled(false) },
    { name: 'held by day (setDaylight — the breach)', set: W => setDaylight(W.game, true) },
    { name: 'a dry storm (rainRate 0)', set: W => { W.game.weather.rainRate = 0; } },
  ];
  for (const k of cases) {
    const W = await fresh(31); const { game } = W; k.set(W);
    game.teleportPlayer([...LOT]); game.guards[0].char.pos = [18, 0, 26.5]; game.guards[0].char.update(0);
    stepSecs(W, 30);
    const f: string[] = [];
    for (const c of everyCharacter(game)) if (c.wet !== 0 || c.beads !== 0 || c.wetRain !== 0) f.push(`char ${c.id}: ${f2(c.wet)}/${f2(c.beads)}/${f2(c.wetRain)}`);
    if (rainNow(game) !== 0) f.push(`rainNow ${rainNow(game)}`);
    F.verdict(f.length === 0, `${k.name}: 30 s with two men out in the lot → everybody 0/0/0, rainNow 0`, f.join('; ') || 'all dry');
  }
  return F.done();
}

// ---------------------------------------------------------------- wet-reset
export async function wetReset() {
  const F = family('wet-reset: restartEncounter hands back dry men; a body in the lot soaks like anyone (wet.ts everyCharacter)');
  const W = await fresh(41); const { game } = W;
  game.teleportPlayer([...LOT]); const gd = game.guards[1]; gd.char.pos = [18, 0, 26.5]; gd.char.update(0);
  stepSecs(W, 8);
  const before = `${f2(game.player.char.wet)} / ${f2(gd.char.wet)}`;
  { const f: string[] = [];
    if (!(game.player.char.wet >= 1 && gd.char.wet >= 1)) f.push(`not soaked before the restart: ${before}`);
    // walk him indoors soaked so there ARE print records to lose (to and fro across the cubicle aisle, as wet-prints does)
    game.teleportPlayer([20, 0, 17]); W.step(DT);
    for (let i = 0; i < Math.round(6 / DT); i++) { W.input.keys.add((i / 90 | 0) % 2 ? 'KeyA' : 'KeyD'); W.step(DT); W.input.keys.clear(); }
    const laid = wetPrints(game).length;
    if (laid < 2) f.push(`only ${laid} print records laid before the restart (staging)`);
    game.restartEncounter();
    if (wetPrints(game).length) f.push(`${wetPrints(game).length} print records survived the restart itself`);
    W.step(DT);
    for (const c of everyCharacter(game)) if (c.wet !== 0 || c.beads !== 0) f.push(`char ${c.id} after restart: ${f2(c.wet)}/${f2(c.beads)}`);
    if (game.decals.list.some((d: any) => d.kind === 'wetprint')) f.push('wetprint decals survived');
    F.verdict(f.length === 0, 'Sam and a guard soaked in the lot, Sam walked indoors leaving prints, restartEncounter → the print records are gone that call, every character 0/0 the next frame (fresh Characters), no wetprint decal left', f.join('; ') || `before ${before}; ${laid} records laid; after: all dry, 0 records`); }
  { // a corpse out in the rain: still a Character in the list, still soaks (its pelvis is where it lies)
    const W2 = await fresh(42); const g2 = W2.game; const gd2 = g2.guards[0];
    gd2.char.pos = [18, 0, 26.5]; gd2.char.update(0); W2.step(DT);
    const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
    killGuard(g2, gd2, [1, 0, 0], true, 'struck');
    stepSecs(W2, 8);
    const f: string[] = []; if (gd2.state !== 'dead') f.push(`state ${gd2.state}`); if (!(gd2.char.wet > 0.9)) f.push(`the body only ${f2(gd2.char.wet)} after 8 s in the rain`);
    F.verdict(f.length === 0, 'a man knocked out in the lot lies there soaking (0.9+ after 8 s)', f.join('; ') || `body wet ${f2(gd2.char.wet)} at ${gd2.char.pos.map((x: number) => x.toFixed(1)).join(',')}`); }
  return F.done();
}

// ---------------------------------------------------------------- wet-cast
export async function wetCast() {
  const F = family('wet-cast: spawned units carry the field and obey the same rule (spawnUnit → Character.wet)');
  const W = await fresh(51); const { game } = W;
  const out = spawnUnit(game, { team: 'guard', pos: [22, 0, 26.3], name: 'OUT-1', light: false });
  const inn = spawnUnit(game, { team: 'guard', pos: [20, 0, 18], name: 'IN-1', light: false });
  for (const u of [out, inn]) { u.hold = true; u.pinned = true; }
  stepSecs(W, 8);
  const f: string[] = [];
  if (typeof out.char.wet !== 'number') f.push('unit Character has no wet field');
  if (!(out.char.wet >= 1)) f.push(`the unit in the lot: ${f2(out.char.wet)} after 8 s`);
  if (inn.char.wet !== 0) f.push(`the unit indoors: ${f2(inn.char.wet)}`);
  if (!everyCharacter(game).includes(out.char)) f.push('everyCharacter misses the spawned unit');
  F.verdict(f.length === 0, 'two spawned units, one in the lot and one in the cubicles: the first soaks to 1 in 8 s, the second stays 0; both are in everyCharacter', f.join('; ') || `out ${f2(out.char.wet)}, in ${f2(inn.char.wet)}; ${everyCharacter(game).length} characters`);
  return F.done();
}

// ---------------------------------------------------------------- wet-prints
export async function wetPrints_() {
  const F = family('wet-prints: a soaked Sam come indoors leaves ≤ WET.prints fading footprints; none in the rain, none dry, none with decals off (wet.ts wetFootfall / agePrints)');
  const walkIndoors = (W: any, secs: number) => { for (let i = 0; i < Math.round(secs / DT); i++) { W.input.keys.add((i / 90 | 0) % 2 ? 'KeyA' : 'KeyD'); W.step(DT); W.input.keys.clear(); } };   // to and fro across the cubicle aisle
  { const W = await fresh(61); const { game } = W;
    game.teleportPlayer([20, 0, 17]); W.step(DT);
    soak(game, game.player.char, 1, 1, 1);
    const d0 = game.decals.count;
    walkIndoors(W, 14);
    const P = wetPrints(game); const kinds = game.decals.list.slice(d0).map((d: any) => d.kind);
    const f: string[] = [];
    const nPrints = kinds.filter((k: string) => k === 'wetprint').length;
    if (nPrints < 3) f.push(`only ${nPrints} prints from 14 s of walking soaked`);
    if (nPrints > WET.prints) f.push(`${nPrints} prints (cap WET.prints = ${WET.prints})`);
    const params = game.decals.list.filter((d: any) => d.kind === 'wetprint').map((d: any) => d.param);
    const laid = P.map((r: any) => r.k0);   // strength AT LAY TIME (aging lowers older prints further, so the live params are not the thing to compare)
    for (let i = 1; i < laid.length; i++) if (!(laid[i] < laid[i - 1])) f.push(`print ${i} laid no fainter than the one before (${f2(laid[i - 1])} → ${f2(laid[i])})`);
    if (params.some((p: number) => !(p >= 0 && p <= 1))) f.push(`param out of 0‥1: ${params.map(f2).join(',')}`);
    if (WET_STATS.drips !== 0 && !((game.engine as any).particles)) f.push(`drips counted ${WET_STATS.drips} with no particle system attached`);
    F.verdict(f.length === 0, `soaked by hand at (20, 17) and walked 14 s: 3‥${WET.prints} 'wetprint' decals, each laid fainter than the last, params in 0‥1; no drips headless (no GPU particles) and no throw`, f.join('; ') || `${nPrints} prints, laid at ${laid.map(f2).join(' ')}; live params ${params.map(f2).join(' ')}`);
    // they fade: after printFadeSecs (+ the 0.25 s aging tick) every record is retired and the decals are gone from the ring
    stepSecs(W, WET.printFadeSecs + 1);
    const g: string[] = [];
    if (wetPrints(game).length) g.push(`${wetPrints(game).length} records left after ${WET.printFadeSecs + 1} s`);
    if (game.decals.list.some((d: any) => d.kind === 'wetprint')) g.push('wetprint decals still in the ring');
    F.verdict(g.length === 0, `standing still ${WET.printFadeSecs + 1} s later: every print retired (records 0, no 'wetprint' left in the decal ring)`, g.join('; ') || 'all gone'); }
  { // none while out in the rain (the ground is wetter than his soles), none from a dry man, none with decals off
    const rows: string[] = []; const f: string[] = [];
    { const W = await fresh(62); const { game } = W; game.teleportPlayer([19, 0, 26.3]); stepSecs(W, 7); const n0 = game.decals.count; for (let i = 0; i < 6 / DT; i++) { W.input.keys.add(i % 120 < 60 ? 'KeyD' : 'KeyA'); W.step(DT); W.input.keys.clear(); } const n = game.decals.list.slice(n0).filter((d: any) => d.kind === 'wetprint').length; rows.push(`in the rain: ${n}`); if (n) f.push(`${n} prints while still out in the rain`); if (!(game.player.char.wet >= 1)) f.push('he never soaked out there'); }
    { const W = await fresh(63); const { game } = W; game.teleportPlayer([20, 0, 17]); W.step(DT); walkIndoors(W, 8); const n = game.decals.list.filter((d: any) => d.kind === 'wetprint').length; rows.push(`dry: ${n}`); if (n) f.push(`${n} prints from a dry man`); }
    { const W = await fresh(64); const { game } = W; game.decals.enabled = false; (game.engine.settings as any).decals = false; game.teleportPlayer([20, 0, 17]); W.step(DT); soak(game, game.player.char, 1, 1, 1); walkIndoors(W, 8); const n = game.decals.count; rows.push(`decals off: ${n} decals, ${wetPrints(game).length} records`); if (n || wetPrints(game).length) f.push(`decals off: ${n} decals / ${wetPrints(game).length} records`); }
    F.verdict(f.length === 0, 'no prints while he is still being rained on, none from a dry man, nothing recorded with decals off', f.join('; ') || rows.join(' · ')); }
  return F.done();
}

// ---------------------------------------------------------------- wet-shading
export async function wetShading() {
  const F = family('wet-shading: what the renderer is handed — zeros unless the switch is on AND the man is wet (wet.ts wetInstance × game.ts upload)');
  const W = await fresh(71); const { game } = W;
  const c = game.player.char;
  const IF = CHAR_INST_BYTES / 4;   // floats per instance (anim/characters.ts)
  const inst = (): number[] => Array.from(((game.chars as any).instData as Float32Array).subarray(8, 24));   // Sam is instance 0: floats 8‥11 = wet row, 12‥19 = the look knobs, 20‥23 = the waterline row (line, band, 0, 0)
  const allZero = (a: number[]) => a.every(x => x === 0);
  const f: string[] = [];
  // dry, switch on → zeros
  W.step(DT); if (!allZero(inst())) f.push(`dry man, switch on: ${inst().map(f2).join(',')}`);
  { const out = new Float32Array(4); wetInstance(game, c, true, out, 0); if (!allZero(Array.from(out))) f.push('wetInstance(dry, on) not zero'); }
  // wet, switch on → his numbers + the knobs
  soak(game, c, 0.8, 0.6, 0.9); W.step(DT);
  { const a = inst(); if (!(Math.abs(a[0] - c.wet) < 1e-6 && Math.abs(a[1] - c.beads) < 1e-6 && Math.abs(a[2] - 0.9) < 1e-6)) f.push(`wet row ${a.slice(0, 4).map(f2).join(',')} vs char ${f2(c.wet)}/${f2(c.beads)}/0.9`);
    if (!(a[3] > 0)) f.push('phase 0 for Sam (want a per-man offset > 0)');
    const knobs = [WET.beadDensity, WET.beadSize, WET.trailLen, WET.roughWet, WET.roughDry, WET.darken, WET.darkenMul, WET.specGain];
    for (let i = 0; i < 8; i++) if (Math.abs(a[4 + i] - knobs[i]) > 1e-6) f.push(`knob ${i}: ${a[4 + i]} vs ${knobs[i]}`); }
  { const a = inst(); if (!(a[12] === WET_LINE_ALL && Math.abs(a[13] - WET.lineBand) < 1e-6 && a[14] === 0 && a[15] === 0)) f.push(`waterline row for a rain-soaked man ${a.slice(12, 16).map(f2).join(',')} (want ${WET_LINE_ALL}, ${WET.lineBand}, 0, 0: all of him)`);
    soak(game, c, 1, 0, 0, 0.55); W.step(DT); const b = inst(); if (!(Math.abs(b[12] - 0.55) < 1e-6 && b[1] === 0)) f.push(`wet to the knee: line ${f2(b[12])} beads ${f2(b[1])} (want 0.55, 0)`); soak(game, c, 0.8, 0.6, 0.9); W.step(DT); if (inst()[12] !== WET_LINE_ALL) f.push('a whole-man soak after a waded one keeps the old line'); }
  // wet, switch OFF → zeros the very next upload
  (game.engine.settings as any).wetChars = false; W.step(DT);
  if (!allZero(inst())) f.push(`switch off, still wet: ${inst().map(f2).join(',')} (want zeros)`);
  { const out = new Float32Array(4); wetInstance(game, c, false, out, 0); if (!allZero(Array.from(out))) f.push('wetInstance(wet, off) not zero'); }
  // back on → numbers again; then dry by hand → zeros
  (game.engine.settings as any).wetChars = true; W.step(DT); if (allZero(inst())) f.push('switch back on: still zeros');
  dryAll(game); W.step(DT); if (!allZero(inst())) f.push(`dryAll: ${inst().map(f2).join(',')}`);
  // a guard's row: instance 1 = guards[0]
  soak(game, game.guards[0].char, 1, 1, 1); W.step(DT);
  { const gc = game.guards[0].char; const g1 = Array.from(((game.chars as any).instData as Float32Array).subarray(IF + 8, IF + 12)); if (!(Math.abs(g1[0] - gc.wet) < 1e-6 && Math.abs(g1[1] - gc.beads) < 1e-6 && gc.wet > 0.98 && gc.beads > 0.98)) f.push(`guard 0's row ${g1.map(f2).join(',')} vs his ${f2(gc.wet)}/${f2(gc.beads)}`); if (!allZero(inst())) f.push('Sam\'s row nonzero while only the guard is wet'); }
  F.verdict(f.length === 0, 'instance floats 8‥19: zeros for a dry man; (wet, beads, rain, phase>0) + the eight WET knobs when soaked; zeros the frame after settings.wetChars goes off though he is still wet; back when it returns; zeros after dryAll; a wet guard fills HIS row and not Sam\'s', f.join('; ') || 'as specified');
  return F.done();
}
