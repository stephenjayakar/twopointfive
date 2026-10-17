// THE SNOW GOES ON FALLING PAST THE LEVEL'S RIM (SNOW_LOOK.past; ?snowpast=0, TPS_SNOWPAST=1) — game/snowFx.ts flakeOpen / snowPastM, particles_common.wgsl
// snowPast / flakeOpen / pastWorld, particles.wgsl rainStep. The maintainer, of a view by the pass's edge, 10-17: "snowfall missing from bottom left of image".
// A flake high in the air is drawn well off its own ground, toward the camera's foot; with the rim on the camera's side the flakes that would show over the
// near part of the picture are in the air PAST the rim, and none was ever there.
//
//   bun run tools/qa/snowpast-check.ts [--verbose]     exit 0 = all pass, 1 = a FAIL line
//   SNOWPAST_BREAK=1 …                                 = the metres never reach the frame and the same lines asked: must fail
//   TPS_PROFILE=shipped …                              = the same on the stand the page opens on
//
//   stands    held off on the frozen stand, on as the page opens; a recording from before the key replays with it off
//   rim       where a flake may be: under no roof, out to SNOWFX.past metres past the world's rectangle and no further; with it off, a quarter metre inside it
//   frame     the recycler hands the metres to the frame (weatherE.w, negative: the lattice rain's readers ask `> 0`), counts the air past the rim as the
//             flakes' open ground, and files the wisps by the ground INSIDE the rim, as before
//   fills     the picture: flakes thrown as the GPU throws them and drawn through the play camera, the screen in twelve parts — by the rim no part is bare
//             with it on (off: whole parts of the near side are)
//   thick     by the rim the fall on screen is as thick as in the yard: the ring's flakes are one fixed number over all the open air in the disc, so past the
//             rim they thin sooner toward its edge (PAST_TAPER) — with the level's own taper out there the fall by an edge would be a quarter thinner
//   yard      far from any rim nothing moves: the middle of the yard is snowed on as it was
//   off       the switch off: the frame's slot is 0 and the records are the build's as it was
//   digest    the game does not know: one game digest with it on and off
//   text      the shaders carry the rule: the sky's births (not a kick's, a blast's, a wisp's), the step's end, no ray for a step wholly past the world, the
//             splat's rim, the open wind past it
//
// HEADLESS: no GPU — a flake's birth, fall and splat are WGSL nothing here runs. `fills` throws points by the birth kernel's own rule on the CPU (the disc, its
// rim taper, flakeOpen) and projects them with the game's camera; the text line holds the shader's shape; a page boot proves it compiles.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowPastCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const SF = await import(`${ROOT}/src/game/snowFx.ts`);
  const { updateSnowFx, seedSnow, SNOWFX, snowStats, wispStats, flakeOpen, flakeTaper, snowPastM, PAST_TAPER } = SF;
  const { AIR_SIM, updateAirSim } = await import(`${ROOT}/src/game/airSim.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const { FollowCamera } = await import(`${ROOT}/src/game/camera.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWPAST_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  const hush = <T>(fn: () => T): T => { if (o.verbose) return fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWPAST', 'TPS_SNOWAIR', 'TPS_SNOWTRACKS', 'TPS_SNOWGRAINS', 'TPS_SNOWWISPS', 'TPS_SNOWMARKS', 'TPS_SNOWBLAST', 'TPS_AIR'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, air: AIR_SIM.on, cfg: snowConfig.on, lookW: snowLookConfig.wisps, lookG: snowLookConfig.grains, env: ENV.map(k => process.env[k]), past: SNOWFX.past };
  const PAST = SNOWFX.past as number;

  const mkAir = () => ({ w: 200, h: 140, setCells(_m: Uint8Array) { }, setSources(_r: Float32Array, _n: number) { }, reset() { } });
  /** a game stood up on the pass in snow with its surface, the wisps and the one air up, the rim's switch where `on` says — by the stand's own words.
   *  `word` false: no word for it at all (the stand as it is). Under SNOWPAST_BREAK the switch is raised and the metres are 0: nothing reaches the frame. */
  async function rig(on: boolean, word = true, metres = PAST) {
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; process.env.TPS_SNOWTRACKS = '1'; process.env.TPS_SNOWWISPS = '1'; process.env.TPS_SNOWAIR = '1'; process.env.TPS_SNOWGRAINS = '0'; process.env.TPS_SNOWMARKS = '0'; process.env.TPS_SNOWBLAST = '0'; process.env.TPS_AIR = '1';
    if (word) { process.env.TPS_SNOWPAST = on ? '1' : '0'; SNOW_LOOK.past = !on; }   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    else { delete process.env.TPS_SNOWPAST; SNOW_LOOK.past = harnessProfile() === 'shipped' ? was.look.past : true; }
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood: boolean = SNOW_LOOK.past;
    const e = g.engine as any; e.air = mkAir(); e.airWind = [0, 0]; e.airOn = false;
    const set = () => { SNOW_LOOK.past = on; SNOWFX.past = BREAK ? 0 : metres; SNOW_LOOK.on = true; SNOW_LOOK.wisps = true; SNOW_LOOK.oneAir = true; SNOW_LOOK.grains = false; SNOW_LOOK.marks = false; SNOW_LOOK.blast = false; AIR_SIM.on = true; }; set();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { set(); W.step(DT); } };
    return { W, g, e, step, set, stood };
  }
  /** a recording stand-in for the particle pool */
  const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 }, grainCfg: new Float32Array(28).fill(-1), cleared: 0,
      emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], dir: [...dir], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
      draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
      clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
  /** the recycler run `frames` drawn frames against `pool` with the view at `target`; `play` steps the game too */
  const fly = (R: any, pool: { P: any; recs: any[] }, frames: number, target: number[], play = false) => {
    const { P } = pool; const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
    seedSnow(R.g, 1); snowConfig.on = true; snowLookConfig.wisps = true; snowLookConfig.grains = true;
    for (let i = 0; i < frames; i++) {
      if (play) R.step(1);
      R.set(); if (!play) updateAirSim(R.g, DT);
      e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true;
      P.draw(); updateSnowFx(R.g, DT, { distance: 21, target } as any);
      e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr;
    }
    const nf = (e.weather?.nearFade ?? [0, 0, 0, 0]) as number[];
    return { nf: [...nf], S: { ...snowStats(R.g) }, Ws: { ...wispStats(R.g) } };
  };
  const strip = (recs: any[]) => JSON.stringify(recs.map(r => [r.kind, r.pos, r.dir, r.count, r.opts]));

  /** THE PICTURE: flakes thrown as the emit kernel throws them (uniform over the view's disc, thinned by its rim taper, kept where a flake may be), through the
   *  slab's height, drawn through the play camera (55° down, 21 m off, its yaw) on a 16:10 view; what lies nearer the lens than the splat's near fade left out.
   *  Returns each of the screen's 4 × 3 parts' share of the flakes on screen, as a multiple of an even share (1 = a twelfth). */
  const DEG = Math.PI / 180;
  function picture(g: any, look: number[], yawDeg: number, past: number, sooner: readonly [number, number] = PAST_TAPER) {
    const roofed = (x: number, z: number) => !!g.weather?.underRoof(x, z);
    const cam = new FollowCamera(); cam.aspect = 16 / 10; cam.setPin({ look, yaw: yawDeg * DEG, pitch: 55 * DEG, dist: 21 }); cam.update(DT, look as any, [0, 0, 0] as any);
    const R = Math.min(SNOWFX.radiusMax, Math.max(SNOWFX.radiusMin, SNOWFX.radiusK * 21)), top = 7, vp = cam.viewProj as Float32Array;
    const bins = new Float64Array(12); let born = 0, seen = 0, s = 0x1234567;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 240000; i++) {
      const rr = Math.sqrt(rnd()), th = rnd() * 6.2831853, x = look[0] + Math.cos(th) * rr * R, z = look[2] + Math.sin(th) * rr * R, keep = rnd(), y = rnd() * top;
      if (keep >= flakeTaper(rr, x, z, past, sooner) || !flakeOpen(roofed, x, z, past)) continue; born++;
      const X = vp[0] * x + vp[4] * y + vp[8] * z + vp[12], Y = vp[1] * x + vp[5] * y + vp[9] * z + vp[13], Wc = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (Wc <= 0.05) continue; const u = X / Wc * 0.5 + 0.5, v = 0.5 - Y / Wc * 0.5; if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
      if (Math.hypot(x - cam.pos[0], y - cam.pos[1], z - cam.pos[2]) < 0.35 * SNOWFX.nearFadeM) continue;
      seen++; bins[Math.floor(v * 3) * 4 + Math.floor(u * 4)]++;
    }
    const even = Math.max(1, seen) / 12; const parts = Array.from(bins, b => b / even);
    return { parts, least: Math.min(...parts), bare: parts.filter(p => p < 0.25).length, onScreen: seen / Math.max(1, born), seen, text: [0, 1, 2].map(r => parts.slice(r * 4, r * 4 + 4).map(p => p.toFixed(2)).join(' ')).join(' / ') };
  }
  // by the rim: the squad's start on the road (the south rim is the camera's side), the corner he stood at (two rims), and the same corner as he had turned the view
  const ROAD = [11.6, 0, 23.7], CORNER = [4.5, 0, 22.5], YARD = [20, 0, 16];

  try {
    // ---- stands
    { const N = await rig(true, false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig(false); const U = await rig(true); const row = FROZEN_HOLDS['SNOW_LOOK.past']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOW_LOOK.past = true; const carries = 'past' in (snap().tables.SNOW_LOOK ?? {}); const old = snap(); delete old.tables.SNOW_LOOK.past; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOW_LOOK.past;
      SNOW_LOOK.past = true; const own = snap(); SNOW_LOOK.past = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOW_LOOK.past;
      verdict(bare === shipped && J.stood === false && U.stood === true && typeof row === 'string' && /TPS_SNOWPAST=1/.test(row) && carries && without === false && withIt === true,
        'stands — held off on the frozen stand, on as the page opens; a recording from before the key replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWPAST=0 → ${J.stood}, =1 → ${U.stood} · FROZEN_HOLDS['SNOW_LOOK.past'] = ${row ? `'${row.slice(0, 14)}…'` : 'no row'} · the journal carries the key: ${carries}; applyKnobs with no \`past\` key → ${without}, with it on → ${withIt}`); }

    const A = await rig(true); A.step(3); const B = await rig(false); B.step(3);
    A.set(); const mOn = snowPastM(); B.set(); const mOff = snowPastM(); A.set();
    const roofedA = (x: number, z: number) => !!A.g.weather?.underRoof(x, z);

    // ---- rim
    { const x0 = WORLD.min[0], x1 = WORLD.max[0], z0 = WORLD.min[2], z1 = WORLD.max[2];
      const pts: [string, number, number, boolean, boolean][] = [   // name, x, z, a flake may be there with it on, … with it off
        ['the road, inside the rim', 11.6, z1 - 1, true, true], ['the rim\'s last quarter metre', 11.6, z1 - 0.1, true, false], ['3 m past the south rim', 11.6, z1 + 3, true, false],
        [`${(PAST - 0.5).toFixed(1)} m past the west rim`, x0 - (PAST - 0.5), 14, true, false], [`${(PAST + 0.5).toFixed(1)} m past it`, x0 - (PAST + 0.5), 14, false, false],
        ['past the corner, both ways', x1 + 4, z0 - 4, true, false], ['the tea room, under its roof', 17, 8, false, false], ['the yard', 20, 16, true, true]];
      const got = pts.map(([, x, z]) => [flakeOpen(roofedA, x, z, mOn), flakeOpen(roofedA, x, z, mOff)] as const);
      const ok = pts.every((p, i) => got[i][0] === p[3] && got[i][1] === p[4]) && mOff === 0 && mOn === PAST && PAST > 0;
      verdict(ok, 'rim — a flake may be in the air out to the metres past the level\'s rim and no further, never under a roof; off: a quarter metre inside it',
        `the metres: on ${mOn}, off ${mOff} (SNOWFX.past ${PAST}) · ${pts.map((p, i) => `${p[0]}: ${got[i][0] ? 'yes' : 'no'}${got[i][1] === got[i][0] ? '' : ` (off: ${got[i][1] ? 'yes' : 'no'})`}`).join(' · ')}`); }

    // ---- frame (the recycler's own numbers, at the road)
    const pa = mk(), pb = mk(); const fa = hush(() => fly(A, pa, 30, ROAD)); const fb = hush(() => fly(B, pb, 30, ROAD));
    { const flakeRec = (r: any) => (r.opts.aspect ?? 1) < 1.5 && r.dir[1] < -0.5;
      const ok = fa.nf[3] === -PAST && fb.nf[3] === 0 && fa.nf[2] > 0 && fa.S.areaOut > fb.S.areaOut * 1.15 && fa.Ws.target === fb.Ws.target && pa.recs.some(flakeRec) && pb.recs.some(flakeRec);
      verdict(ok, 'frame — the metres ride the frame\'s disc slot NEGATIVE (the lattice rain asks `> 0`), the air past the rim counts as the flakes\' open ground, the wisps are filed by the ground inside it',
        `at the road (${ROAD[0]}, ${ROAD[2]}), disc ${fa.nf[2].toFixed(1)} m: weatherE.w on ${fa.nf[3]}, off ${fb.nf[3]} · the flakes' open ground ${fb.S.areaOut.toFixed(0)} → ${fa.S.areaOut.toFixed(0)} m², their aim ${fb.S.target.toFixed(0)} → ${fa.S.target.toFixed(0)} · the wisps' aim ${fb.Ws.target.toFixed(1)} → ${fa.Ws.target.toFixed(1)} (${fa.Ws.why})`); }

    // ---- fills
    { const views: [string, number[], number][] = [['the road, where the squad starts', ROAD, -22], ['the corner he stood at', CORNER, -22], ['the same corner, the view turned', CORNER, -40]];
      const on = views.map(([, look, yaw]) => picture(A.g, look, yaw, mOn)), off = views.map(([, look, yaw]) => picture(A.g, look, yaw, 0));
      const ok = on.every(p => p.bare === 0 && p.least > 0.55) && off.every(p => p.bare >= 1);
      verdict(ok, 'fills — by the rim no part of the picture is bare of falling snow (off: whole parts of the near side are)',
        views.map(([n], i) => `${n}: least part ${on[i].least.toFixed(2)} of an even share, ${on[i].bare} bare [${on[i].text}] · off: least ${off[i].least.toFixed(2)}, ${off[i].bare} bare [${off[i].text}]`).join('\n    ')); }

    // ---- thick
    { const views: [string, number[], number][] = [['the road', ROAD, -22], ['the corner', CORNER, -22], ['the corner, the view turned', CORNER, -40], ['a metre off both rims', [0.8, 0, 27.2], -22]];
      const yard = picture(A.g, YARD, -22, mOn).onScreen; const on = views.map(([, look, yaw]) => picture(A.g, look, yaw, mOn).onScreen);
      // (the same throws with the level's own taper past the rim too: what the sooner one is for)
      const plain = views.map(([, look, yaw]) => picture(A.g, look, yaw, mOn, [0.7, 1]).onScreen);
      const ok = on.every(v => v > 0.85 * yard && v < 1.2 * yard) && plain.every((v, i) => v < on[i]) && mOn > 0;
      verdict(ok, 'thick — by the rim the fall on screen is as thick as in the middle of the yard (the ring\'s flakes are one fixed number: past the rim they thin sooner toward the disc\'s edge)',
        `of the ring's flakes, on screen: the yard ${(yard * 100).toFixed(0)}% · ${views.map(([n], i) => `${n} ${(on[i] * 100).toFixed(0)}% (with the level's own taper out there: ${(plain[i] * 100).toFixed(0)}%)`).join(' · ')} · the taper past the rim ${PAST_TAPER[0]}‥${PAST_TAPER[1]} of the disc`); }

    // ---- yard
    { const on = picture(A.g, YARD, -22, mOn), off = picture(A.g, YARD, -22, 0); const py = mk(), pz = mk(); const ya = hush(() => fly(A, py, 30, YARD)), yb = hush(() => fly(B, pz, 30, YARD));
      const moved = Math.max(...on.parts.map((p, i) => Math.abs(p - off.parts[i])));
      verdict(moved < 0.08 && ya.S.areaOut < yb.S.areaOut * 1.08 && ya.S.target === yb.S.target, 'yard — far from any rim nothing moves: the yard\'s middle is snowed on as it was',
        `the yard (${YARD[0]}, ${YARD[2]}): the most any part's share moves ${moved.toFixed(3)} · open ground ${yb.S.areaOut.toFixed(0)} → ${ya.S.areaOut.toFixed(0)} m² (the disc's rim reaches past the level there) · the flakes' aim ${yb.S.target.toFixed(0)} → ${ya.S.target.toFixed(0)}`); }

    // ---- off (the records, against a game that never heard of the switch: the number at 0 with the switch up is the same build)
    { const Z = await rig(true, true, 0); Z.step(3); const pz = mk(); const fz = hush(() => fly(Z, pz, 30, ROAD)); SNOWFX.past = PAST;
      const same = strip(pz.recs) === strip(pb.recs);
      verdict(fb.nf[3] === 0 && fz.nf[3] === 0 && same && pb.recs.length > 0, 'off — the switch off (or its metres at 0): the frame\'s slot is 0 and every record is the build\'s as it was',
        `30 frames at the road: switch off → weatherE.w ${fb.nf[3]}, ${pb.recs.length} records · switch on with SNOWFX.past 0 → weatherE.w ${fz.nf[3]}, ${pz.recs.length} records, the same bytes: ${same}`); }

    // ---- digest
    { const run = async (on: boolean) => { const D = await rig(on); D.step(3); const pool = mk(); hush(() => fly(D, pool, 200, ROAD, true)); return hashDigest(digestGame(D.g)); };
      const d1 = await run(true), d0 = await run(false);
      verdict(d1 === d0, 'digest — the game does not know: one digest with the snow falling past the rim and without', `200 frames of the pass: on ${d1} · off ${d0}`); }

    // ---- text
    { const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8'); const step = read('particles.wgsl'), com = read('particles_common.wgsl'), vol = read('volumetrics.wgsl');
      const slot = /fn snowPast\(\) -> f32 \{ return max\(-frame\.weatherE\.w, 0\.0\); \}/.test(com) && (vol.match(/frame\.weatherE\.w > 0\.0/g) ?? []).length >= 2 && !/weatherE\.w\s*(!=|<)/.test(vol);
      const open = /fn flakeOpen\(p: vec2f\) -> bool \{\s*let m = snowPast\(\);\s*if \(m <= 0\.0\) \{ return rainOutdoors\(p\); \}\s*return all\(p > WORLD_MIN\.xz - vec2f\(m\)\) && all\(p < WORLD_MAX\.xz \+ vec2f\(m\)\) && rainOutdoors\(clamp\(p, WORLD_MIN\.xz \+ vec2f\(0\.26\), WORLD_MAX\.xz - vec2f\(0\.26\)\)\);/.test(com);
      const born = /let skyRec = snowNow\(\) && !wispRec && !grainRec && abs\(rec\.posB\.x - frame\.weatherE\.z\) < 0\.5 && distance\(rec\.pos\.xz, frame\.weatherE\.xy\) < 2\.0;/.test(step) && /if \(skyRec\) \{ open = flakeOpen\(q2\);/.test(step) && /else \{ open = rainOutdoors\(q2\); \}\s*\n\s*ok = open && rnd\(seed, 22u \+ t \* 3u\) < keep;/.test(step);
      const ends = /var gone = p\.pos\.y < -0\.2;\s*if \(snowNow\(\) && snowPast\(\) > 0\.0\) \{ gone = gone \|\| !flakeOpen\(p\.pos\.xz\) \|\| p\.pos\.y > WORLD_MAX\.y; \}[^\n]*\n\s*else \{ gone = gone \|\| !rainOutdoors\(p\.pos\.xz\) \|\| any\(p\.pos < WORLD_MIN\) \|\| any\(p\.pos > WORLD_MAX\); \}/.test(step);
      const thin = new RegExp(`const PAST_RIM_IN = ${PAST_TAPER[0]}; const PAST_RIM_OUT = ${PAST_TAPER[1]};`).test(com) && /if \(skyRec\) \{ open = flakeOpen\(q2\); if \(snowPast\(\) > 0\.0 && pastWorld\(vec3f\(q2\.x, 0\.0, q2\.y\)\)\) \{ keep = min\(rim, 1\.0 - smoothstep\(PAST_RIM_IN, PAST_RIM_OUT, rr\)\); \} \}/.test(step);
      const trace = /if \(\(em\.flags & 2u\) != 0u && !\(snowNow\(\) && snowPast\(\) > 0\.0 && pastWorld\(p\.pos\) && pastWorld\(p\.pos \+ mv\)\)\) \{/.test(step);
      const lit = /let head = rainShadeV\(p\.pos, V, T, k1, !snowNow\(\)\);/.test(step);
      const splat = /if \(snowPast\(\) <= 0\.0 && !\(q\.x > WORLD_MIN\.x \+ 0\.25 && q\.y > WORLD_MIN\.z \+ 0\.25 && q\.x < WORLD_MAX\.x - 0\.25 && q\.y < WORLD_MAX\.z - 0\.25\)\) \{ return true; \}/.test(com);
      const wind = /fn pastRimAir\(p: vec3f\) -> f32 \{ return smoothstep\(0\.0, 1\.5, max\(max\(WORLD_MIN\.x - p\.x, p\.x - WORLD_MAX\.x\), max\(WORLD_MIN\.z - p\.z, p\.z - WORLD_MAX\.z\)\)\); \}/.test(step) && /let b = max\(smoothstep\(grain\.g\.x, max\(grain\.g\.y, grain\.g\.x \+ 0\.01\), p\.y\), pastRimAir\(p\)\);/.test(step);
      const wisp = /if \(!rainOutdoors\(p\.pos\.xz\) \|\| p\.pos\.y < -0\.2 \|\| p\.pos\.y > WISP_TOP \|\| any\(p\.pos < WORLD_MIN\) \|\| any\(p\.pos > WORLD_MAX\)\)/.test(step);
      verdict(slot && open && born && thin && ends && trace && lit && splat && wind && wisp, 'text — the shaders: the sky\'s flake is born, falls and shows past the rim by the frame\'s metres; a wisp, a grain, a kick, a blast\'s throw are born inside it',
        `the frame's slot, read negative, and the lattice's own reads still \`> 0.0\`: ${slot} · flakeOpen is rainOutdoors at 0, and over it the rim grown by the metres with rainOutdoors' own roofs: ${open} · only the sky's own record asks it at birth (its disc is the view's): ${born} · past the rim it thins by the game's own two shares: ${thin} · the step ends a flake by it: ${ends} · no ray for a step wholly past the world: ${trace} · lit where it is: ${lit} · the splat's rim test stands down: ${splat} · the open wind past the rim: ${wind} · a wisp's step keeps the world's rim: ${wisp}`); }
  } finally {
    SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); AIR_SIM.on = was.air; snowConfig.on = was.cfg; snowLookConfig.wisps = was.lookW; snowLookConfig.grains = was.lookG; SNOWFX.past = was.past;
    ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nsnowpast-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWPAST_BREAK=1: the metres never reach the frame — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowPastCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
