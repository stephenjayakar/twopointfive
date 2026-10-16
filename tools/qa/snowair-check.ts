// ONE SNOW IN ONE AIR (SNOW_LOOK.oneAir; ?snowair=0, TPS_SNOWAIR=1) — game/snowFx.ts oneAirOn / oneAirCfg, particles.wgsl snowAir, game/snowBlast.ts
// snowBlastThrow. The maintainer after tuning the pass on his GPU, 10-15: the blown grains "look like the flakes but seem to behave differently. we should
// probably just unify those systems"; the wisps "should show up when the wind is sufficiently strong".
//
//   bun run tools/qa/snowair-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWAIR_BREAK=1 …                                  = the switch never raised and the same lines asked: must fail
//   TPS_PROFILE=shipped …                              = the same on the stand the page opens on
//
//   stands    held off on the frozen stand, on as the page opens; a recording from before the key replays with it off
//   numbers   the maintainer's flake numbers are the defaults, and what they ask is past the cap (the look he passed is the cap's worth)
//   one       with it on and a field to read: no grain is filed, the particle step is handed the one air's numbers, the flakes keep their whole cap
//   wisps     a wisp is lifted by the air: filed at the air's own speed; none while no ground's air can reach the lift speed
//   throw     a blast throws its loose snow as flakes (no grains to throw)
//   off       the switch off: the grains, the gust patches and the wisps' own speed, as they were
//   noair     no field to read: the snow is the flakes and the wisps as before the grains — nothing asks for one air
//   digest    the game does not know: one game digest with it on and off
//   text      the shaders carry the rule
//
// HEADLESS: no GPU — what a flake does in the field (snowAir, the skip, a wisp's birth and death by the air's speed) is WGSL nothing here runs; the text line
// holds its shape, a page boot proves it compiles, and only the maintainer's GPU shows it.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowAirCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK, WEATHER_PRESETS } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const SF = await import(`${ROOT}/src/game/snowFx.ts`);
  const { updateSnowFx, seedSnow, SNOWFX, SNOWWISPS, snowStats, wispStats, grainStats, oneAirActive } = SF;
  const { SNOWBLAST, snowBlastAt, snowBlastStats } = await import(`${ROOT}/src/game/snowBlast.ts`);
  const { AIR_SIM, updateAirSim, airSimStats } = await import(`${ROOT}/src/game/airSim.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWAIR_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  const hush = <T>(fn: () => T): T => { if (o.verbose) return fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWAIR', 'TPS_SNOWBLAST', 'TPS_SNOWTRACKS', 'TPS_SNOWGRAINS', 'TPS_SNOWWISPS', 'TPS_AIR'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, air: AIR_SIM.on, cfg: snowConfig.on, lookW: snowLookConfig.wisps, lookG: snowLookConfig.grains, env: ENV.map(k => process.env[k]), liftLo: SNOWWISPS.liftLo };

  const mkAir = () => ({ w: 200, h: 140, cells: 0, sources: 0, resets: 0, last: 0, setCells(_m: Uint8Array) { this.cells++; }, setSources(_r: Float32Array, n: number) { this.sources++; this.last = n; }, reset() { this.resets++; } });
  /** a game stood up on `file` in snow with the wisps, the grains, the blast and the air up, the one air's switch where `on` says — by the stand's own words.
   *  `word` false: no word for it at all (the stand as it is). `air` false: no field (AIR_SIM off, none handed to the engine). */
  async function rig(file: string, on: boolean, word = true, air = true) {
    const sw = on && !BREAK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; process.env.TPS_SNOWTRACKS = '1'; process.env.TPS_SNOWGRAINS = '1'; process.env.TPS_SNOWWISPS = '1'; process.env.TPS_SNOWBLAST = '1'; process.env.TPS_AIR = air ? '1' : '0';
    if (word) { process.env.TPS_SNOWAIR = sw ? '1' : '0'; SNOW_LOOK.oneAir = !sw; }   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    else { delete process.env.TPS_SNOWAIR; SNOW_LOOK.oneAir = harnessProfile() === 'shipped' ? was.look.oneAir : true; }
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood: boolean = SNOW_LOOK.oneAir;
    const e = g.engine as any; if (air) { e.air = mkAir(); e.airWind = [0, 0]; e.airOn = false; } else { e.air = null; }
    const set = () => { SNOW_LOOK.oneAir = sw; SNOW_LOOK.on = true; SNOW_LOOK.tracks = true; SNOW_LOOK.grains = true; SNOW_LOOK.wisps = true; SNOW_LOOK.blast = true; AIR_SIM.on = air; }; set();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { set(); W.step(DT); } };
    return { W, g, e, step, set, stood, sw };
  }
  /** a recording stand-in for the particle pool, with the grains' numbers at their real length */
  const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 }, grainCfg: new Float32Array(28).fill(-1), cleared: 0,
      emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], dir: [...dir], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
      draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
      clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
  const aspect = (r: any) => r.opts.aspect ?? 1;
  const isGrain = (r: any) => aspect(r) > 2.5, isWisp = (r: any) => aspect(r) > 1.5 && aspect(r) < 2.5 && !(Array.isArray(r.opts.color) && r.opts.color[2] === 0), isThrow = (r: any) => aspect(r) < 1.5 && r.dir[1] > 0.5;
  /** the recycler run `frames` drawn frames against `pool` with the view at `target`; `each(i)` runs before frame i; `play` steps the game too */
  const fly = (R: any, pool: { P: any; recs: any[] }, frames: number, target: number[], each?: (i: number) => void, play = false) => {
    const { P } = pool; const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
    seedSnow(R.g, 1); snowConfig.on = true; snowLookConfig.wisps = true; snowLookConfig.grains = true;
    for (let i = 0; i < frames; i++) {
      if (play) R.step(1);
      R.set(); each?.(i); if (!play) updateAirSim(R.g, DT);
      e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true;
      P.draw(); updateSnowFx(R.g, DT, { distance: 21, target } as any);
      e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr;
    }
    return Array.from(P.grainCfg as Float32Array);
  };
  const Y = [20, 0, 16];   // the pass's yard

  try {
    // ---- stands
    { const N = await rig('pass.json', true, false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig('pass.json', false); const U = await rig('pass.json', true); const row = FROZEN_HOLDS['SNOW_LOOK.oneAir']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOW_LOOK.oneAir = true; const carries = 'oneAir' in (snap().tables.SNOW_LOOK ?? {}); const old = snap(); delete old.tables.SNOW_LOOK.oneAir; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOW_LOOK.oneAir;
      SNOW_LOOK.oneAir = true; const own = snap(); SNOW_LOOK.oneAir = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOW_LOOK.oneAir;
      verdict(bare === shipped && J.stood === false && U.stood === true && typeof row === 'string' && /TPS_SNOWAIR=1/.test(row) && carries && without === false && withIt === true,
        'stands — held off on the frozen stand, on as the page opens; a recording from before the key replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWAIR=0 → ${J.stood}, =1 → ${U.stood} · FROZEN_HOLDS['SNOW_LOOK.oneAir'] = ${row ? `'${row.slice(0, 13)}…'` : 'no row'} · the journal carries the key: ${carries}; applyKnobs with no \`oneAir\` key → ${without}, with it on → ${withIt}`); }

    // ---- one (and numbers, off the same run)
    const A = await rig('pass.json', true); A.step(3); const pa = mk(); const ca = hush(() => fly(A, pa, 40, Y));
    const B = await rig('pass.json', false); B.step(3); const pb = mk(); const cb = hush(() => fly(B, pb, 40, Y));
    { const S = { ...snowStats(A.g) }, G = { ...grainStats(A.g) }; const So = { ...snowStats(B.g) }, Go = { ...grainStats(B.g) }; const count = Number((A.g.engine as any).settings.particleRainCount ?? 4000);
      const want = SNOWFX.perM2 * WEATHER_PRESETS.snow.snow * S.areaOut;
      verdict(A.sw && SNOWFX.perM2 === 34.6 && SNOWFX.size === 0.028 && SNOWFX.flutter === 0.41 && SNOWFX.iso === 0.26 && WEATHER_PRESETS.snow.snow === 1.48 && S.capped === true && want > 3 * S.target && S.target <= count + 1e-6,
        'numbers — the maintainer\'s flake numbers are the defaults, and what they ask is past the cap',
        `perM2 ${SNOWFX.perM2} · size ${SNOWFX.size} · flutter ${SNOWFX.flutter} · iso ${SNOWFX.iso} · the weather's snowfall ${WEATHER_PRESETS.snow.snow} · over the yard's ${S.areaOut.toFixed(0)} m² they ask ${want.toFixed(0)} flakes; the cap gives ${S.target.toFixed(0)} (capped: ${S.capped}; the tier's count ${count})`);
      const grainsA = pa.recs.filter(isGrain).length, grainsB = pb.recs.filter(isGrain).length;
      const nums = ca[20] === 1 && Math.abs(ca[21] - SNOWWISPS.liftLo) < 1e-6 && Math.abs(ca[22] - SNOWWISPS.liftHi) < 1e-6 && Math.abs(ca[23] - SNOWFX.skid) < 1e-6 && Math.abs(ca[24] - SNOWFX.airLow) < 1e-6 && Math.abs(ca[25] - SNOWFX.airHigh) < 1e-6 && Math.abs(ca[26] - SNOWFX.airLift) < 1e-6 && Math.abs(ca[27] - SNOWWISPS.dropK) < 1e-6;
      verdict(A.sw && oneAirActive(A.g) === true && grainsA === 0 && G.active === false && ca[7] === 1 && ca[0] > 0.1 && ca[11] === 0 && nums && S.target >= So.target && grainsB > 0 && Go.active === true && cb[20] === 0 && A.e.air.sources > 0,
        'one — with it on no grain is filed, the particle step is handed the one air\'s numbers, and the flakes keep their whole cap',
        `one air in force: ${oneAirActive(A.g)} · grain records ${grainsA} (off: ${grainsB}); the grains: ${G.why} · grainCfg[7] field ${ca[7]}, [0] the ground's air ${ca[0].toFixed(2)} m/s, [20‥27] ${ca.slice(20, 28).map(v => +v.toFixed(2)).join(' ')} · the field was fed its sources ${A.e.air.sources} time(s) · the flakes' target ${S.target.toFixed(0)} (with the grains taking their slots: ${So.target.toFixed(0)})`); }

    // ---- wisps
    { const Ws = { ...wispStats(A.g) }; const wis = pa.recs.filter(isWisp); const La = pa.P.rainLook.refractReachM, Lb = pb.P.rainLook.refractReachM; const air = airSimStats(A.g);
      SNOWWISPS.liftLo = 50; const C = await rig('pass.json', true); C.step(3); const pc = mk(); hush(() => fly(C, pc, 40, Y)); const Wc = { ...wispStats(C.g) }; const none = pc.recs.filter(isWisp).length; SNOWWISPS.liftLo = was.liftLo;
      verdict(A.sw && wis.length > 5 && Ws.active && La === SNOWFX.windK && Lb === SNOWWISPS.speedK && La !== Lb && Ws.blow === 1 && none === 0 && Wc.active === false && /too slow/.test(Wc.why) && SNOWWISPS.liftLo < SNOWWISPS.liftHi && air.speed * 1.5 > SNOWWISPS.liftLo,
        'wisps — a wisp is snow the air lifts: filed at the air\'s own speed, none while no ground\'s air can reach the lift speed',
        `the ground's air ${air.speed.toFixed(2)} m/s (${air.calm.toFixed(2)} with no gust) against lift ${SNOWWISPS.liftLo} ‥ ${SNOWWISPS.liftHi} m/s: ${wis.length} wisp records in 40 frames (${Ws.why}), every one thinned by its own ground's air on the GPU · their speed × ${La} (the flakes' own; off: × ${Lb}) · the gusts' count factor ${Ws.blow} (the air's speed is the gust) · with the lift speed out of reach (50 m/s): ${none} records, "${Wc.why}"`); }

    // ---- throw
    { const T = await rig('pass.json', true); T.step(3); const pt = mk(); let hit = false; const ct = hush(() => fly(T, pt, 12, Y, (i) => { if (i === 4) hit = snowBlastAt(T.g, [Y[0], 0.2, Y[2]], 2.5); })); const thr = pt.recs.filter(isThrow); const n = thr.reduce((a, r) => a + r.count, 0); const st = snowBlastStats(T.g);
      const O = await rig('pass.json', false); O.step(3); const po = mk(); hush(() => fly(O, po, 12, Y, (i) => { if (i === 4) snowBlastAt(O.g, [Y[0], 0.2, Y[2]], 2.5); })); const thrO = po.recs.filter(isThrow).length;
      const near = thr.every(r => Math.hypot(r.pos[0] - Y[0], r.pos[2] - Y[2]) < 1e-6 && r.opts.radius < 2.5 && r.pos[1] < 1 && r.opts.size === SNOWFX.size);
      verdict(T.sw && hit && n > 0 && n <= SNOWBLAST.flakes && st.thrown === n && near && ct[11] === 0 && thrO === 0,
        'throw — a blast throws its loose snow up as flakes, where the grains would have been',
        `a frag's blast in the yard marked the snow: ${hit} · ${thr.length} record(s), ${n} flakes of ${SNOWBLAST.flakes} going up from its disc (radius ${thr[0]?.opts.radius?.toFixed(2) ?? '—'} m, a flake's own size: ${near}) · no grain throw is handed over (grainCfg[11] ${ct[11]}) · with the switch off: ${thrO} flake records going up (the grains' throw stands)`); }

    // ---- off
    { const Gs = { ...grainStats(B.g) }, Ws = { ...wispStats(B.g) };
      verdict(B.sw === false && oneAirActive(B.g) === false && cb[20] === 0 && pb.recs.some(isGrain) && Gs.active && pb.P.rainLook.refractReachM === SNOWWISPS.speedK && pb.recs.filter(isThrow).length === 0,
        'off — the switch off: the grains, and the wisps at their own speed, as they were',
        `one air in force: ${oneAirActive(B.g)} · grainCfg[20] ${cb[20]} · grains ${Gs.why} (${pb.recs.filter(isGrain).length} records) · wisps ${Ws.why}, speed × ${pb.P.rainLook.refractReachM}`); }

    // ---- noair
    { const N = await rig('pass.json', true, true, false); N.step(3); const pn = mk(); const cn = hush(() => fly(N, pn, 20, Y)); const S = { ...snowStats(N.g) }, Ws = { ...wispStats(N.g) };
      verdict(N.sw && oneAirActive(N.g) === false && cn[20] === 0 && S.active && pn.recs.some(r => aspect(r) < 1.5) && !pn.recs.some(isGrain) && pn.P.rainLook.refractReachM === SNOWWISPS.speedK,
        'noair — with no field to read the snow is the flakes and the wisps as before the grains',
        `no air field: one air in force ${oneAirActive(N.g)}, grainCfg[20] ${cn[20]} · flakes ${S.why} · wisps ${Ws.why} at their own speed × ${pn.P.rainLook.refractReachM} · grain records ${pn.recs.filter(isGrain).length}`); }

    // ---- digest
    { const run = async (on: boolean) => { const D = await rig('pass.json', on); D.step(3); const pool = mk(); hush(() => fly(D, pool, 200, Y, undefined, true)); return { h: hashDigest(digestGame(D.g)), one: oneAirActive(D.g) }; };
      const d1 = await run(true), d0 = await run(false);
      verdict(d1.h === d0.h && d1.one === true && d0.one === false, 'digest — the game does not know: one digest with one snow in one air and without', `200 frames of the pass: on ${d1.h} (in force: ${d1.one}) · off ${d0.h} (in force: ${d0.one})`); }

    // ---- text
    { const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8'); const step = read('particles.wgsl'); const pts = readFileSync(resolve(ROOT, 'src/render/particles.ts'), 'utf8');
      const cfg = /struct GrainCfg \{ a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f \};/.test(step) && /makeBuffer\(device, 112, [^)]*'particleGrains'\)/.test(pts) && /grainCfg = new Float32Array\(28\)/.test(pts);
      const gate = /fn snowOneAir\(\) -> bool \{ if \(SNOW_GRAINS\) \{ return grain\.f\.x > 0\.5 && grain\.b\.w > 0\.5; \} return false; \}/.test(step);
      const air = /fn snowAir\(p: vec3f, free: vec3f\) -> vec3f \{\s*if \(SNOW_GRAINS\) \{[\s\S]{0,400}let A = airAt\(p\.xz\);[\s\S]{0,300}smoothstep\(grain\.g\.x,[\s\S]{0,200}return mix\(low, free, b\);\s*\}\s*return free;/.test(step);
      const flake = /if \(SNOW_GRAINS\) \{ if \(snowNow\(\) && snowOneAir\(\)\) \{ vAir = snowAir\(p\.pos, vAir\); \} \}/.test(step);
      const skip = /rnd\(p\.seed, 500u \+ kk\) < grain\.f\.w \* smoothstep\(grain\.f\.y,/.test(step) && /if \(!skips\) \{ pool\.parts\[slot\]\.age = p\.life; return; \}/.test(step);
      const born = /wispRec && ok && !puffRec && snowOneAir\(\)\) \{ let Aq = airAt\(q2\); ok = Aq\.w > 0\.5 && rnd\(seed, 400u\) < smoothstep\(grain\.f\.y,/.test(step) && /wispRec && ok && !puffRec && !snowOneAir\(\)\) \{ ok = rnd\(seed, 200u \+ t\) < wispGust/.test(step);
      const dies = /snowOneAir\(\) && \(\(p\.color >> 16u\) & 255u\) != 0u && length\(airAt\(p\.pos\.xz\)\.xy\) < grain\.g\.w \* grain\.f\.y/.test(step);
      const rides = /if \(snowOneAir\(\)\) \{ one = true; av = snowAir\(pos, a\)/.test(step);
      verdict(A.sw && cfg && gate && air && flake && skip && born && dies && rides, 'text — the shaders: one air for the flake and the wisp, a wisp born and gone by its ground\'s air, a flake that skips on',
        `GrainCfg carries seven rows in a 112-byte buffer: ${cfg} · the gate is the switch AND a field: ${gate} · snowAir blends the field under the walls' height into the open wind over it: ${air} · the flake's step reads it: ${flake}; a landing flake may skip on: ${skip} · a wisp is born by its ground's air (and by the gust patches only without it): ${born}; it goes where that air slows: ${dies}; it rides the same air: ${rides}`); }
  } finally {
    SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); AIR_SIM.on = was.air; snowConfig.on = was.cfg; snowLookConfig.wisps = was.lookW; snowLookConfig.grains = was.lookG; SNOWWISPS.liftLo = was.liftLo;
    ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nsnowair-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWAIR_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowAirCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
