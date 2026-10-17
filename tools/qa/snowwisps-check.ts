// WISPS OF BLOWING SNOW ARE THE PICTURE'S ALONE, AND RUN ONLY OVER OPEN GROUND (src/game/weatherKinds.ts SNOW_LOOK.wisps, src/game/snowFx.ts SNOWWISPS /
// updateWisps, the particle shaders' half behind the prelude's `const SNOW_WISPS`).
//
// The maintainer, 10-14, after his first look at the pass on a real GPU: "not sure i'm feeling the snow. i think it does need to feel more organic … and maybe we can
// even use the smoke sim for wisps of blowing snow?" Not the smoke: that is one fluid for the picture and for every eye in the game. The wisps ride the flakes' ring
// of GPU particles — one more record a frame — and nothing in the simulation reads them.
//
//   bun run tools/qa/snowwisps-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWWISPS_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snowwisps      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SNOWWISPS.
//
// The harness has no GPU: a wisp's own place is thrown on the GPU (the emit kernel's tries), so what is proven HERE is what the CPU files and what the shader text
// says of it — never a wisp seen.
//   runs      the pass, switch on: the recycler files wisp records — the flakes' own disc shape in the bottom half metre, aspect 2 (what the GPU tells a wisp by),
//             a seed of their own, the three live numbers in the rain look's refraction slots — toward a target above zero and under the cap
//   gusts     … and more of them when the storm's gust is up than when it is down (they come and go with the wind), none at all in still air
//   open      none under a roof: with the view deep under one and the disc drawn in to it nothing is filed; and by the shader text, a wisp's birth is thrown by the
//             flakes' own tries (rainOutdoors: no roof over it) and its step ends it where a roof is over it
//   off       the pass, switch off: not one wisp record, and the refraction slots untouched
//   flakes    the flakes do not know: the flake records filed with the wisps on are those filed with them off, record for record (count, height, seed), and the
//             flakes' target is the same
//   others    another level, switch on: nothing filed
//   digest    the game does not know: 300 stepped frames of the pass with the recycler filing into a pool every frame, wisps on and off — one game digest
//   dead      every wisp statement in the particle shaders stands behind SNOW_WISPS (no wisp function is called outside a guarded statement)
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowWispsCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK, WEATHER_BOOT } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { updateSnowFx, snowStats, wispStats, seedSnow, SNOWWISPS } = await import(`${ROOT}/src/game/snowFx.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const BREAK = process.env.SNOWWISPS_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const wasOneAir = SNOW_LOOK.oneAir;
  const was = { snow: SNOW.on, wisps: SNOW_LOOK.wisps, envSnow: process.env.TPS_SNOW, envWisps: process.env.TPS_SNOWWISPS, cfg: snowConfig.on, look: snowLookConfig.wisps };

  /** a game stood up on `file` in snow, the wisps' switch where `on` says (by the stand's own word, so the frozen stand's pin and the shipped stand's boot both obey) */
  async function rig(file: string, on: boolean) {
    const sw = on && !BREAK;
    process.env.TPS_SNOWAIR = '0'; SNOW_LOOK.oneAir = false;   // (the wisps in their gust patches, as they are with no field to read: one snow in one air — snowair-check.ts — lifts them by the air)
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWWISPS = sw ? '1' : '0'; SNOW_LOOK.wisps = !sw;   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = SNOW_LOOK.wisps; SNOW_LOOK.wisps = sw;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { SNOW_LOOK.wisps = sw; W.step(DT); } };
    return { W, g, step, stood, sw, wx: g.weather as any };
  }
  /** a recording stand-in for the particle pool (the harness's engine has none: no GPU) — it keeps the pool's own order: emit() files a record (twelve at most), a
   *  DRAWN frame takes what was filed (640 births at most) and only then counts it */
  const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 }, cleared: 0,
      emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
      draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
      clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
  const isWisp = (r: any) => (r.opts.aspect ?? 1) > 1.5;
  /** the recycler run `frames` drawn frames against a fresh pool with the view at `target` — the pool on the engine only for the recycler's own call (the rest of the
   *  game has no pool to file into on this harness, as ever). `play`: the GAME is stepped a frame before each (the digest line: its own poolless pass over the
   *  recycler puts the birth carry back to nothing every frame — records are filed all the same); else the game stands still and the storm's gust is held at `gust` */
  const fly = (R: any, frames: number, target: number[], gust: number | null = null, play = false) => {
    const { P, recs } = mk(); const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
    seedSnow(R.g, 1); snowConfig.on = true; snowLookConfig.wisps = true;   // (a page whose shaders were built for snow and its wisps: the recycler files neither otherwise)
    const storm = R.g.wind.byName('storm');
    for (let i = 0; i < frames; i++) {
      if (play) R.step(1);
      if (gust !== null && storm) { storm.speed = storm.base * gust; storm.gust = gust; }   // (the wind's own gusting held where the line needs it: wind.ts wrote this frame's a moment ago)
      e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true; SNOW_LOOK.wisps = R.sw; SNOW_LOOK.oneAir = false;
      P.draw(); updateSnowFx(R.g, DT, { distance: 21, target } as any);
      e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr;
    }
    return { P, recs, wisps: recs.filter(isWisp), flakes: recs.filter(r => !isWisp(r)), S: { ...snowStats(R.g) }, Ws: { ...wispStats(R.g) } };
  };

  try {
    const A = await rig('pass.json', true); A.step(3);
    // the view over the yard's open ground (the open point nearest the world's centre), and a point deep under a roof
    let at: number[] | null = null, roofed: number[] | null = null; { const cx = (WORLD.min[0] + WORLD.max[0]) / 2, cz = (WORLD.min[2] + WORLD.max[2]) / 2; let best = 1e9;
      for (let x = WORLD.min[0] + 2; x < WORLD.max[0] - 2; x += 1) for (let z = WORLD.min[2] + 2; z < WORLD.max[2] - 2; z += 1) {
        if (A.wx.underRoof(x, z)) { if (!roofed && [-2, 0, 2].every(dx => [-2, 0, 2].every(dz => A.wx.underRoof(x + dx, z + dz)))) roofed = [x, 0, z]; continue; }
        const d = Math.hypot(x - cx, z - cz); if (d < best) { best = d; at = [x, 0, z]; } } }
    const yard = at ?? [20, 0, 14];
    // ---- runs
    const on = fly(A, 240, yard, 1);
    { const w = on.wisps, K = SNOWWISPS; const born = w.reduce((n, r) => n + r.count, 0);
      const shape = w.every(r => r.kind === 'rain' && r.opts.shape === 'rainDisc' && r.opts.radius === on.S.radius && r.opts.aspect === 2 && r.pos[1] === K.y1 && r.pos[1] <= 0.6 && r.opts.lift === K.y1 - K.y0 && r.pos[0] === yard[0] && r.pos[2] === yard[2]);
      const seeds = new Set(w.map(r => r.opts.seed)), flakeSeeds = new Set(on.flakes.map(r => r.opts.seed)); const own = w.every(r => !flakeSeeds.has(r.opts.seed)) && seeds.size === w.length;
      const L = on.P.rainLook; const live = L.refractReachM === K.speedK && L.refractClamp === K.opacity && L.refractDepth === K.gain && L.refract === 0;
      const perSec = born / (240 * DT), want = on.Ws.target / K.life;
      verdict(A.stood === true && on.Ws.active && on.Ws.target > 50 && on.Ws.target <= K.max && w.length > 100 && shape && own && live && Math.abs(perSec - want) < 0.15 * want + 2,
        'runs — on the pass the wind runs wisps: one record a frame in the bottom half metre of the view\'s disc', `the stand's word raised the switch before the Game was built: ${A.stood} · ${on.Ws.why} · target ${on.Ws.target.toFixed(0)} wisps (cap ${K.max}) over ${on.S.areaOut.toFixed(0)} m² of open ground · ${w.length} records in 240 frames, ${born} births (${perSec.toFixed(0)}/s; target ÷ life = ${want.toFixed(0)}/s) · every one the disc at ${K.y1} m and under, aspect 2: ${shape} · seeds their own: ${own} · speed × ${L.refractReachM}, weight ${L.refractClamp}, light × ${L.refractDepth} in the refraction's slots (refraction ${L.refract}): ${live}`); }
    // ---- gusts
    { const hi = fly(A, 120, yard, 1.3), lo = fly(A, 120, yard, 0.7), still = fly(A, 60, yard, 0);
      const nh = hi.wisps.reduce((n, r) => n + r.count, 0), nl = lo.wisps.reduce((n, r) => n + r.count, 0);
      verdict(nh > 2 * nl && nl > 0 && still.wisps.length === 0 && still.Ws.active === false && still.flakes.length > 0,
        'gusts — they come and go with the wind, and still air runs none', `120 frames each: ${nh} births with the storm's gust at 1.3, ${nl} at 0.7 · the storm's air at 0 for 60 frames: ${still.wisps.length} wisp records (${still.Ws.why}), ${still.flakes.length} flake records`); }
    // ---- open
    { A.g.engine.settings.particleRainRadius = 2; const under = fly(A, 30, roofed ?? [0, 0, 0], 1); A.g.engine.settings.particleRainRadius = 0;
      const emit = readFileSync(resolve(ROOT, 'src/render/shaders/particles.wgsl'), 'utf8');
      const tries = /let skyRec = snowNow\(\) && !wispRec && !grainRec/.test(emit) && /else \{ open = rainOutdoors\(q2\); \}\s*\n\s*ok = open && rnd\(seed, 22u \+ t \* 3u\) < keep;\s*\n\s*if \(SNOW_WISPS\) \{ if \(wispRec && ok && !puffRec && !snowOneAir\(\)\) \{ ok = [^\n]*wispGust\(/.test(emit);   // a wisp's try must first be the flake's own (open ground), THEN a gust patch
      const step = emit.slice(emit.indexOf('fn wispStep(')); const ends = /if \(!rainOutdoors\(p\.pos\.xz\)[^\n]*\{ pool\.parts\[slot\]\.age = p\.life; return; \}/.test(step);
      verdict(!!roofed && under.S.areaOut < 3 && under.wisps.length === 0 && under.Ws.target < 0.01 * on.Ws.target && tries && ends,
        'open — none under a roof', `the view deep under a roof (${roofed ? roofed[0] + ', ' + roofed[2] : 'none found'}), the disc drawn in: ${under.S.areaOut.toFixed(1)} m² open, ${under.wisps.length} wisp records (target ${under.Ws.target.toFixed(1)}) · the shader text: a wisp's birth is thrown by the flakes' own open-ground tries: ${tries} · its step ends it under a roof: ${ends} (the GPU's own throws are never run here: no GPU)`); }
    // ---- off / flakes
    const B = await rig('pass.json', false); B.step(3);
    const off = fly(B, 240, yard, 1);
    { const L = off.P.rainLook;
      verdict(B.stood === false && off.wisps.length === 0 && off.Ws.active === false && off.Ws.totalBirths === 0 && L.refractReachM === -1 && L.refractClamp === -1 && L.refractDepth === -1 && off.flakes.length > 100,
        'off — with the switch off not one wisp is filed', `the switch as the stand left it: ${B.stood} · ${off.wisps.length} wisp records in 240 frames, ${off.Ws.totalBirths} births · the refraction's slots as the pool had them: ${L.refractReachM === -1 && L.refractClamp === -1 && L.refractDepth === -1} · ${off.flakes.length} flake records`); }
    { const key = (r: any) => `${r.count}:${r.opts.lift}:${r.opts.seed}:${r.opts.radius}:${r.opts.life}`; const a = on.flakes.map(key), b = off.flakes.map(key);
      let firstDiff = -1; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) { firstDiff = i; break; }
      verdict(a.length > 100 && firstDiff < 0 && on.S.target === off.S.target && on.S.capped === off.S.capped,
        'flakes — the flakes do not know the wisps are there', `${a.length} flake records with the wisps on, ${b.length} with them off: ${firstDiff < 0 ? 'the same, record for record (count, height, seed, disc, life)' : `they part at record ${firstDiff} (${a[firstDiff]} against ${b[firstDiff]})`} · the flakes' target ${on.S.target.toFixed(0)} on, ${off.S.target.toFixed(0)} off`); }
    // ---- others
    { const C = await rig('compound.json', true); C.step(3); const c = fly(C, 30, [20, 0, 14], 1);
      verdict(c.recs.length === 0 && c.Ws.active === false, 'others — another level is not touched by the switch', `compound.json, the switch on: ${c.recs.length} records (${c.Ws.why})`); }
    // ---- digest: two fresh games, the same frames, the recycler filing into a pool every frame — wisps on, wisps off
    { const D1 = await rig('pass.json', true), D0 = await rig('pass.json', false);
      D1.step(3); D0.step(3); const d1 = fly(D1, 300, yard, null, true), d0 = fly(D0, 300, yard, null, true);
      const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      verdict(h1 === h0 && d1.wisps.length > 50 && d0.wisps.length === 0, 'digest — the game does not know: one digest with the wisps filed and without', `300 frames of the pass: ${h1} with ${d1.wisps.length} wisp records filed, ${h0} with ${d0.wisps.length}`); }
    // ---- dead: every call of a wisp function in the particle shaders sits on a line guarded by SNOW_WISPS (or inside a wisp function's own body)
    { const bad: string[] = [];
      for (const f of ['particles.wgsl', 'particles_draw.wgsl', 'particles_common.wgsl']) {
        const text = readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8'); let inWisp = false, block = -1;   // (block: the indent of a guarded statement that opened a block — the lines under it, deeper, are its body)
        text.split('\n').forEach((line, i) => {
          if (/^fn /.test(line)) inWisp = /^fn wisp[A-Z]/.test(line);
          else if (/^\}/.test(line)) { inWisp = false; return; }
          const code = line.replace(/\/\/.*$/, ''); const indent = line.search(/\S/);
          if (block >= 0 && indent >= 0 && indent <= block) block = -1;
          if (/SNOW_WISPS/.test(code) && /\{\s*$/.test(code)) { block = indent; return; }
          if (inWisp || block >= 0 || /^fn wisp[A-Z]/.test(line) || /^const WISP_/.test(line)) return;
          if (/\bwisp[A-Z]\w*\(|\bwispRec\b|mode > 2\.2/.test(code) && !/SNOW_WISPS/.test(code) && !/let wispRec = SNOW_WISPS/.test(code) && !/!wispRec/.test(code)) bad.push(`${f}:${i + 1}`);
        }); }
      const common = readFileSync(resolve(ROOT, 'src/render/shaders/particles_common.wgsl'), 'utf8');
      const gate = /fn wispIs\(aux: u32\) -> bool \{ return SNOW_WISPS && snowNow\(\) && /.test(common);
      verdict(bad.length === 0 && gate, 'dead — every wisp statement in the particle shaders stands behind SNOW_WISPS', bad.length ? `unguarded: ${bad.join(', ')}` : `no wisp call outside a guarded statement in the three particle shaders · wispIs itself opens on the switch: ${gate}`); }
  } finally { SNOW.on = was.snow; SNOW_LOOK.oneAir = wasOneAir; delete process.env.TPS_SNOWAIR; SNOW_LOOK.wisps = was.wisps; snowConfig.on = was.cfg; snowLookConfig.wisps = was.look; if (was.envSnow === undefined) delete process.env.TPS_SNOW; else process.env.TPS_SNOW = was.envSnow; if (was.envWisps === undefined) delete process.env.TPS_SNOWWISPS; else process.env.TPS_SNOWWISPS = was.envWisps; }
  console.log(`\nsnowwisps-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWWISPS_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowWispsCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
