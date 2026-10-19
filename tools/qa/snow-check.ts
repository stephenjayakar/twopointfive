// A LEVEL BUILT FOR SNOW IS BORN IN SNOW, AND SNOW CHANGES NOTHING ABOUT HOW IT PLAYS (src/game/weatherKinds.ts SNOW / SNOW_LEVELS, weather.ts levelKind,
// snowFx.ts).
//
// The maintainer, 10-14: "can we also have snow levels? the rain already looks incredible", then "i think we should probably curate snow levels and have the art
// be custom. seems like a lot to have it just be slapped on". So snow is the weather OF a level made for it (levels/pass.json — its ground, drifts, caps and
// paths are its own boxes), never a kind picked for another, and what falls is the picture's alone.
//
//   bun run tools/qa/snow-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOW_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snow      (also under `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SNOW.
//
//   born      the pass, switch on: the Weather is in the kind 'snow' from its first frame — a snowfall in the frame, no rain, nothing wet, the level's own roofs
//   off       the pass, switch off: no snow kind, no snowfall in the frame (the level under the weather any level has)
//   others    another level, switch on: no snow kind, no snowfall — the switch reaches the levels built for snow and no other
//   row       snow is not a weather to pick: not on the Weather row's list, not a ?weather= word, and a pick made for the visit does not take the pass out of snow
//   senses    in snow no ear and no eye is touched: the hearing mask is exactly 1 and the air's transmittance exactly 1 everywhere, no rain bed, nobody gets wet
//   same      a room clear on the pass plays the same in snow as under Overcast: one PLAYED run each (playthrough.ts, the same seed), one digest every half second —
//             and the same run in fog does not (the control: the digest tells weathers apart)
//   flakes    the recycler keeps flakes in the air over open ground only: a target above zero, births filed as the rain ring's records over the view's disc with
//             the disc handed to the frame for the wrap and a lattice share of 0, the first frames making up the whole population; none filed off the pass,
//             and none on a page whose shaders were not built for snow (render/frame.ts snowConfig: a level loaded into a page opened on another)
//   save      a checkpoint made in snow carries the kind and puts it back
//   old       a recording from before the switch replays with it off (journal.ts applyKnobs)
import { standUp, ROOT } from './headless.ts';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

const DT = 1 / 60;

export async function snowCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, WEATHER_KINDS, WEATHER_BOOT, isWeatherKind, weatherOfSearch, snowLevel } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { updateSnowFx, snowStats, seedSnow, snowPastM } = await import(`${ROOT}/src/game/snowFx.ts`);   // (snowPastM: the frame's disc slot w is 0 here, or — on the stand with SNOW_LOOK.past up — the metres past the rim, negative)
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const { snowConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const BREAK = process.env.SNOW_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = SNOW.on, envWas = process.env.TPS_SNOW, bootWas = WEATHER_BOOT.kind;

  /** a game stood up on `file` with the switch where `on` says (by the stand's own word, so the frozen stand's pin and the shipped stand's boot both obey) */
  async function rig(file: string, on: boolean, pick: string | null = null) {
    const sw = on && !BREAK;
    process.env.TPS_SNOW = sw ? '1' : '0'; SNOW.on = !sw; WEATHER_BOOT.kind = pick as any;   // (the module's switch left the WRONG way round: only the stand's word, read before the Game is built, can put it right)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    let W: any; try { W = await quiet(() => standUp({ level: lvl, seed: 7 })); } finally { WEATHER_BOOT.kind = bootWas; }
    const g = W.game; const stood = SNOW.on; SNOW.on = sw;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { SNOW.on = sw; W.step(DT); } };
    return { W, g, step, stood, wx: g.weather as any, frame: () => (g.engine as any).weather as any };
  }

  try {
    // ---- born / off
    const A = await rig('pass.json', true); A.step(3);
    { const F = A.frame(), wx = A.wx;
      verdict(A.stood === true && wx.kind === 'snow' && wx.snowRate > 0 && F.snow > 0 && F.rain === 0 && F.wet === 0 && wx.levelRoofs === true && wx.roofs.length >= 1 && wx.roofs.length <= 4 && wx.storm === 0,
        'born — the pass is in snow from its first frame', `the stand's word raised the switch before the Game was built: ${A.stood} · kind ${wx.kind} · snowfall ${F.snow} · rain ${F.rain} · wet ${F.wet} · storm ${wx.storm} · ${wx.roofs.length} roof(s) of its own`); }
    const B = await rig('pass.json', false); B.step(3);
    { const F = B.frame(), wx = B.wx;
      verdict(B.stood === false && wx.kind !== 'snow' && !(F.snow > 0) && wx.snowRate === 0, 'off — with the switch off the pass has no snow kind', `the switch as the stand left it: ${B.stood} · kind ${wx.kind ?? 'none'} · snowfall ${F.snow ?? 0}`); }
    // ---- others
    { const C = await rig('compound.json', true); C.step(3); const F = C.frame();
      verdict(C.wx.kind === null && !(F.snow > 0) && C.wx.snowRate === 0 && !snowLevel('compound') && !snowLevel(null), 'others — another level is not touched by the switch', `compound.json: kind ${C.wx.kind ?? 'none'} · snowfall ${F.snow ?? 0}`); }
    // ---- row
    { SNOW.on = !BREAK;
      const D = await rig('pass.json', true, 'rain'); D.step(3);
      const took = D.wx.setKind('rain'), after = D.wx.kind, rainAfter = D.wx.rainRate;   // (what a ?weather= word does headless: scenarioRun.ts startFromQuery → setKind)
      // a PAGE (its kind locked at boot): opened on the snow level it is in snow; a page opened on another level, the pass loaded into it later, is not (no flake in its shaders)
      const lockWas = WEATHER_BOOT.locked; let pageOn = '', pageOther = '';
      try { WEATHER_BOOT.locked = true; pageOn = String((await rig('pass.json', true, 'snow')).wx.kind); pageOther = String((await rig('pass.json', true, null)).wx.kind); } finally { WEATHER_BOOT.locked = lockWas; SNOW.on = !BREAK; }
      const office = await rig('compound.json', true, 'snow');   // (the word 'snow' on the page's boot, the level not a snow level — a level file that failed to load: no snow)
      verdict(!(WEATHER_KINDS as string[]).includes('snow') && !isWeatherKind('snow') && weatherOfSearch('?weather=snow') === null && D.wx.kind === 'snow' && D.frame().rain === 0 && took === false && after === 'snow' && rainAfter === 0
        && pageOn === 'snow' && pageOther !== 'snow' && office.wx.kind === null,
        'row — snow is not a weather to pick, and no pick takes the pass out of it', `the row: ${(WEATHER_KINDS as string[]).join(' ')} · ?weather=snow reads ${weatherOfSearch('?weather=snow')} · the pass started with rain picked: kind ${D.wx.kind}, rain ${D.frame().rain} · setKind('rain') on it: ${took}, kind ${after} · a page opened on it: ${pageOn}; a page opened on another level: ${pageOther} · another level under the word: ${office.wx.kind ?? 'none'}`); }
    // ---- senses
    { const { g, wx } = A; let worstHear = 1, worstAir = 1, bed = 0, n = 0;
      for (let x = WORLD.min[0] + 1.5; x < WORLD.max[0] - 1; x += 2) for (let z = WORLD.min[2] + 1.5; z < WORLD.max[2] - 1; z += 2) {
        n++; worstHear = Math.max(worstHear, wx.hearMask([x, 1.6, z])); bed = Math.max(bed, wx.rainBed(x, z));
        worstAir = Math.min(worstAir, wx.airTrans([x, 1.6, z], [x + 9, 1.6, z + 5])); }
      A.step(240);
      const wetMod = await import(`${ROOT}/src/game/wet.ts`); const rainNow = wetMod.rainNow(g);
      verdict(wx.kind === 'snow' && worstHear === 1 && worstAir === 1 && bed === 0 && rainNow === 0, 'senses — in snow no ear and no eye is touched', `${n} points: hearing mask at most ${worstHear}, air transmittance at least ${worstAir}, rain bed ${bed}, rain on the men ${rainNow}`); }
    // ---- same: three whole played runs of the pass's room clear (tools/qa/playthrough.ts, its own driver and seed; each a process of its own, on this stand), by the
    //      game's digest every half second: in snow · under Overcast with the switch off · and, the control, in fog with the switch off (the digest must tell THAT apart)
    { const E = (SCENARIOS as any[]).find(s => s.level === 'pass.json');
      if (!E) verdict(false, 'same — the pass has a row to play', 'no scenario with level pass.json in scene/scenarioList.ts SCENARIOS');
      else {
        const dir = mkdtempSync(resolve(tmpdir(), 'snow-check-'));
        const run = async (name: string, seed: number, snow: boolean, kind: string | null) => {
          const out = resolve(dir, `${name}-${seed}.json`);
          const p = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--one', `${E.id}:${seed}`, '--out', out, '--cap', '150', ...(kind ? ['--set', JSON.stringify({ WEATHER: { kind } })] : [])],
            { stdout: 'ignore', stderr: 'pipe', env: { ...process.env, TPS_SNOW: snow && !BREAK ? '1' : '0', TPS_SNOWBOG: '0', PT_DIGEST: '1', SNOW_BREAK: '' } });   // (TPS_SNOWBOG=0: the ONE thing in snow that is play, on the maintainer's word — thrown things bog down, src/game/snowBog.ts, held by snowbog-check — is held off on both sides, so the line still proves everything else in snow is the picture's alone)
          const code = await p.exited; if (code !== 0 || !existsSync(out)) return { digest: `no run (exit ${code}: ${(await new Response(p.stderr).text()).trim().split('\n').pop()?.slice(0, 200)})`, secs: 0, how: '' };
          const r = JSON.parse(readFileSync(out, 'utf8')); return { digest: String(r.digest ?? 'no digest in the run'), secs: +(r.secs ?? r.t ?? 0), how: String(r.outcome ?? r.end ?? r.result ?? '') };
        };
        const SEEDS = [1, 2];
        const [sn, oc, fg] = await Promise.all([Promise.all(SEEDS.map(s => run('snow', s, true, null))), Promise.all(SEEDS.map(s => run('overcast', s, false, 'overcast'))), run('fog', SEEDS[0], false, 'fog')]);
        rmSync(dir, { recursive: true, force: true });
        const hex = (d: string) => /^[0-9a-f]+$/.test(d);
        verdict(sn.every((r, i) => hex(r.digest) && r.digest === oc[i].digest) && hex(fg.digest) && fg.digest !== sn[0].digest && sn.some(r => r.secs >= 40),
          'same — a room clear on the pass plays the same in snow as under Overcast', `played runs, their digest every half second — ${SEEDS.map((s, i) => `seed ${s}: ${sn[i].digest} in snow (${sn[i].secs.toFixed(0)} s ${sn[i].how}), ${oc[i].digest} under Overcast (${oc[i].secs.toFixed(0)} s ${oc[i].how})`).join(' · ')} · the control, seed ${SEEDS[0]} in fog: ${fg.digest} (${fg.secs.toFixed(0)} s ${fg.how})`); }
    }
    // ---- flakes: the recycler against a recording stand-in for the particle pool (the harness's engine has none: no GPU)
    { // the stand-in keeps the pool's own order: emit() files a record (twelve at most), a DRAWN frame takes what was filed (640 births at most) and only then counts it
      const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: {}, rainStats: { live: 0, emitted: 0 }, cleared: 0,
          emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
          draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
          clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
      const put = (R: any, P: any) => { const e = R.g.engine as any; e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true; };
      const R = await rig('pass.json', true); R.step(2); const { P, recs } = mk(); put(R, P); seedSnow(R.g, 1);
      const cfgWas = snowConfig.on; snowConfig.on = false; for (let i = 0; i < 5; i++) updateSnowFx(R.g, DT, { distance: 21, target: [20, 0, 14] } as any); const coldBorn = recs.length, coldWhy = snowStats(R.g).why; snowConfig.on = true;
      R.g.engine.settings.particleRain = false; for (let i = 0; i < 5; i++) updateSnowFx(R.g, DT, { distance: 21, target: [20, 0, 14] } as any); const offBorn = recs.length; R.g.engine.settings.particleRain = true;
      // stand the view over the yard's open ground (the open point nearest the world's centre), and find a point deep under a roof
      let at: number[] | null = null, roofed: number[] | null = null; { const cx = (WORLD.min[0] + WORLD.max[0]) / 2, cz = (WORLD.min[2] + WORLD.max[2]) / 2; let best = 1e9;
        for (let x = WORLD.min[0] + 2; x < WORLD.max[0] - 2; x += 1) for (let z = WORLD.min[2] + 2; z < WORLD.max[2] - 2; z += 1) {
          if (R.wx.underRoof(x, z)) { if (!roofed && [-2, 0, 2].every(dx => [-2, 0, 2].every(dz => R.wx.underRoof(x + dx, z + dz)))) roofed = [x, 0, z]; continue; }
          const d = Math.hypot(x - cx, z - cz); if (d < best) { best = d; at = [x, 0, z]; } } }
      const C = { distance: 21, target: at ?? [20, 0, 14] } as any;
      // ten frames filed and never drawn — a paused page: ONE make-up fill may wait on the ring, and none of it may be reckoned as in the air (the ring is not empty: live 1)
      P.rainStats.live = 1; for (let i = 0; i < 10; i++) updateSnowFx(R.g, DT, C); const undrawnPop = snowStats(R.g).pop, undrawnFills = recs.filter(r => r.opts.lift > 3).length;
      for (let i = 0; i < 60; i++) { P.draw(); updateSnowFx(R.g, DT, C); }
      const S = { ...snowStats(R.g) }, nf = [...R.frame().nearFade], first = recs[0], taken = P.rainStats.emitted;
      const shape = recs.every(r => r.opts.shape === 'rainDisc' && r.kind === 'rain' && r.opts.radius === S.radius);
      // the trickle enters at the top of the slab (snow comes down from the sky, it does not appear a metre over the ground); only a make-up fill is laid through its height
      const trickles = recs.filter(r => r.opts.lift <= 1), fills = recs.filter(r => r.opts.lift > 3), steady = recs.slice(-20).every(r => r.opts.lift <= 1);
      // … and with the view deep under a roof and the disc drawn in to it: next to no open ground, next to nothing filed
      R.g.engine.settings.particleRainRadius = 2; const before = recs.length; for (let i = 0; i < 5; i++) { P.draw(); updateSnowFx(R.g, DT, { distance: 21, target: roofed ?? [0, 0, 0] } as any); } const roofArea = snowStats(R.g).areaOut, roofTarget = snowStats(R.g).target, roofRecs = recs.length - before; R.g.engine.settings.particleRainRadius = 0;
      verdict(S.active && S.target > 50 && S.areaOut > 20 && undrawnPop === 0 && undrawnFills === 1 && taken >= 0.9 * S.target && taken <= 1.9 * S.target && Math.abs(S.pop - S.target) < 0.25 * S.target && shape && !!first && trickles.length > 20 && fills.length >= 1 && fills.length <= 12 && steady && nf[2] === S.radius && nf[3] === (snowPastM() > 0 ? -snowPastM() : 0) && nf[0] === C.target[0] && nf[1] === C.target[2]
        && P.rainLook.refract === 0 && P.rainLook.beadAmp === 0 && Math.abs(P.params.rain.gravity / P.params.rain.drag - 1.25) < 0.01 && !!roofed && roofArea < 3 && roofTarget < 0.02 * S.target && roofRecs <= 1,   // (… next to nothing: the square metre of open ground at that disc's rim takes its own share — one record in five frames at the flakes' density of 10-15, none at the old)
        'flakes — the recycler fills the air over open ground at once, counts what the ring took, and hands the frame its disc', `open ground ${S.areaOut.toFixed(0)} m² in a ${S.radius.toFixed(1)} m disc · target ${S.target.toFixed(0)} flakes · ten undrawn frames: ${undrawnFills} fill filed, ${undrawnPop} reckoned in the air · sixty drawn: the ring took ${taken} (${fills.length} fills through the slab's height, ${trickles.length} trickles in at its top, the last twenty all trickle: ${steady}), ~${S.pop.toFixed(0)} reckoned in the air · disc in the frame [${nf.map((v: number) => +v.toFixed(2)).join(', ')}] · fall ${(P.params.rain.gravity / P.params.rain.drag).toFixed(2)} m/s · the view deep under a roof (${roofed}), a 3 m disc: open ground ${roofArea.toFixed(1)} m², target ${roofTarget.toFixed(0)}, ${roofRecs} records`);
      const off = await rig('compound.json', true); off.step(2); const m2 = mk(); put(off, m2.P);
      const { snowing } = await import(`${ROOT}/src/game/snowFx.ts`); for (let i = 0; i < 5; i++) updateSnowFx(off.g, DT, { distance: 21, target: [20, 0, 14] } as any); snowConfig.on = cfgWas;
      verdict(snowing(R.g) === true && snowing(off.g) === false && m2.recs.length === 0 && coldBorn === 0 && offBorn === 0, 'flakes — none off the pass, none on a page not opened for snow, none with the particle rain off', `the pass: snowing ${snowing(R.g)} · compound.json: snowing ${snowing(off.g)}, ${m2.recs.length} records · the pass with the shader half not built: ${coldBorn} records (${coldWhy}) · with the particle rain switched off: ${offBorn}`); }
    // ---- walls: snow shows in front of a roofed building's outer wall as in front of a man at its foot (the surface is hidden only UNDER the roof)
    { const { flakeHidden, flakeHiddenUnder, FLAKE_WALL_IN } = await import(`${ROOT}/src/game/snowFx.ts`); const roofs: number[][] = A.wx.roofs ?? []; const CY = WORLD.ceilingY;
      const raw = JSON.parse(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')); const old = (x: number, z: number) => roofs.some(R => x >= R[0] && z >= R[1] && x <= R[2] && z <= R[3]);
      let walls = 0, outerOpen = 0, innerDry = 0, topOpen = 0, oldHid = 0, underOk = 0;   // (underOk: the same three asked of the rule with SNOW_LOOK.under on — snowunder-check has the seam and the inner tops)
      for (const R of roofs) for (const b of raw.boxes as { c: number[]; h: number[] }[]) { const c = b.c, h = b.h; if (h[1] < 1 || c[1] + h[1] < CY - 0.01) continue;
        const x0 = c[0] - h[0], x1 = c[0] + h[0], z0 = c[2] - h[2], z1 = c[2] + h[2]; let o: number[] | null = null, i: number[] | null = null;
        if (h[0] < 0.2 && h[2] > 0.3 && z0 >= R[1] - 0.2 && z1 <= R[3] + 0.2) { if (Math.abs(x0 - R[0]) < 0.15) { o = [x0, c[2]]; i = [x1, c[2]]; } else if (Math.abs(x1 - R[2]) < 0.15) { o = [x1, c[2]]; i = [x0, c[2]]; } }
        if (!o && h[2] < 0.2 && h[0] > 0.3 && x0 >= R[0] - 0.2 && x1 <= R[2] + 0.2) { if (Math.abs(z0 - R[1]) < 0.15) { o = [c[0], z0]; i = [c[0], z1]; } else if (Math.abs(z1 - R[3]) < 0.15) { o = [c[0], z1]; i = [c[0], z0]; } }
        if (!o || !i) continue; { const L = Math.hypot(o[0] - i[0], o[1] - i[1]) || 1; if (old(o[0] + (o[0] - i[0]) / L * 0.4, o[1] + (o[1] - i[1]) / L * 0.4)) continue; }   // (a partition between two roofed rooms is nobody's outer wall)
        walls++;
        if (!flakeHidden(roofs, o[0], 1.5, o[1], CY)) outerOpen++; if (flakeHidden(roofs, i[0], 1.5, i[1], CY)) innerDry++; if (!flakeHidden(roofs, c[0], c[1] + h[1], c[2], CY)) topOpen++; if (old(o[0], o[1])) oldHid++;
        if (!flakeHiddenUnder(roofs, o[0], 1.5, o[1], CY) && flakeHiddenUnder(roofs, i[0], 1.5, i[1], CY) && !flakeHiddenUnder(roofs, c[0], c[1] + h[1], c[2], CY)) underOk++; }
      const mid = roofs.map(R => flakeHidden(roofs, (R[0] + R[2]) / 2, 0, (R[1] + R[3]) / 2, CY)), yard = flakeHidden(roofs, 20, 0, 16, CY);
      const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8'); const common = read('particles_common.wgsl'), draw = read('particles_draw.wgsl');
      const num = Number(/const FLAKE_WALL_IN: f32 = ([0-9.]+);/.exec(common)?.[1]);
      const text = num === FLAKE_WALL_IN && /if \(snowNow\(\)\) \{ if \(flakeHidden\(Pend\)\) \{ discard; \} \}/.test(draw) && /else if \(!rainOutdoors\(Pend\.xz\)\) \{ discard; \}/.test(draw) && /if \(P\.y > CEIL_Y - 0\.05\) \{ return false; \}/.test(common);
      verdict(A.wx.kind === 'snow' && roofs.length >= 1 && walls >= 8 && outerOpen === walls && innerDry === walls && topOpen === walls && underOk === walls && oldHid === walls && mid.every(Boolean) && !yard && text,
        'walls — snow shows in front of a building\'s outer wall and over its top, and the rooms stay dry to the eye',
        `${roofs.length} roof(s), ${walls} outer walls of the pass: outer face in the open ${outerOpen}, inner face under the roof ${innerDry}, top in the open ${topOpen}, all three with the roofs asked as one (SNOW_LOOK.under) ${underOk} (the bare rectangle hid the outer face of ${oldHid}) · each roof's middle hidden: ${mid.join(' ')} · the yard hidden: ${yard} · the shader carries the same ${FLAKE_WALL_IN} m and keeps the rain's rule for rain: ${text}`); }
    // ---- save
    { const snap = A.wx.snapshot(); const T = await rig('pass.json', false, 'overcast'); const was0 = T.wx.kind, no = T.wx.refuses(snap); T.wx.restore(snap);
      verdict(snap.kind === 'snow' && was0 === 'overcast' && no === null && T.wx.kind === 'snow' && T.wx.snowRate > 0, 'save — a checkpoint made in snow carries the kind and puts it back', `the snapshot's kind ${snap.kind} · a game standing in ${was0} takes it (${no ?? 'not refused'}): ${T.wx.kind}, snowfall ${T.wx.snowRate}`); }
    // ---- old
    { let ok = false, how = '';
      try { SNOW.on = true; const k = (J as any).knobsSnapshot(A.g); const had = !!k.tables && 'SNOW' in k.tables; delete k.tables.SNOW; (J as any).applyKnobs(A.g, k); ok = had && SNOW.on === false; how = `the table rides in a recording: ${had} · with it taken out, the switch after applyKnobs: ${SNOW.on}`; } catch (e) { how = `threw: ${(e as Error).message}`; }
      verdict(ok, 'old — a recording from before the switch replays with it off', how); }
  } finally { SNOW.on = was; WEATHER_BOOT.kind = bootWas; if (envWas === undefined) delete process.env.TPS_SNOW; else process.env.TPS_SNOW = envWas; }
  console.log(`\nsnow-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOW_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
