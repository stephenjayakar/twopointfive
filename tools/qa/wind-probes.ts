// The 'wind' family (game/wind.ts — the building's air as ONE analytic field for the particles and the smoke solver), run through probes.ts:
//   bun run tools/qa/probes.ts wind | wind-field | wind-sources | wind-caps | wind-level | wind-identity   [--verbose] [--print]
// PASS / FAIL each, all headless:
//   wind-field     the field's numbers at known points off the CPU copy (jetVel / stormVel): full speed just under a diffuser's face, half at its reach on the axis,
//                  nothing behind the face / past dMax / outside the Gaussian's 2.6 σ, the wall jet turning outward under WIND_FIELD.deflectH and nothing under the
//                  floor; the storm nothing indoors / in the annex / over stormTop, easing in over stormLee off the facade, slower along the ground — and the WGSL
//                  text both GPU consumers compile (render/shaders/wind_field.wgsl) carries the same five constants
//   wind-sources   the Game's sources off levels/office.json: six vents + the storm + one per exterior door; tune.wind 1 → the vents blow at their authored speed
//                  × gust (inside 1 ± gustAmp), the corridor vent's 45 s / 0.75 cycle spins it down and back over rampDown / rampUp, a blackout spins every mains
//                  vent down and the restrike brings them back; the storm follows the weather (its vector, off by day, off with the weather); a door gusts only
//                  while its leaf stands open in the storm, along its INWARD normal; the smoke system is handed the active list every frame; tune.wind 0 → nobody
//                  active, both consumers handed empty lists; windAt sums exactly the active sources; and NOTHING wind does draws from Math.random
//   wind-caps      the particles' side (render/particles.ts with a fake device): setWind + prepare pack ≤ WIND_GPU_MAX records BEHIND the frame's impulses (impulses
//                  first: 12 impulses leave 4 wind slots, 16 leave none), the counts in flags bits 8‥12 / 16‥20, a jet's record fields where particles_common.wgsl
//                  says (pos+reach · dir+speed · tan/r0/dMax · floorY · kinds · the f16 knob pairs), the storm's rects, no tail upload with no winds and nothing live,
//                  speed-0 sources skipped; the WGSL side reads them the same way (windAir over [numImps, numImps+numWinds), P_KINDS agreeing with particles.ts, WindKnobs' three)
//   wind-level     vents[] in the file: six parsed with their names / cycling / mains, validate clean, the Level → data → Level round trip keeps every optional
//                  field, a level with no vents block loads with none and its Game has only the storm + doors
//   wind-identity  the master OFF is the game byte for byte: three seeded minutes of the live floor (patrols, a smoke can popped, a shot into the wall, a door
//                  kicked) digested per frame — tune.wind 0 ≡ tune.wind 1 ≡ moths off ≡ the digest FROZEN on the tree before wind.ts (headless the GPU
//                  consumers do not exist, so this is the CPU game's identity: wind and the moths touch no game state and no dice)
import { standUp, ROOT, fake } from './headless.ts';
import type { Vec3 } from './headless.ts';
// (game/wind.ts is imported LAZILY: wind-identity's run must also load on the tree from before the lane, where the file does not exist — see EXPECT_IDENTITY)
let jetVel: any, stormVel: any, WIND: any, WIND_FIELD: any, WIND_STATS: any, Wind: any;
async function windModule() { const m: any = await import(`${ROOT}/src/game/wind.ts`); ({ jetVel, stormVel, WIND, WIND_FIELD, WIND_STATS, Wind } = m); return m; }
const { INTERIOR, ANNEX } = await import(`${ROOT}/src/game/weather.ts`);
const { setDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { OFFICE_DATA, buildLevel } = await import(`${ROOT}/src/scene/level.ts`);
const { loadLevel, levelToData } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const WIND_GPU_MAX = (await import(`${ROOT}/src/smoke/types.ts`) as any).WIND_GPU_MAX ?? 8;
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
const PRINT = process.argv.includes('--print');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x)), f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : String(x));
const len = (v: number[]) => Math.hypot(v[0], v[1], v[2]);
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
/** the smoke stand-in the harness hands the Game, with setWind recorded */
function recordSmoke(W: any) { const calls: { n: number; names: string[]; relax: number; t: number }[] = []; W.smoke.setWind = (srcs: any[], relax: number) => { calls.push({ n: srcs.length, names: srcs.map(s => s.name), relax, t: W.game.time }); }; return calls; }

// ---------------------------------------------------------------- wind-field
export async function windField(): Promise<boolean> {
  await windModule();
  const F = family('wind-field: the analytic jet and the storm at known points (game/wind.ts jetVel / stormVel = render/shaders/wind_field.wgsl)');
  // a ceiling diffuser like the office's: face at 2.965, blowing down at 2.4 m/s, spread 28°, reach 1.3 → dMax 3.25, r0 0.24, floor at 0
  const pos: Vec3 = [10, 2.965, 10], dir: Vec3 = [0, -1, 0], speed = 2.4, reach = 1.3, tanS = Math.tan(28 * Math.PI / 180), r0 = WIND_FIELD.coreK * 0.6, dMax = WIND_FIELD.cutK * reach;
  const at = (p: Vec3, floorY = 0) => jetVel(pos, dir, speed, reach, tanS, r0, dMax, floorY, p);
  { // (1) along the axis
    const face = at([10, 2.96, 10]), half = at([10, 2.965 - reach, 10]), behind = at([10, 3.0, 10]), past = at([10, 2.965 - dMax - 0.01, 10], -1e9), nearEnd = at([10, 2.965 - dMax * 0.85, 10], -1e9);
    const fails: string[] = [];
    if (Math.abs(len(face) - speed) > 0.02 * speed || face[1] > -0.99 * len(face)) fails.push(`face ${f3(len(face))} dir y ${f3(face[1] / len(face))}`);
    if (Math.abs(len(half) - speed / 2) > 0.01) fails.push(`at reach ${f3(len(half))} (want ${f2(speed / 2)})`);
    if (len(behind) !== 0 || len(past) !== 0) fails.push(`behind ${f3(len(behind))} past dMax ${f3(len(past))}`);
    const wantNear = speed / (1 + (0.85 * WIND_FIELD.cutK) ** 2) * (1 - smooth(0.7 * dMax, dMax, 0.85 * dMax));
    if (Math.abs(len(nearEnd) - wantNear) > 0.01) fails.push(`85 % of dMax: ${f3(len(nearEnd))} (want ${f3(wantNear)}: the 1/(1+x²) falloff × the last-30 % fade)`);
    F.verdict(!fails.length, 'on the axis: the face speed just under the face pointing straight down, half of it at `reach`, the fade over the last 30 % of dMax, exactly nothing behind the face and past dMax', fails.join('; ') || `face ${f3(len(face))} · reach ${f3(len(half))} · 0.85 dMax ${f3(len(nearEnd))} · behind / past 0`);
  }
  { // (2) across the axis: the Gaussian and its 2.6 σ support; the streamline leans out with the cone
    const d = 1.5, sigma = r0 + d * tanS; const y = 2.965 - d;
    const axis = at([10, y, 10], -1e9), oneS = at([10 + sigma, y, 10], -1e9), edge = at([10 + 2.5 * sigma, y, 10], -1e9), out = at([10 + 2.7 * sigma, y, 10], -1e9);
    const fails: string[] = [];
    if (Math.abs(len(oneS) / len(axis) - Math.exp(-1)) > 0.01) fails.push(`1 σ ratio ${f3(len(oneS) / len(axis))} (want e⁻¹ 0.368)`);
    if (!(len(edge) > 0 && len(edge) < 0.003 * len(axis))) fails.push(`2.5 σ ${f3(len(edge))}`); if (len(out) !== 0) fails.push(`2.7 σ ${len(out)} (want exactly 0: outside the support)`);
    if (!(oneS[0] > 0.05 * len(oneS))) fails.push(`the streamline at 1 σ does not lean outward (x ${f3(oneS[0])})`);
    F.verdict(!fails.length, 'across the axis 1.5 m down: e⁻¹ of the axis speed at one σ (σ = r0 + d·tanSpread), a trace at 2.5 σ, exactly nothing past 2.6 σ; the streamline leans outward with the cone', fails.join('; ') || `axis ${f3(len(axis))} · 1σ ${f3(len(oneS))} (x ${f3(oneS[0])}) · 2.5σ ${len(edge).toExponential(1)} · 2.7σ 0`);
  }
  { // (3) the wall jet: under deflectH over the floor the direction turns horizontal-outward and loses deflectLoss of the speed at the floor; under the floor nothing; a resting leaf's own surface the same
    const hi = at([10.4, WIND_FIELD.deflectH + 0.05, 10]), lo = at([10.4, 0.02, 10]), under = at([10.4, -0.05, 10]);
    const desk = jetVel(pos, dir, speed, reach, tanS, r0, dMax, 0.77, [10.4, 0.79, 10]);   // the desk top as the surface (what the kernel hands for a leaf lying on it)
    const fails: string[] = [];
    if (!(hi[1] < -0.9 * len(hi))) fails.push(`just over deflectH still mostly down? y/|v| ${f3(hi[1] / len(hi))}`);
    if (!(Math.abs(lo[1]) < 0.08 * len(lo) && lo[0] > 0.9 * len(lo))) fails.push(`at the floor: y/|v| ${f3(lo[1] / len(lo))}, x/|v| ${f3(lo[0] / len(lo))} (want ≈ horizontal, outward +x)`);
    if (len(under) !== 0) fails.push(`under the floor ${f3(len(under))}`);
    if (!(Math.abs(desk[1]) < 0.08 * len(desk) && desk[0] > 0.9 * len(desk) && len(desk) > 0.2)) fails.push(`over a desk at 0.77: ${desk.map(f3).join(',')}`);
    const free = at([10.4, 0.79, 10]);   // the same point in free air (floor 0): still a down-jet there
    if (!(free[1] < -0.9 * len(free))) fails.push(`0.79 m up in free air should still blow down (y/|v| ${f3(free[1] / len(free))})`);
    F.verdict(!fails.length, `the wall jet: over deflectH ${WIND_FIELD.deflectH} m the jet still blows down, at the floor it runs OUTWARD along it (× ${1 - WIND_FIELD.deflectLoss} of the speed), nothing under the floor; handed a desk top as the surface it turns along the desk the same way — the free air at that height still blows down`, fails.join('; ') || `over: y ${f3(hi[1] / len(hi))} · floor: (${lo.map(f3).join(', ')}) · desk: (${desk.map(f3).join(', ')}) · free at desk height: y ${f3(free[1] / len(free))}`);
  }
  { // (4) the storm
    const w: Vec3 = [3, 0, 1];
    const inside = stormVel(w, INTERIOR, ANNEX, [20, 1, 14]), annex = stormVel(w, INTERIOR, ANNEX, [2.5, 1, 11]), high = stormVel(w, INTERIOR, ANNEX, [38, WIND_FIELD.stormTop + 0.5, 26]);
    const far = stormVel(w, INTERIOR, ANNEX, [38, 2.5, 26]), lee = stormVel(w, INTERIOR, ANNEX, [36 + WIND_FIELD.stormLee / 2, 2.5, 20]), ground = stormVel(w, INTERIOR, ANNEX, [38, 0.05, 26]);
    const fails: string[] = [];
    if (len(inside) !== 0 || len(annex) !== 0 || len(high) !== 0) fails.push(`indoors ${len(inside)} annex ${len(annex)} over top ${len(high)}`);
    if (Math.abs(len(far) - len(w)) > 1e-6) fails.push(`well out in the lot at 2.5 m: ${f3(len(far))} (want the full ${f3(len(w))})`);
    if (!(len(lee) > 0.3 * len(w) && len(lee) < 0.7 * len(w))) fails.push(`half-way through the lee band: ${f3(len(lee))} (want about half)`);
    if (Math.abs(len(ground) / len(far) - 0.559) > 0.02) fails.push(`along the ground: ${f3(len(ground) / len(far))} of the free stream (want 0.55 + 0.45 × 0.02)`);
    F.verdict(!fails.length, `the storm: nothing indoors / in the annex / over ${WIND_FIELD.stormTop} m, the full vector out in the lot, about half of it half-way through the ${WIND_FIELD.stormLee} m lee band off the facade, 0.56 of it along the ground`, fails.join('; ') || `lot ${f3(len(far))} · lee ${f3(len(lee))} · ground ${f3(len(ground))} · indoors / annex / high 0`);
  }
  { // (5) the WGSL text carries the same constants (both GPU consumers compile it)
    const wg = await Bun.file(`${ROOT}/src/render/shaders/wind_field.wgsl`).text();
    const want: [string, number][] = [['WIND_DEFLECT_H', WIND_FIELD.deflectH], ['WIND_DEFLECT_LOSS', WIND_FIELD.deflectLoss], ['WIND_SUPPORT_SIG', WIND_FIELD.supportSigma], ['WIND_STORM_TOP', WIND_FIELD.stormTop], ['WIND_STORM_LEE', WIND_FIELD.stormLee]];
    const fails: string[] = [];
    for (const [k, v] of want) { const m = new RegExp(`const ${k}: f32 = ([0-9.]+);`).exec(wg); if (!m) fails.push(`${k} missing`); else if (Math.abs(parseFloat(m[1]) - v) > 1e-9) fails.push(`${k} = ${m[1]} ≠ ${v}`); }
    if (!/fn windJet\(pos: vec3f, dir: vec3f, speed: f32, reach: f32, tanSpread: f32, r0: f32, dMax: f32, floorY: f32, p: vec3f\) -> vec3f/.test(wg)) fails.push('windJet signature changed (particles.wgsl windAir and smoke/wind_force.wgsl both call it positionally)');
    if (!/fn windStorm\(windV: vec3f, interior: vec4f, annex: vec4f, p: vec3f\) -> vec3f/.test(wg)) fails.push('windStorm signature changed');
    const sm = await Bun.file(`${ROOT}/src/smoke/smoke.ts`).text(), pt = await Bun.file(`${ROOT}/src/render/particles.ts`).text();
    if (!/windFieldSrc \+ (?:'\\n' \+ )?windForceSrc \+ (?:'\\n' \+ )?smokeSrc/.test(sm)) fails.push('smoke.ts does not prepend wind_field + wind_force'); if (!/particlesCommon \+ windFieldSrc \+ particlesSrc/.test(pt)) fails.push('particles.ts does not compile wind_field ahead of the kernels');
    F.verdict(!fails.length, 'render/shaders/wind_field.wgsl carries WIND_FIELD\'s five constants and the two signatures the consumers call, and both the smoke module and the particle module compile that one text', fails.join('; ') || want.map(([k, v]) => `${k} ${v}`).join(' · '));
  }
  return F.done();
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- wind-sources
export async function windSources(): Promise<boolean> {
  await windModule();
  const F = family('wind-sources: the Game\'s vents / storm / door gusts, their cycling, the mains, the hand-off, the master, the dice');
  Math.random = seeded(5101);
  const W = await standUp(); const { game } = W; const calls = recordSmoke(W);
  game.godMode = true; game.playerInvisible = true; for (const gd of game.guards) { gd.hold = true; gd.pinned = true; }
  const wind = game.wind; game.tune.wind = 1;
  { // (1) the roster
    const names = wind.all.map((s: any) => s.name);
    const vents = wind.all.filter((s: any) => s.why === 'vent'), doors = wind.all.filter((s: any) => s.why === 'door');
    const inAnnex = (x: number, z: number) => x > ANNEX[0] && z > ANNEX[1] && x < ANNEX[2] && z < ANNEX[3];
    const extDoors = game.doors.list.filter((d: any) => d.def.exterior && !inAnnex(d.frameCentre[0] - 0.5 * Math.sign(20 - d.frameCentre[0]), d.frameCentre[2])).map((d: any) => 'door:' + d.def.name);   // (an exterior door whose outside is the roofed stair tower — 'stairwell' — draws no weather)
    const ok = vents.length === 6 && wind.all.filter((s: any) => s.why === 'storm').length === 1 && doors.length === extDoors.length && extDoors.every((n: string) => names.includes(n)) && !names.includes('door:stairwell');
    // every door jet points INTO the building
    const inward = doors.every((s: any) => { const q = [s.pos[0] + s.dir[0] * 1.5, s.pos[2] + s.dir[2] * 1.5]; return q[0] > INTERIOR[0] && q[1] > INTERIOR[1] && q[0] < INTERIOR[2] && q[1] < INTERIOR[3]; });
    F.verdict(ok && inward, 'the roster off the office: six vents, one storm, one gust source per exterior door that opens on the WEATHER (breakroom_ext, fire_exit — not the stairwell into the roofed tower), every door jet pointing INTO the footprint', `${names.join(', ')}${inward ? '' : ' — a door jet points outward'}`);
  }
  { // (2) vents blow at authored × gust; windAt sums the active
    for (let i = 0; i < 30; i++) W.step(DT);
    const fails: string[] = [];
    for (const s of wind.active.filter((s: any) => s.why === 'vent')) { const v = s.vent; if (Math.abs(s.speed - v.speed * s.on * s.gust) > 1e-9 || s.gust < 1 - WIND.gustAmp - 1e-9 || s.gust > 1 + WIND.gustAmp + 1e-9) fails.push(`${s.name} speed ${f3(s.speed)} base ${v.speed} on ${f2(s.on)} gust ${f3(s.gust)}`); }
    const va = wind.byName('vent_aisle'); const p: Vec3 = [va.pos[0], va.pos[1] - 1.0, va.pos[2]];
    const got = wind.at(p); const want = jetVel(va.pos, va.dir, va.speed, va.reach, va.tanSpread, va.r0, va.dMax, 0, p);
    let sum: Vec3 = [0, 0, 0]; for (const s of wind.active) { const q = s.kind === 'storm' ? stormVel([s.dir[0] * s.speed, 0, s.dir[2] * s.speed], s.interior, s.annex, p) : jetVel(s.pos, s.dir, s.speed, s.reach, s.tanSpread, s.r0, s.dMax, s.floorY ?? -1e9, p); sum = [sum[0] + q[0], sum[1] + q[1], sum[2] + q[2]]; }
    if (Math.abs(got[1] - want[1]) > 1e-6 || len([got[0] - sum[0], got[1] - sum[1], got[2] - sum[2]]) > 1e-9) fails.push(`windAt under vent_aisle ${got.map(f3)} vs its jet ${want.map(f3)} / the sum ${sum.map(f3)}`);
    if (!(len(got) > 0.5 * va.speed / (1 + (1 / va.reach) ** 2))) fails.push(`a metre under the aisle vent only ${f3(len(got))} m/s`);
    F.verdict(!fails.length, `after half a second every active vent blows at its authored face speed × its spin × a gust inside 1 ± ${WIND.gustAmp}, and windAt() is exactly the sum of the active sources' fields (a metre under vent_aisle: ${f2(len(got))} m/s straight down)`, fails.join('; ') || wind.active.map((s: any) => `${s.name} ${f2(s.speed)}`).join(' · '));
  }
  { // (3) the corridor vent's cycle: period 45, duty 0.75, phase 20 → off from t 8.75 to t 20, spinning down over rampDown and up over rampUp
    const vc = wind.byName('vent_corridor'); const trace: string[] = []; let onAt8 = -1, onAt14 = -1, onAt21 = -1, onAt25 = -1;
    while (game.time < 26) { W.step(DT); const t = game.time; if (onAt8 < 0 && t >= 8.0) onAt8 = vc.on; if (onAt14 < 0 && t >= 14) onAt14 = vc.on; if (onAt21 < 0 && t >= 21) onAt21 = vc.on; if (onAt25 < 0 && t >= 25) onAt25 = vc.on; if (VERBOSE && Math.abs(t % 2) < DT) trace.push(`${f2(t)}:${f2(vc.on)}`); }
    const ok = onAt8 > 0.95 && onAt14 < 0.02 && onAt21 > 0.2 && onAt21 < 0.5 && onAt25 > 0.95;
    F.verdict(ok, `vent_corridor cycles (45 s / duty 0.75 / phase 20): full on at t 8, spun DOWN by t 14 (off since 8.75, ${WIND.rampDown} s ramp), a third of the way back UP a second after t 20, full again by t 25`, `on(t8) ${f2(onAt8)} · on(t14) ${f2(onAt14)} · on(t21) ${f2(onAt21)} · on(t25) ${f2(onAt25)}${trace.length ? ' · ' + trace.join(' ') : ''}`);
  }
  { // (4) the mains: a blackout spins every mains vent down; the restrike brings them back
    game.setBlackout(30, 'debug'); const t0 = game.time;
    while (game.time < t0 + WIND.rampDown + 1) W.step(DT);
    const dark = wind.all.filter((s: any) => s.why === 'vent').map((s: any) => s.on);
    const anyVentActive = wind.active.some((s: any) => s.why === 'vent');
    game.endBlackout(); const t1 = game.time; while (game.time < t1 + WIND.rampUp + 1) W.step(DT);
    const back = wind.all.filter((s: any) => s.why === 'vent' && s.name !== 'vent_corridor' && s.name !== 'vent_break').map((s: any) => s.on);   // (the two cyclers may be in their off phase)
    const ok = dark.every((o: number) => o < 0.01) && !anyVentActive && back.every((o: number) => o > 0.99);
    F.verdict(ok, `a blackout spins all six (mains) vents down inside rampDown ${WIND.rampDown} s — none active — and ${WIND.rampUp} s after the restrike the steady ones are back at full`, `in the dark: ${dark.map(f2).join(',')} · after: ${back.map(f2).join(',')}`);
  }
  { // (5) the storm follows the weather; a door gusts only while open in it, inward
    const wx = game.weather; wx.setEnabled(true); wx.storm = 0.8; wx.rainRate = 0.5; wx.wind[0] = -2.5; wx.wind[1] = 0.5;
    for (let i = 0; i < 10; i++) W.step(DT);
    const st = wind.byName('storm'); const speedOn = st.speed; const dirOn = [...st.dir];
    const fe = game.doors.byName('fire_exit'); const ds = wind.byName('door:fire_exit');
    const shutSpeed = ds.speed;
    fe.angle = -1.4; fe.latched = false; fe.vel = 0; fe.place(); for (let i = 0; i < 3; i++) { fe.angle = -1.4; W.step(DT); }
    const openSpeed = ds.speed; const inwardX = ds.dir[0];
    setDaylight(game, true); for (let i = 0; i < 3; i++) { fe.angle = -1.4; W.step(DT); } const daySpeed = st.speed, dayDoor = ds.speed; setDaylight(game, false);
    for (let i = 0; i < 3; i++) { fe.angle = -1.4; W.step(DT); } const nightAgain = st.speed;
    wx.setEnabled(false); for (let i = 0; i < 3; i++) { fe.angle = -1.4; W.step(DT); } const offSpeed = st.speed; wx.setEnabled(true); for (let i = 0; i < 3; i++) W.step(DT);
    fe.reset(); for (let i = 0; i < 3; i++) W.step(DT); const shutAgain = ds.speed;
    const wmag = Math.hypot(2.5, 0.5);
    const fails: string[] = [];
    if (!(speedOn > wmag * (1 - WIND.stormGustAmp) - 1e-6 && speedOn < wmag * (1 + WIND.stormGustAmp) + 1e-6) || Math.abs(dirOn[0] - (-2.5 / wmag)) > 1e-9) fails.push(`storm ${f3(speedOn)} dir ${dirOn.map(f3)} (wind (−2.5, 0.5) = ${f3(wmag)} m/s)`);
    if (shutSpeed !== 0 || !(openSpeed > 0.5) || !(inwardX < -0.99)) fails.push(`fire exit: shut ${shutSpeed}, open ${f3(openSpeed)} dir x ${f3(inwardX)} (want 0 shut, a gust WEST when open)`);
    if (daySpeed !== 0 || dayDoor !== 0 || !(nightAgain > 0)) fails.push(`day: storm ${daySpeed} door ${dayDoor}; night again ${f3(nightAgain)}`);
    if (offSpeed !== 0) fails.push(`weather off: storm ${offSpeed}`); if (shutAgain !== 0) fails.push(`door shut again: ${shutAgain}`);
    F.verdict(!fails.length, 'the storm source is the weather\'s vector (× a gust inside 1 ± stormGustAmp), gone by day and with the weather off, back at night; the fire exit gusts only while its leaf stands open in the storm — westward, INTO the room — and stops when it shuts', fails.join('; ') || `storm ${f2(speedOn)} m/s from the east · door shut 0 → open ${f2(openSpeed)} (dir x ${f2(inwardX)}) → day 0 → shut 0`);
  }
  { // (6) the hand-off + the master
    const before = calls.length; for (let i = 0; i < 5; i++) W.step(DT);
    const perFrame = calls.length - before; const last = calls[calls.length - 1];
    game.tune.wind = 0; for (let i = 0; i < 3; i++) W.step(DT); const off = calls[calls.length - 1]; const activeOff = wind.active.length; const atOff = wind.at([19.8, 1.5, 14.6]);
    game.tune.wind = 1; for (let i = 0; i < 3; i++) W.step(DT); const on = calls[calls.length - 1];
    const fails: string[] = [];
    if (perFrame !== 5) fails.push(`setWind called ${perFrame} times in 5 frames`); if (!(last.n === wind.active.length || last.n > 0) || last.relax !== WIND.smokeRelax) fails.push(`last call n ${last.n} relax ${last.relax}`);
    if (off.n !== 0 || activeOff !== 0 || len(atOff) !== 0) fails.push(`master 0: setWind n ${off.n}, active ${activeOff}, windAt ${len(atOff)}`);
    if (!(on.n > 0)) fails.push(`master back to 1: n ${on.n}`);
    F.verdict(!fails.length, 'the smoke system is handed the active list once a frame with WIND.smokeRelax; tune.wind 0 → an EMPTY list, no active source, windAt ≡ 0 (still air everywhere); back to 1 → the sources again', fails.join('; ') || `per frame ${perFrame}/5 · on: ${on.n} sources (${on.names.slice(0, 4).join(', ')}…) · off: ${off.n}`);
  }
  { // (7) no dice: a seeded game sequence comes out the same whatever the wind does
    const draw = async (windK: number, moths: boolean) => { Math.random = seeded(777); const V = await standUp(); V.game.tune.wind = windK; V.game.tune.moths = moths; V.game.weather.setEnabled(true); for (let i = 0; i < 240; i++) V.step(DT); return Math.random(); };
    const a = await draw(1, true), b = await draw(0, false), c = await draw(1, false);
    F.verdict(a === b && b === c, 'four seconds of a seeded floor with wind 1 + moths, wind 0 without, wind 1 without → the next Math.random() draw is the same number: nothing here touches the game\'s dice', `${a} · ${b} · ${c}`);
  }
  if (VERBOSE) console.log('    ' + game.wind.summary() + '\n    stats ' + JSON.stringify(WIND_STATS));
  return F.done();
}

// ---------------------------------------------------------------- wind-caps (the particles' packing, with a fake device)
export async function windCaps(): Promise<boolean> {
  await windModule();
  const F = family('wind-caps: the wind records behind the impulses in the particles\' block (render/particles.ts setWind / prepare) and the WGSL that reads them');
  const P: any = await import(`${ROOT}/src/render/particles.ts`);
  const { Particles, MAX_IMPULSES, IMP_OFFSET, IMP_BYTES, WIND_KINDS_DEFAULT, P_KINDS, f16pair } = P;
  const writes: { off: number; size: number }[] = [];
  const dev = new Proxy(fake('device'), { get(t: any, p: PropertyKey) { if (p === 'queue') return { writeBuffer: (_b: any, off: number, _d: any, _doff: number, size: number) => { writes.push({ off, size }); }, onSubmittedWorkDone: () => Promise.resolve() }; return t[p]; } });
  const sys = new Particles(dev, fake('layout'));
  const block = (sys as any).block as ArrayBuffer; const bf = new Float32Array(block), bu = new Uint32Array(block);
  const jet = (name: string, x: number, speed = 2): any => ({ kind: 'jet', name, pos: [x, 2.9, 10], dir: [0, -1, 0], speed, reach: 1.2, tanSpread: 0.45, r0: 0.24, dMax: 3.0, floorY: 0, bound: { c: [x, 1.4, 10], r: 2.5 } });
  const storm: any = { kind: 'storm', name: 'storm', pos: [0, 0, 0], dir: [0.8, 0, 0.6], speed: 3, reach: 0, tanSpread: 0, r0: 0, dMax: 0, interior: [4, 4, 36, 24], annex: [1.1, 9.33, 4, 12.87], bound: { c: [20, 1, 14], r: 1e6 } };
  const knobs: [number, number, number] = [0.35, 2.0, 0.15];
  { // (1) no winds, nothing live: the header alone; winds but nothing live: no tail upload
    writes.length = 0; sys.prepare(DT, true); const idle = writes.map(w => `${w.off}+${w.size}`);
    sys.setWind([jet('a', 10), storm], knobs); writes.length = 0; sys.prepare(DT, true); const noLive = writes.filter(w => w.off === IMP_OFFSET).length; const nw0 = (bu[3] >> 16) & 31;
    F.verdict(idle.length === 1 && noLive === 0 && nw0 === 0, 'no winds and nothing live → one header upload; winds handed in with nothing live to move → no tail upload, count 0 (a draught in an empty room costs the GPU nothing)', `idle writes ${idle.join(' ')} · with winds, nothing live: tail uploads ${noLive}, numWinds ${nw0}`);
  }
  { // (2) something live: ≤ WIND_GPU_MAX packed behind the impulses, fields where the WGSL reads them
    sys.emit('sheet', [10, 1, 10], [0, 1, 0], 20, { shape: 'burst', speed: 2, life: 60, size: 0.2 }); sys.prepare(DT, true);   // (born: live from now on)
    const srcs = Array.from({ length: 11 }, (_, i) => jet(`j${i}`, 8 + i, i === 3 ? 0 : 2)); srcs.push(storm);
    sys.impulse([10, 0.5, 10], 2, 1.5, {}); sys.impulse([12, 0.5, 10], 2, 1.5, {});
    sys.setWind(srcs, knobs); writes.length = 0; sys.prepare(DT, true);
    const ni = (bu[3] >> 8) & 31, nw = (bu[3] >> 16) & 31;
    const tail = writes.find(w => w.off === IMP_OFFSET);
    const rec = (i: number) => { const b = (IMP_OFFSET + i * IMP_BYTES) / 4; return { pos: [bf[b], bf[b + 1], bf[b + 2]], radius: bf[b + 3], bias: [bf[b + 4], bf[b + 5], bf[b + 6]], strength: bf[b + 7], eye: [bf[b + 8], bf[b + 9], bf[b + 10]], up: bf[b + 11], kinds: bu[b + 12], seed: bu[b + 13], iflags: bu[b + 14], spare: bu[b + 15] }; };
    const w0 = rec(ni), w1 = rec(ni + 1);
    const fails: string[] = [];
    if (ni !== 2 || nw !== WIND_GPU_MAX) fails.push(`counts: impulses ${ni} winds ${nw} (want 2 / ${WIND_GPU_MAX} of the 12 offered, one of them speed 0)`);
    if (!tail || tail.size !== (ni + nw) * IMP_BYTES) fails.push(`tail upload ${tail?.size} B (want ${(ni + nw) * IMP_BYTES}: impulses + winds in one write)`);
    if (w0.pos[0] !== 8 || Math.abs(w0.radius - 1.2) > 1e-6 || w0.bias[1] !== -1 || w0.strength !== 2 || Math.abs(w0.eye[0] - 0.45) > 1e-6 || Math.abs(w0.eye[1] - 0.24) > 1e-6 || w0.eye[2] !== 3 || w0.up !== 0 || w0.iflags !== 2 || w0.kinds !== WIND_KINDS_DEFAULT) fails.push(`first wind record ${JSON.stringify(w0)}`);
    if (w0.seed !== f16pair(knobs[0], knobs[1]) || w0.spare !== f16pair(knobs[2], 0)) fails.push(`knob words ${w0.seed.toString(16)} / ${w0.spare.toString(16)} ≠ f16pair(${knobs})`);
    const names: number[] = []; for (let i = 0; i < nw; i++) names.push(rec(ni + i).pos[0]);
    if (names.includes(11)) fails.push('the speed-0 source j3 (x 11) was packed'); if (w1.pos[0] !== 9) fails.push(`second record x ${w1.pos[0]} (want j1 at 9: order kept)`);
    // f16 round trip of the knobs (what unpack2x16float will read)
    const half = (h: number) => { const s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * m * 2 ** -24 : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * 2 ** (e - 15); };
    const kw = [half(w0.seed & 0xffff), half(w0.seed >>> 16), half(w0.spare & 0xffff), half(w0.spare >>> 16)];
    if (kw.some((v, i) => Math.abs(v - (knobs[i] ?? 0)) > 2e-3 * Math.max(1, knobs[i] ?? 0))) fails.push(`knobs decode ${kw.map(f3)} ≠ ${knobs},0 (the spare half)`);
    F.verdict(!fails.length, `two impulses + twelve sources offered (one at speed 0) over live particles → impulses at [0, 2), the first ${WIND_GPU_MAX} live winds at [2, ${2 + WIND_GPU_MAX}) in the order given, one tail upload of both; a jet record = pos + reach · axis + speed · (tanSpread, r0, dMax) · floorY · kinds ${WIND_KINDS_DEFAULT} · iflags 2 · the three knobs as f16 pairs (decode ${'wake/kick/debrisK'})`, fails.join('; ') || `ni ${ni} nw ${nw} · tail ${tail?.size} B · w0 x ${w0.pos[0]} speed ${w0.strength} eye ${w0.eye.map(f2)} · knobs ${kw.map(f3).join('/')}`);
  }
  { // (3) impulses come first: 12 impulses leave 4 wind slots, 16 leave none; the storm's rects
    for (let i = 0; i < 12; i++) sys.impulse([8 + i * 1.5, 0.5, 10], 1, 1.5, {});
    sys.setWind([storm, jet('a', 10), jet('b', 12), jet('c', 14), jet('d', 16), jet('e', 18)], knobs); sys.prepare(DT, true);
    const ni = (bu[3] >> 8) & 31, nw = (bu[3] >> 16) & 31;
    const b = (IMP_OFFSET + ni * IMP_BYTES) / 4; const st = { pos: [bf[b], bf[b + 1], bf[b + 2]], radius: bf[b + 3], bias: [bf[b + 4], bf[b + 5], bf[b + 6]], strength: bf[b + 7], eye: [bf[b + 8], bf[b + 9], bf[b + 10]], up: bf[b + 11], iflags: bu[b + 14] };
    for (let i = 0; i < 16; i++) sys.impulse([8 + i * 1.5, 0.5, 10], 1, 1.5, {});
    sys.setWind([storm, jet('a', 10)], knobs); sys.prepare(DT, true); const ni2 = (bu[3] >> 8) & 31, nw2 = (bu[3] >> 16) & 31;
    const fails: string[] = [];
    if (ni !== 12 || nw !== MAX_IMPULSES - 12) fails.push(`12 impulses: ni ${ni} nw ${nw} (want 12 / ${MAX_IMPULSES - 12})`);
    if (st.iflags !== (2 | (1 << 2)) || st.pos[0] !== 4 || st.pos[2] !== 36 || st.radius !== 24 || Math.abs(st.eye[0] - 1.1) > 1e-6 || Math.abs(st.up - 12.87) > 1e-5 || Math.abs(st.bias[0] - 0.8) > 1e-6 || st.strength !== 3) fails.push(`storm record ${JSON.stringify(st)}`);
    if (ni2 !== MAX_IMPULSES || nw2 !== 0) fails.push(`16 impulses: ni ${ni2} nw ${nw2} (want ${MAX_IMPULSES} / 0)`);
    F.verdict(!fails.length, `impulses are never short of a slot: 12 of them leave ${MAX_IMPULSES - 12} wind records, ${MAX_IMPULSES} leave none; the storm record carries the interior rect in pos+radius, the annex in eye+up, the wind in bias × strength, iflags 2 | 1<<2`, fails.join('; ') || `12 → nw ${nw} · 16 → nw ${nw2} · storm iflags ${st.iflags} interior (${st.pos[0]}, ${st.pos[1]}, ${st.pos[2]}, ${st.radius})`);
  }
  { // (4) the WGSL side reads what the CPU writes
    const wg = await Bun.file(`${ROOT}/src/render/shaders/particles.wgsl`).text(), wc = await Bun.file(`${ROOT}/src/render/shaders/particles_common.wgsl`).text();
    const fails: string[] = [];
    if (!/fn numWinds\(\) -> u32 \{ return \(em\.flags >> 16u\) & 31u; \}/.test(wg)) fails.push('numWinds does not read flags bits 16‥20');
    if (!/for \(var i = n0; i < n0 \+ nw; i\+\+\)/.test(wg)) fails.push('windAir does not walk [numImps, numImps + numWinds)');
    if (!/\(\(w\.iflags >> 2u\) & 3u\) == 1u/.test(wg)) fails.push('the storm mode bit test changed');
    if (!/windJet\(w\.pos, w\.bias, w\.strength, w\.radius, w\.eye\.x, w\.eye\.y, w\.eye\.z, max\(w\.up, surfY\), p\)/.test(wg)) fails.push('windAir\'s jet call does not map the record as particles.ts writes it');
    if (!/unpack2x16float\(r\.seed\); let b = unpack2x16float\(r\.spare\)/.test(wg)) fails.push('windKnobs does not read seed / spare');
    if (!new RegExp(`const P_KINDS: u32 = ${P_KINDS.length}u;`).test(wc)) fails.push(`P_KINDS is not ${P_KINDS.length} in particles_common.wgsl`);
    if (!/sheetAir\(&p, &sn, &sw, &gust, k0, k1\.z, dt, vAir\)/.test(wg)) fails.push('sheetAir is not handed vAir');
    F.verdict(!fails.length, 'particles.wgsl reads the winds behind the impulses (flags 16‥20, [numImps, +numWinds)), maps a jet record as particles.ts writes it, tells the storm by iflags bit 2, takes the knobs off seed / spare; P_KINDS agrees with particles.ts; the sheet\'s aerodynamics take vAir', fails.join('; ') || 'ok');
  }
  return F.done();
}

// ---------------------------------------------------------------- wind-level
export async function windLevel(): Promise<boolean> {
  await windModule();
  const F = family('wind-level: vents[] in levels/office.json — parsed, validated, round-tripped, optional');
  const D = OFFICE_DATA; const L = buildLevel();
  { const names = (L.vents ?? []).map((v: any) => v.name);
    const want = ['vent_cub_nw', 'vent_cub_se', 'vent_aisle', 'vent_corridor', 'vent_break', 'vent_server'];
    const vc = (L.vents ?? []).find((v: any) => v.name === 'vent_corridor');
    const ok = want.every(n => names.includes(n)) && names.length === 6 && vc && vc.period === 45 && vc.duty === 0.75 && vc.phase === 20 && vc.mains === true && (L.vents ?? []).every((v: any) => v.dir[1] === -1 && v.pos[1] > 2.9 && v.speed >= 2 && v.speed <= 2.8);
    F.verdict(!!ok, 'the office loads six ceiling vents by name, all blowing straight down from just under the slab at 2‥2.8 m/s, the corridor one carrying its 45 / 0.75 / 20 cycle and mains', names.join(', ') + (vc ? ` · corridor: period ${vc.period} duty ${vc.duty} phase ${vc.phase} mains ${vc.mains}` : ''));
  }
  { const errs: string[] = validateLevelData(D);
    const grille = D.boxes.filter((b: any) => b.group === 'ceiling.vents');
    const under = (D.vents ?? []).every((v: any) => grille.some((b: any) => Math.abs(b.c[0] - v.pos[0]) < 1e-9 && Math.abs(b.c[2] - v.pos[2]) < 1e-9 && (b.flags ?? []).includes('NoPrimary')));
    const last = D.boxes.slice(-grille.length).every((b: any) => b.group === 'ceiling.vents');
    F.verdict(errs.length === 0 && grille.length === (D.vents ?? []).length && under && last, 'the file validates clean; one NoPrimary grille box per vent right over its face (group ceiling.vents), and those boxes are the LAST in the list (no older index moved)', `${errs.length} errors · ${grille.length} grille boxes · under every vent ${under} · last ${last}`);
  }
  { const back = levelToData(L, { name: 'rt', materials: D.materials }); const L2 = loadLevel(back);
    const same = JSON.stringify(L.vents) === JSON.stringify(L2.vents) && JSON.stringify(back.vents) === JSON.stringify(D.vents);
    F.verdict(same, 'Level → data → Level keeps every vent field (size / period / duty / phase / mains written iff present) and data → Level → data gives the file\'s block back verbatim', same ? `${back.vents.length} vents both ways` : `L ${JSON.stringify(L.vents).slice(0, 120)} vs L2 ${JSON.stringify(L2.vents).slice(0, 120)}`);
  }
  { const d = JSON.parse(JSON.stringify(D)); delete d.vents; const errs: string[] = validateLevelData(d); const L0 = loadLevel(d);
    Math.random = seeded(5301); const W = await standUp(); const roster0 = new Wind({ level: L0, doors: W.game.doors } as any).all.map((s: any) => s.why);   // (Wind's constructor reads level.vents and doors.list, nothing else)
    F.verdict(errs.length === 0 && L0.vents === undefined && !roster0.includes('vent') && roster0.includes('storm'), 'a level file with no vents block validates and loads with `vents` absent; a Wind built on it has the storm and the door gusts and no vent', `errors ${errs.length} · vents ${L0.vents} · roster ${roster0.join(',')}`);
  }
  return F.done();
}

// ---------------------------------------------------------------- wind-identity
/** Three seeded minutes of the live floor: the shift patrolling with the AI on, Sam invisible in the west aisle; at 5 s a smoke can popped under the aisle vent (the
 *  throwables → the smoke stand-in), at 40 s a suppressed round into the corridor partition, at 80 s the server door kicked in, at 120 s a stun can. Per frame: every
 *  man's state / position / yaws / awareness / waypoint / wait / path, Sam, the event / message / item counts, the escalation, every leaf's angle, the smoke
 *  stand-in's emit count. */
async function identityRun(windK: number, extras: boolean): Promise<{ digest: string; frames: number; marks: string }> {
  Math.random = seeded(6601);
  const W = await standUp(); const { game } = W; const pl = game.player;
  game.godMode = true; game.aiEnabled = true;
  game.tune.wind = windK; game.tune.moths = extras;
  game.tune.civilians = true; ((await import(`${ROOT}/src/game/civilians.ts`)) as any).CIV.greet = true;   // THE PROFILE the frozen digest was taken under, pinned rather than inherited (see the note over EXPECT_IDENTITY): civilians on the floor WITH greetings —
                                                          // both were the defaults at the freeze and a probe run earlier in the same process can no longer tint them (probes.ts run() also restores the knob tables)
  let emits = 0; const emit0 = W.smoke.emit; W.smoke.emit = (e: any) => { emits++; return emit0.call(W.smoke, e); };
  for (let i = 0; i < 5; i++) W.step(DT);
  game.teleportPlayer([13.4, 0, 17.5]); game.playerInvisible = true; pl.crouch = true;
  const { fireWeapon } = await import(`${ROOT}/src/game/combat.ts`);
  const D = new Digest(); let marks = '';
  const FRAMES = 180 * 60;
  for (let frame = 0; frame < FRAMES; frame++) {
    pl.visibility = 0.02;
    if (frame === 5 * 60) game.items.spawn('smoke', [20.3, 1.0, 14.95], [0.2, 0, 0.1], { who: PLAYER_ID });    // a smoke can dropped under the aisle vent: its fuse, its plume into the smoke stand-in (the emit count is digested), the men who see it
    if (frame === 40 * 60) fireWeapon(game, pl.char, [16.0, 1.2, 12.3], true);                              // a suppressed round into the corridor partition
    if (frame === 80 * 60) { const d = game.doors.byName('server'); game.doors.kickIn(d, [17.7, 0, 10.9], PLAYER_ID); }   // the server door kicked through (heard floor-wide)
    if (frame === 120 * 60) game.items.spawn('flash', [19.5, 1.0, 16.0], [0, 0, 0.2], { who: PLAYER_ID });   // a stun can on the aisle: the bang, the dazzle, the search
    W.step(DT);
    for (const gd of game.guards) { D.add(gd.state); D.vec(gd.char.pos); D.num(gd.char.bodyYaw); D.num(gd.char.aimYaw); D.num(gd.awareness); D.num(gd.wp); D.num(gd.wait); D.num(gd.path.length); D.num(gd.pathI); }
    D.vec(pl.char.pos); D.num(game.events.length); D.num(game.messages.length); D.num(game.escalation); D.num(game.items.items.length); D.num(emits);
    for (const d of game.doors.list) D.num(d.angle);
    if (frame % 900 === 0) marks += game.guards.map((g: any) => `${g.state[0]}${g.wp}`).join('') + ' ';
  }
  return { digest: D.hex, frames: FRAMES, marks };
}
class Digest {
  h = 0x811c9dc5 >>> 0; n = 0;
  add(s: string) { for (let i = 0; i < s.length; i++) { this.h ^= s.charCodeAt(i); this.h = Math.imul(this.h, 0x01000193) >>> 0; } this.n++; }
  num(x: number | null | undefined) { this.add(x === null || x === undefined ? '~' : String(x)); }
  vec(p: number[] | null | undefined) { if (!p) { this.add('~'); return; } this.num(p[0]); this.num(p[1]); this.num(p[2]); }
  get hex() { return this.h.toString(16).padStart(8, '0'); }
}
export async function windIdentity(): Promise<boolean> {
  const F = family('wind-identity: tune.wind 0 ≡ tune.wind 1 ≡ moths off ≡ the digest frozen before wind.ts — three seeded minutes of the live floor (a can, a shot, a kick, a bang)');
  const A = await identityRun(1, true), B = await identityRun(0, false), C = await identityRun(1, false);
  if (PRINT) console.log(`\n--- measured (paste over EXPECT_IDENTITY) ---\nconst EXPECT_IDENTITY = ${JSON.stringify({ digest: B.digest, frames: B.frames, marks: B.marks })};\n`);
  F.verdict(A.digest === B.digest && B.digest === C.digest, 'wind 1 + moths, wind 0, wind 1 alone: the same per-frame digest of everybody\'s state / position / yaws / awareness / waypoints / paths, Sam, events / messages / items / escalation, every leaf, the smoke emit count', `${A.digest} · ${B.digest} · ${C.digest} over ${A.frames} frames · ${A.marks}`);
  const E = EXPECT_IDENTITY;
  F.verdict(B.digest === E.digest && B.frames === E.frames, 'and equal to the digest FROZEN on main at the wind merge (2026-08-12; before that ac2c4aa): the CPU game is byte for byte what it was', `${B.digest}${B.digest === E.digest ? '' : ` — want ${E.digest} (marks then: ${E.marks}| now: ${B.marks})`}`);
  return F.done();
}
// frozen by running this file's identityRun (`wind-identity --print` regenerates the literal): first on main @ ac2c4aa (4eeafb73), re-baselined at the wind merge into main on 2026-08-12 (354b99f6)
// PROVENANCE / PROFILE of 354b99f6 (everything the seeded three minutes depend on besides wind — a change to any of these legitimately moves it; re-freeze with --print and say which):
//   headless.ts standUp defaults: tune.chaos 0 (destruction off), aiEnabled, the office level at its 782-box export (levelFingerprint as at the wind merge), the smoke stand-in;
//   PINNED in identityRun: tune.civilians true + CIV.greet true (Marta and Owen on the floor, greetings on — the defaults at the freeze; the wave-3 review found the run pinned
//   neither and a CIV.greet left false by civilians-identity earlier in an `all` process would have moved it silently), godMode, Sam invisible + crouched at (13.4, 17.5);
//   INHERITED defaults (not pinned, all ON at the freeze): tune.tactics, tune.needs, tune.devices / lasers, tune.bodyLight, tune.qrf (never triggers: nothing loud enough),
//   tune.whistle, tune.aimModel, TALK_TUNE.scripts; Math.random = seeded(6601) for the whole run.
//   History: 4eeafb73 on main @ ac2c4aa (pre-wind) → 354b99f6 at the wind merge; the move was BISECTED by the wave-3 review to game-core-A's intended changes alone (routed
//   sub-gunshot placement, the capped colleague shove) — the tools / cleanup / game-B / world / gi / wind merges each left it untouched.
const EXPECT_IDENTITY = {"digest":"354b99f6","frames":10800,"marks":"p0p0p0 s1p2s1 s1p5s1 s1s7s1 p3p2s1 p5p5p2 a6a6a2 s6s6s2 s6s6s2 s6s6s2 s6s6p2 s6p6s2 "};   // re-baselined at the merge into main (2026-08-12): the lane froze 4eeafb73 on main @ ac2c4aa, but the review fix lanes merged since (civilian hostage, bodies by light, sealed smoke, wall-exit sound propagation) legitimately move this seeded run — bisected by the wave-3 review: it is game-core-A's intended changes alone (the routed sub-gunshot placement and the capped colleague shove in the staged shot / kick / bang minutes); the tools, cleanup, game-B, world, gi and wind merges each left it untouched; the guard that matters — wind 0 ≡ wind 1 ≡ motes off — is the verdict above and held on the merged tree
