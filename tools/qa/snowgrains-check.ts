// FINE GRAINS OF BLOWN SNOW NEAR THE VIEW ARE THE PICTURE'S ALONE, AND FLY ONLY WHERE THERE IS AN AIR FIELD FOR THEM TO RIDE (src/game/weatherKinds.ts
// SNOW_LOOK.grains, src/game/snowFx.ts SNOWGRAINS / updateGrains, the air they ride: src/game/airSim.ts → render/airField.ts; the particle shaders' half behind
// the prelude's `const SNOW_GRAINS`).
//
//   bun run tools/qa/snowgrains-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWGRAINS_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snowgrains      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switches where each line needs them by the stand's own words —
//   TPS_SNOWGRAINS, TPS_AIR (the air field's), TPS_SNOWWISPS (up throughout: the wisps share the ring), TPS_SNOW.
//
// The harness has no GPU: where a grain lies and when it flies is the GPU's, off a field the GPU solves. What is proven HERE is what the CPU files into the
// flakes' ring and hands the shaders, against a recording stand-in pool and a recording stand-in field, and what the shader text says — never a grain seen.
//   stands    the frozen stand holds the switch off and TPS_SNOWGRAINS=1 raises it, the shipped stand has it on; FROZEN_HOLDS has the row; a recording whose
//             SNOW_LOOK has no `grains` key replays with it off (journal.ts applyKnobs)
//   runs      the pass, grains and air on: records of the flakes' disc shape with aspect 3 (what the GPU tells a grain by), SNOWGRAINS.radius about the view —
//             a first set of grainCap × density with lives spread from nothing to a flake's (life half a slot's, lifeJit 1), then a steady trickle with the
//             whole life; the reckoned population climbs to the target and stays; the grains' numbers reach the pool's grainCfg ([1] radius, [6] speedK,
//             [7] 1: there is air)
//   still     the wind's master at 0: nothing filed, grainCfg[7] 0, and the reason says so
//   noair     the switch on with no field on the engine, or with the air's own switch off: not one grain record, and the flakes' and the wisps' records are
//             those of a run with the grains off, record for record
//   off       the switch off: not one grain record, grainCfg[7] 0
//   budget    the ring is shared (render/particles.ts RAIN_CAP): the flakes' target and cap and the wisps' cap with the grains on and off — the flakes keep
//             at least three fifths of theirs
//   others    another level, switches on: nothing filed
//   digest    the game does not know: 300 stepped frames of the pass, grains on and off — one game digest
//   dead      every grain statement in the particle shaders stands behind SNOW_GRAINS; a wisp is aspect 2 and no longer 3; the shader's cells a metre are the field's
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowGrainsCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { updateSnowFx, snowStats, wispStats, grainStats, grainsOn, seedSnow, SNOWFX, SNOWWISPS, SNOWGRAINS } = await import(`${ROOT}/src/game/snowFx.ts`);
  const { AIR_SIM, updateAirSim, airSimStats, airLive } = await import(`${ROOT}/src/game/airSim.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const { RAIN_CAP } = await import(`${ROOT}/src/render/particles.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWGRAINS_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWGRAINS', 'TPS_SNOWWISPS', 'TPS_AIR', 'TPS_SNOWAIR'] as const;
  const wasOneAir = SNOW_LOOK.oneAir;
  const was = { snow: SNOW.on, grains: SNOW_LOOK.grains, wisps: SNOW_LOOK.wisps, air: AIR_SIM.on, cfg: snowConfig.on, lookW: snowLookConfig.wisps, lookG: snowLookConfig.grains, env: ENV.map(k => process.env[k]) };

  /** the recording stand-in for the engine's air field (render/airField.ts AirField's face, as airSim.ts calls it) */
  const mkAir = () => ({ w: 200, h: 140, cells: 0, sources: 0, resets: 0, setCells(_m: Uint8Array) { this.cells++; }, setSources(_r: Float32Array, _n: number) { this.sources++; }, reset() { this.resets++; } });
  /** a game stood up on `file` in snow, the grains' switch where `on` says and the air's where `air` says — by the stand's own words, so the frozen stand's pins and
   *  the shipped stand's boot both obey. `air`: 'field' = the air's switch up and a field on the engine (a page with a GPU); 'none' = the switch up and no field
   *  (the harness as it is; a device that could not build one); 'off' = a field there and the switch down (`?air=0` would not even build it). `word` false: no
   *  word for the grains at all — the stand as it is. */
  async function rig(file: string, on: boolean, air: 'field' | 'none' | 'off' = 'field', word = true) {
    const sw = on && !BREAK, airSw = air !== 'off';
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWWISPS = '1'; process.env.TPS_AIR = airSw ? '1' : '0'; AIR_SIM.on = !airSw;
    process.env.TPS_SNOWAIR = '0';
    if (word) { process.env.TPS_SNOWGRAINS = sw ? '1' : '0'; SNOW_LOOK.grains = !sw; }   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    else { delete process.env.TPS_SNOWGRAINS; SNOW_LOOK.grains = harnessProfile() === 'shipped' ? was.grains : true; }   // (frozen: left up, for the stand's pin to put down; shipped: as the page's boot left it when the harness loaded — headless.ts shippedBoot, once — which no stand-up touches)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood: boolean = SNOW_LOOK.grains, stoodAir: boolean = AIR_SIM.on;
    const e = g.engine as any; const field = mkAir(); if (air !== 'none') { e.air = field; e.airWind = [0, 0]; e.airOn = false; }
    const set = () => { SNOW_LOOK.oneAir = false; SNOW_LOOK.grains = sw; SNOW_LOOK.wisps = true; AIR_SIM.on = airSw; }; set();   // (the grains as a layer of their own: one snow in one air — snowair-check.ts — stands them down)
    const step = (n = 1) => { for (let i = 0; i < n; i++) { set(); W.step(DT); } };
    return { W, g, e, field, step, set, stood, stoodAir, sw, wx: g.weather as any };
  }
  /** a recording stand-in for the particle pool (the harness's engine has none: no GPU) — it keeps the pool's own order: emit() files a record (twelve at most), a
   *  DRAWN frame takes what was filed (640 births at most) and only then counts it. grainCfg is left at −1 throughout: what the recycler does not write shows. */
  const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 }, grainCfg: new Float32Array(8).fill(-1), cleared: 0,
      emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
      draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
      clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
  const aspect = (r: any) => r.opts.aspect ?? 1; const isGrain = (r: any) => aspect(r) > 2.5, isWisp = (r: any) => aspect(r) > 1.5 && aspect(r) < 2.5, isFlake = (r: any) => aspect(r) < 1.5;
  const sum = (rs: any[]) => rs.reduce((n, r) => n + r.count, 0);
  /** the recycler run `frames` drawn frames against a fresh pool with the view at `target` — the pool on the engine only for the recycler's own call (the rest of the
   *  game has no pool to file into on this harness, as ever). `play`: the GAME is stepped a frame before each (the digest line: its own poolless pass over the
   *  recycler stands the grains down every frame, so the first set is owed again each time — records are filed all the same); else the game stands still, the
   *  storm's gust is held at `gust` (null: the wind as the game left it) and the air's feed is run here as game.ts runs it, ahead of the recycler */
  const fly = (R: any, frames: number, target: number[], gust: number | null = null, play = false) => {
    const { P, recs } = mk(); const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
    seedSnow(R.g, 1); snowConfig.on = true; snowLookConfig.wisps = true; snowLookConfig.grains = true;   // (a page whose shaders were built for snow, its wisps and its grains: the recycler files none otherwise)
    const storm = R.g.wind.byName('storm'); const pop: number[] = []; let ran = 0;
    for (let i = 0; i < frames; i++) {
      if (play) R.step(1);
      if (gust !== null && storm) { storm.speed = storm.base * gust; storm.gust = gust; }   // (the wind's own gusting held where the line needs it: wind.ts wrote this frame's a moment ago)
      R.set(); if (!play) updateAirSim(R.g, DT);
      e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true;
      if (grainsOn(R.g)) ran++;
      P.draw(); updateSnowFx(R.g, DT, { distance: 21, target } as any);
      e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr;
      pop.push(grainStats(R.g).pop);
    }
    return { P, recs, pop, ran, grains: recs.filter(isGrain), wisps: recs.filter(isWisp), flakes: recs.filter(isFlake), S: { ...snowStats(R.g) }, Ws: { ...wispStats(R.g) }, Gs: { ...grainStats(R.g) } };
  };
  /** what the ring leaves each kind at most: the same two frames with the snowfall and the wisps asked for a thousandfold and the panel's flake count out of the way */
  const most = (R: any, target: number[]) => { const set = R.g.engine.settings; const keep = { f: SNOWFX.perM2, w: SNOWWISPS.perM2, c: set.particleRainCount };
    SNOWFX.perM2 *= 1000; SNOWWISPS.perM2 *= 1000; set.particleRainCount = 1e9; let r; try { r = fly(R, 2, target, 1); } finally { SNOWFX.perM2 = keep.f; SNOWWISPS.perM2 = keep.w; set.particleRainCount = keep.c; }
    return { flakes: r.S.target, wisps: r.Ws.target }; };

  try {
    // ---- stands
    { const N = await rig('pass.json', true, 'field', false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig('pass.json', false); const row = FROZEN_HOLDS['SNOW_LOOK.grains']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOW_LOOK.grains = true; const carries = 'grains' in (snap().tables.SNOW_LOOK ?? {}); const old = snap(); delete old.tables.SNOW_LOOK.grains; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOW_LOOK.grains;
      SNOW_LOOK.grains = true; const own = snap(); SNOW_LOOK.grains = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOW_LOOK.grains;
      SNOW_LOOK.grains = true; const older = snap(); delete older.tables.SNOW_LOOK; await quiet(() => JOURNAL.applyKnobs(J.g, older)); const noTable = SNOW_LOOK.grains;
      verdict(bare === shipped && J.stood === false && J.stoodAir === true && typeof row === 'string' && /TPS_SNOWGRAINS=1/.test(row) && carries && without === false && withIt === true && noTable === false,
        'stands — held off on the frozen stand, on as the page opens; a recording from before the key replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWGRAINS=0 → ${J.stood} (TPS_AIR=1 → the air ${J.stoodAir}) · FROZEN_HOLDS['SNOW_LOOK.grains'] = ${row ? `'${row.slice(0, 16)}…'` : 'no row'} · the journal carries the key: ${carries}; applyKnobs with no \`grains\` key → ${without}, with it on → ${withIt}, with no SNOW_LOOK table → ${noTable}`); }

    const A = await rig('pass.json', true); A.step(3);
    // the view over the yard's open ground (the open point nearest the world's centre)
    let at: number[] | null = null; { const cx = (WORLD.min[0] + WORLD.max[0]) / 2, cz = (WORLD.min[2] + WORLD.max[2]) / 2; let best = 1e9;
      for (let x = WORLD.min[0] + 2; x < WORLD.max[0] - 2; x += 1) for (let z = WORLD.min[2] + 2; z < WORLD.max[2] - 2; z += 1) { if (A.wx.underRoof(x, z)) continue; const d = Math.hypot(x - cx, z - cz); if (d < best) { best = d; at = [x, 0, z]; } } }
    const yard = at ?? [20, 0, 14];
    const key = (r: any) => `${aspect(r)}:${r.count}:${r.pos[1]}:${r.opts.lift}:${r.opts.seed}:${r.opts.radius}:${r.opts.life}`;
    const part = (a: string[], b: string[]) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i; return -1; };
    const FRAMES = 240;
    // ---- runs
    const on = fly(A, FRAMES, yard, 1);
    { const G = on.grains, K = SNOWGRAINS; const cap = Math.max(0, Math.min(6000, Math.round(K.max))); const dens = Math.max(0, Math.min(1, typeof A.e.settings.particleRainDensity === 'number' ? A.e.settings.particleRainDensity : 1));
      const want = Math.round(cap * dens); const slot = on.flakes[0]?.opts.life ?? NaN;   // (a grain's slot is filed with a flake's life: the ring retires in order)
      const first = G.filter(r => r.opts.lifeJit === 1), trickle = G.filter(r => r.opts.lifeJit === 0);
      const shape = G.every(r => r.kind === 'rain' && r.opts.shape === 'rainDisc' && r.opts.radius === K.radius && r.opts.aspect === 3 && r.opts.size === K.size && r.pos[0] === yard[0] && r.pos[2] === yard[2] && r.pos[1] < 0.6);
      const lives = first.length + trickle.length === G.length && first.every(r => r.opts.life === slot * 0.5) && trickle.every(r => r.opts.life === slot);
      const others = new Set([...on.flakes, ...on.wisps].map(r => r.opts.seed)); const own = G.every(r => !others.has(r.opts.seed)) && new Set(G.map(r => r.opts.seed)).size === G.length;
      const full = on.pop.findIndex(p => p >= want), climbs = on.pop.every((p, i) => i === 0 || p >= on.pop[i - 1]), stays = full >= 0 && on.pop.slice(full).every(p => p === want);
      const perSec = sum(trickle) / (FRAMES * DT), rate = want / slot; const c = on.P.grainCfg;
      verdict(A.stood === true && on.ran === FRAMES && on.Gs.active && on.Gs.air === true && on.Gs.target === want && want > 500 && G.length > 100 && shape && lives && own && sum(first) === want && Math.abs(perSec - rate) < 0.15 * rate + 2 && climbs && stays && full > 0 && full < 120
          && c[1] === Math.max(1, K.radius) && c[6] === K.speedK && c[7] === 1 && c[0] === Math.fround(Math.max(on.Gs.u0, K.minAir)) && on.Gs.u0 > 0 && on.Gs.totalBirths === sum(G),
        'runs — on the pass, with air to ride, the ring holds the grains: a first set through the whole of a slot\'s life, then a steady trickle',
        `the stand's word raised the switch before the Game was built: ${A.stood} · ${on.Gs.why}, grainsOn on ${on.ran} of ${FRAMES} frames · target ${on.Gs.target} (cap ${cap} × density ${dens}) · ${G.length} records, every one the disc at ${K.radius} m about the view, aspect 3, size ${K.size}: ${shape} · the first set ${first.length} records, ${sum(first)} grains at life ${(slot * 0.5).toFixed(2)} s ± all of it; the trickle ${trickle.length} records, ${sum(trickle)} grains at a slot's ${slot.toFixed(2)} s (${perSec.toFixed(0)}/s; target ÷ life = ${rate.toFixed(0)}/s): ${lives} · seeds their own: ${own} · the reckoned population ${on.pop[0]} at frame 1, ${want} from frame ${full + 1} on, never down: ${climbs && stays} · grainCfg [${Array.from(c as Float32Array).map(v => +v.toFixed(3)).join(', ')}] ([1] radius ${K.radius}, [6] speedK ${K.speedK}, [7] air; [0] the wind's own speed ${on.Gs.u0.toFixed(3)} m/s)`); }
    // ---- budget (the ring is shared)
    const B = await rig('pass.json', false); B.step(3);
    const off = fly(B, FRAMES, yard, 1);
    { const mOn = most(A, yard), mOff = most(B, yard); const panel = typeof A.e.settings.particleRainCount === 'number' ? A.e.settings.particleRainCount : 4000;
      const capOn = Math.min(panel, mOn.flakes), capOff = Math.min(panel, mOff.flakes);
      verdict(off.S.target > 0 && on.S.target >= 0.6 * off.S.target && capOn >= 0.6 * capOff && mOn.wisps > 0,
        'budget — the ring is shared: with the grains in it the flakes keep at least three fifths of theirs',
        `the ring ${RAIN_CAP} slots · FLAKES over the yard: target ${on.S.target.toFixed(0)}${on.S.capped ? ' (capped)' : ''} with the grains, ${off.S.target.toFixed(0)}${off.S.capped ? ' (capped)' : ''} without (${(100 * on.S.target / Math.max(1, off.S.target)).toFixed(0)} %); their cap ${capOn.toFixed(0)} with, ${capOff.toFixed(0)} without (the ring's room for them ${mOn.flakes.toFixed(0)} / ${mOff.flakes.toFixed(0)}, the panel's count ${panel}) · WISPS: cap ${mOn.wisps.toFixed(0)} with, ${mOff.wisps.toFixed(0)} without (× wispsKeep ${SNOWGRAINS.wispsKeep}); target in this blow ${on.Ws.target.toFixed(0)} / ${off.Ws.target.toFixed(0)} · GRAINS: ${on.Gs.target} slots with, ${off.Gs.target} without`); }
    // ---- still: the wind's master at 0 (the game stepped so that wind.ts and the air's feed have seen it)
    { const g = A.g; const t0 = g.tune.wind; g.tune.wind = 0; A.step(2); const s = fly(A, 30, yard, null); g.tune.wind = t0; A.step(2);
      verdict(s.grains.length === 0 && s.P.grainCfg[7] === 0 && s.Gs.active === false && /no wind/.test(s.Gs.why) && s.flakes.length > 0,
        'still — the wind\'s master at 0: nothing blows, nothing is filed', `tune.wind 0 for 30 frames: ${s.grains.length} grain records (${sum(s.grains)} grains; '${s.Gs.why}'), grainCfg[7] = ${s.P.grainCfg[7]}, the wind's own speed handed over ${s.Gs.u0.toFixed(3)} m/s (the air's feed: '${airSimStats(g).why}', calm ${airSimStats(g).calm.toFixed(3)}) · ${s.flakes.length} flake records`); }
    // ---- noair
    { const N1 = await rig('pass.json', true, 'none'); N1.step(3); const n1 = fly(N1, FRAMES, yard, 1); const live1 = airLive(N1.g);
      const N2 = await rig('pass.json', true, 'off'); N2.step(3); const n2 = fly(N2, FRAMES, yard, 1); const live2 = airLive(N2.g);
      const base = [...off.flakes, ...off.wisps].map(key), fk = off.flakes.map(key), wk = off.wisps.map(key);
      const d1 = [part(n1.flakes.map(key), fk), part(n1.wisps.map(key), wk)], d2 = [part(n2.flakes.map(key), fk), part(n2.wisps.map(key), wk)];
      verdict(N1.stood === true && N2.stood === true && !live1 && !live2 && n1.grains.length === 0 && n2.grains.length === 0 && n1.ran === 0 && n2.ran === 0 && n1.P.grainCfg[7] === 0 && n2.P.grainCfg[7] === 0 && fk.length > 100 && wk.length > 100 && d1.every(i => i < 0) && d2.every(i => i < 0) && n1.S.target === off.S.target && n2.S.target === off.S.target,
        'noair — with no air field to ride not one grain is filed, and the flakes and the wisps keep the whole ring',
        `the grains' switch up (${N1.stood}, ${N2.stood}) · no field on the engine: ${n1.grains.length} grain records ('${n1.Gs.why}'); the air's switch down: ${n2.grains.length} ('${n2.Gs.why}') · against the run with the grains off (${fk.length} flake records, ${wk.length} wisp records, ${base.length} in all): no field ${d1.every(i => i < 0) ? 'the same, record for record' : `parts at flake ${d1[0]} / wisp ${d1[1]}`} (${n1.flakes.length} + ${n1.wisps.length}); switch down ${d2.every(i => i < 0) ? 'the same, record for record' : `parts at flake ${d2[0]} / wisp ${d2[1]}`} (${n2.flakes.length} + ${n2.wisps.length}) · flakes' target ${n1.S.target.toFixed(0)} / ${n2.S.target.toFixed(0)} / ${off.S.target.toFixed(0)}`); }
    // ---- off
    { const c = off.P.grainCfg;
      verdict(B.stood === false && off.grains.length === 0 && off.ran === 0 && off.Gs.active === false && off.Gs.totalBirths === 0 && c[7] === 0 && c[1] === -1 && c[6] === -1 && off.flakes.length > 100 && off.wisps.length > 100,
        'off — with the switch off not one grain is filed', `the switch as the stand left it: ${B.stood} · ${off.grains.length} grain records in ${FRAMES} frames, ${off.Gs.totalBirths} births ('${off.Gs.why}') · grainCfg[7] = ${c[7]} (the pool's was −1), the rest as the pool had them: ${c[1] === -1 && c[6] === -1} · ${off.flakes.length} flake records, ${off.wisps.length} wisp records`); }
    // ---- others
    { const C = await rig('compound.json', true); C.step(3); const c = fly(C, 30, [20, 0, 14], 1);
      verdict(C.stood === true && c.recs.length === 0 && c.Gs.active === false && c.ran === 0, 'others — another level is not touched by the switch', `compound.json, the grains' switch up (${C.stood}), the air's up and a field there: ${c.recs.length} records (${c.Gs.why})`); }
    // ---- digest: two fresh games, the same frames, the recycler filing into a pool every frame — grains on, grains off
    { const D1 = await rig('pass.json', true), D0 = await rig('pass.json', false);
      D1.step(3); D0.step(3); const d1 = fly(D1, 300, yard, null, true), d0 = fly(D0, 300, yard, null, true);
      const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      verdict(h1 === h0 && d1.grains.length > 50 && d0.grains.length === 0 && D1.field.cells >= 1 && D0.field.cells === 0, 'digest — the game does not know: one digest with the grains filed and the air they read fed, and with neither', `300 frames of the pass: ${h1} with ${d1.grains.length} grain records filed and ${D1.field.cells} map handed to the air, ${h0} with ${d0.grains.length} and ${D0.field.cells} (no reader: the air is not fed)`); }
    // ---- dead: every use of a grain function, the grains' numbers or the air's texture in the particle shaders sits on a line guarded by SNOW_GRAINS (or inside a
    // grain function's own body); `grainRec` is the guard itself under another name
    { const bad: string[] = []; const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8');
      for (const f of ['particles.wgsl', 'particles_draw.wgsl', 'particles_common.wgsl']) {
        let inGrain = false, block = -1;   // (block: the indent of a guarded statement that opened a block — the lines under it, deeper, are its body)
        read(f).split('\n').forEach((line, i) => {
          if (/^fn /.test(line)) { inGrain = /^fn (grain[A-Z]|airAt\b)/.test(line); if (inGrain) return; }
          else if (/^\}/.test(line)) { inGrain = false; return; }
          if (/^\s*(\/\*\*|\*)/.test(line) || /^(@group|struct GrainCfg|const GRAIN_|const AIR_)/.test(line)) return;   // (comment blocks; the bindings and the constants themselves)
          const code = line.replace(/\/\/.*$/, ''); const indent = line.search(/\S/);
          if (block >= 0 && indent >= 0 && indent <= block) block = -1;
          if (/SNOW_GRAINS/.test(code) && /\{\s*$/.test(code)) { block = indent; return; }
          if (inGrain || block >= 0) return;
          if (/\bgrain[A-Z]\w*\(|\bairAt\(|\bgrain\.[ab]\b|\bairTex\b|\bGRAIN_[A-Z]/.test(code) && !/SNOW_GRAINS/.test(code)) bad.push(`${f}:${i + 1}`);
        }); }
      const common = read('particles_common.wgsl'), sim = read('particles.wgsl');
      const gate = /fn grainIs\(aux: u32\) -> bool \{ return SNOW_GRAINS && snowNow\(\) && /.test(common), rec = /let grainRec = SNOW_GRAINS && snowNow\(\) && rec\.posB\.y > 2\.5;/.test(sim);
      const wisp = /fn wispIs\(aux: u32\) -> bool \{[^}\n]*SNOW_WISPS && snowNow\(\) && [\w.()]+ > 1\.5 && [\w.()]+ < 2\.5;/.test(common), wrec = /let wispRec = SNOW_WISPS && snowNow\(\) && rec\.posB\.y > 1\.5 && rec\.posB\.y < 2\.5;/.test(sim);
      const calls = (sim.match(/\bgrainStep\(/g) ?? []).length + (read('particles_draw.wgsl').match(/\bgrainVertex\(/g) ?? []).length;
      const m = /const AIR_CELLS_PER_M\s*:\s*f32\s*=\s*([0-9.]+)\s*;/.exec(sim); const AF: any = await import(`${ROOT}/src/render/airField.ts`);
      verdict(bad.length === 0 && gate && rec && wisp && wrec && calls === 4 && !!m && Number(m[1]) === AF.AIR_RES,
        'dead — every grain statement in the particle shaders stands behind SNOW_GRAINS, and a wisp is no longer told by "over 1.5"',
        `${bad.length ? `unguarded: ${bad.join(', ')}` : 'no grain call, grain number or read of the air outside a guarded statement in the three particle shaders'} · grainIs itself opens on the switch: ${gate}; a grain's record too: ${rec} · wispIs holds both bounds (1.5 < aspect < 2.5): ${wisp}; a wisp's record too: ${wrec} · grainStep and grainVertex: ${calls} mentions (each its body and one guarded call) · the shader's cells a metre ${m ? m[1] : 'not found'}, the field's ${AF.AIR_RES}`); }
  } finally {
    SNOW.on = was.snow; SNOW_LOOK.oneAir = wasOneAir; SNOW_LOOK.grains = was.grains; SNOW_LOOK.wisps = was.wisps; AIR_SIM.on = was.air; snowConfig.on = was.cfg; snowLookConfig.wisps = was.lookW; snowLookConfig.grains = was.lookG;
    ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nsnowgrains-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWGRAINS_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowGrainsCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
