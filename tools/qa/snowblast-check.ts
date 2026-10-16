// A BLAST OVER LYING SNOW MARKS IT, AND THE GAME DOES NOT KNOW (src/game/weatherKinds.ts SNOW_LOOK.blast, src/game/snowBlast.ts; the crater: snowTracks.ts
// pressCrater; the throw: particles.wgsl grainStep's blast branch off render/particles.ts grainCfg; the puff: wisp records with no gust length; the shove:
// airSim.ts airPuff). With it: how a flying grain is drawn (SNOWGRAINS shutter / dash / tail → grainCfg → the grain → particles_draw.wgsl grainVertex).
//
//   bun run tools/qa/snowblast-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWBLAST_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snowblast      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switches where each line needs them by the stand's own words —
//   TPS_SNOWBLAST, TPS_SNOWLOOK, TPS_SNOWTRACKS, TPS_SNOWGRAINS, TPS_SNOWWISPS, TPS_AIR, TPS_SNOW.
//
// The harness has no GPU: a crater is bytes in the prints' map here, a throw is eight numbers handed to the grains' step, a puff is records filed into a stand-in
// pool, the shove is a source in the air's list — never a crater, a burst or a swirl SEEN.
//   stands    held off on the frozen stand, TPS_SNOWBLAST=1 raises it, on as the page opens; the FROZEN_HOLDS row; a recording with no `blast` key replays off
//   crater    a blast low over open snow: a pan pressed to the floor at its middle, a bank about its lip, rays and clods beyond it; one crater counted
//   same      the same blast in two fresh games: the same bytes
//   where     under a roof (no lying snow): not a byte; high over the snow: not a byte; another level: nothing at all
//   feed      the destruction engine's own blast feed is heard: g.destr.blast over the yard marks it, once (the engine tells nobody with its switch off or at
//             chaos 0, where the frozen harness stands: the line raises both, as the page has them)
//   dig       a blast in a bank: no snow box that still stands is bared and nothing is raised; the bank taken (as a charge's hole takes it), its hill goes to
//             the ground; asked again nothing more goes; a hill 6 m off is as it was; a restart stands it again
//   throw     the grains' numbers carry the blast for its throw (place, disc, a rate, the speeds) and then let go; the dash's three numbers ride behind them
//   puff      wisp records at the blast with no gust length, SNOWBLAST.puff of them; none with the wisps off
//   air       one short radial source in the air's list, gone when its time is up
//   off       the switch off: a blast leaves the bytes, the pool and the air as they were
//   digest    the game does not know: 300 stepped frames of the pass with three blasts in them, on and off — one game digest
//   text      the shaders: the throw stands in the grains' step behind the grains' own guard, off open ground only, and a grain's light is capped (a grain
//             thrown through a lamp's own point took the software page black: found by booting it, 10-15); a puff record skips the gust and the stand-back; the dash is the
//             grain's own numbers (no shutter compiled in), cut to a few widths, its tail faded; the emitter block's tail has not grown
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowBlastCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { updateSnowFx, seedSnow, SNOWGRAINS } = await import(`${ROOT}/src/game/snowFx.ts`);
  const SB = await import(`${ROOT}/src/game/snowBlast.ts`);
  const { SNOWBLAST, snowBlastAt, snowBlastStats } = SB;
  const { TRACK_RES, SNOWTRACKS } = await import(`${ROOT}/src/game/snowTracks.ts`);
  const { snowFieldAt, snowPaintOf } = await import(`${ROOT}/src/render/snowField.ts`);
  const { AIR_SIM, updateAirSim, airPuffs } = await import(`${ROOT}/src/game/airSim.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const PT = await import(`${ROOT}/src/render/particles.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWBLAST_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  const hush = <T>(fn: () => T): T => { if (o.verbose) return fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOWMARKS', 'TPS_SNOWAIR', 'TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWBLAST', 'TPS_SNOWTRACKS', 'TPS_SNOWGRAINS', 'TPS_SNOWWISPS', 'TPS_AIR'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, air: AIR_SIM.on, destr: DESTRUCTION.on, cfg: snowConfig.on, lookW: snowLookConfig.wisps, lookG: snowLookConfig.grains, env: ENV.map(k => process.env[k]) };

  const mkAir = () => ({ w: 200, h: 140, cells: 0, sources: 0, resets: 0, last: 0, setCells(_m: Uint8Array) { this.cells++; }, setSources(_r: Float32Array, n: number) { this.sources++; this.last = n; }, reset() { this.resets++; } });
  /** a game stood up on `file` in snow with the prints, the wisps, the grains and the air up, the blast's switch where `on` says — by the stand's own words.
   *  `word` false: no word for the blast at all (the stand as it is). */
  async function rig(file: string, on: boolean, word = true, wisps = true) {
    const sw = on && !BREAK;
    process.env.TPS_SNOWAIR = '0'; process.env.TPS_SNOWMARKS = '0'; process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; process.env.TPS_SNOWTRACKS = '1'; process.env.TPS_SNOWGRAINS = '1'; process.env.TPS_SNOWWISPS = wisps ? '1' : '0'; process.env.TPS_AIR = '1';
    if (word) { process.env.TPS_SNOWBLAST = sw ? '1' : '0'; SNOW_LOOK.blast = !sw; }   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    else { delete process.env.TPS_SNOWBLAST; SNOW_LOOK.blast = harnessProfile() === 'shipped' ? was.look.blast : true; }
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood: boolean = SNOW_LOOK.blast;
    const e = g.engine as any; const field = mkAir(); e.air = field; e.airWind = [0, 0]; e.airOn = false;
    const set = () => { SNOW_LOOK.oneAir = false; SNOW_LOOK.marks = false; SNOW_LOOK.blast = sw;   // (marks off: a crater is whole on its frame, as these lines read it — a mark that FORMS is snowmarks-check's)
      SNOW_LOOK.on = true; SNOW_LOOK.tracks = true; SNOW_LOOK.grains = true; SNOW_LOOK.wisps = wisps; AIR_SIM.on = true; }; set();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { set(); W.step(DT); } };
    return { W, g, e, field, step, set, stood, sw, wx: g.weather as any };
  }
  /** a recording stand-in for the particle pool, with the grains' numbers at their real length */
  const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 }, grainCfg: new Float32Array(20).fill(-1), cleared: 0,
      emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 12) return 0; const r = { kind, pos: [...pos], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
      draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
      clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
  const isPuff = (r: any) => (r.opts.aspect ?? 1) > 1.5 && (r.opts.aspect ?? 1) < 2.5 && Array.isArray(r.opts.color) && r.opts.color[2] === 0;
  /** the recycler run `frames` drawn frames against `pool` with the view at `target`; `each(i)` runs before frame i (a blast goes off there); `play` steps the game too */
  const fly = (R: any, pool: { P: any; recs: any[] }, frames: number, target: number[], each?: (i: number) => void, play = false) => {
    const { P } = pool; const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
    seedSnow(R.g, 1); snowConfig.on = true; snowLookConfig.wisps = SNOW_LOOK.wisps; snowLookConfig.grains = true;
    const cfg: number[][] = []; const src: number[] = [];
    for (let i = 0; i < frames; i++) {
      if (play) R.step(1);
      R.set(); each?.(i); if (!play) updateAirSim(R.g, DT);
      e.particles = P; e.settings.gpuParticles = true; e.settings.particleRain = true;
      P.draw(); updateSnowFx(R.g, DT, { distance: 21, target } as any);
      e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr;
      cfg.push(Array.from(P.grainCfg as Float32Array)); src.push(airPuffs(R.g));
    }
    return { cfg, src };
  };
  const bytes = (g: any) => g.snowTracks ? (g.snowTracks.data as Uint8Array) : new Uint8Array(0);
  const marks = (g: any) => { let n = 0; const d = bytes(g); const rows = g.snowTracks ? (g.snowTracks.h - 3) * g.snowTracks.w : 0; for (let i = 0; i < rows; i++) if (d[i]) n++; return n; };   // (the map's own rows: the mess rides in the pad rows under them)
  const hash = (g: any) => { let h = 2166136261 >>> 0; const d = bytes(g); for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
  const byteAt = (g: any, x: number, z: number) => { const T = g.snowTracks; if (!T) return 0; const tx = Math.floor((x - WORLD.min[0]) * TRACK_RES), tz = Math.floor((z - WORLD.min[2]) * TRACK_RES); return tx >= 0 && tz >= 0 && tx < T.w && tz < T.h - 3 ? T.data[tz * T.w + tx] : 0; };

  try {
    // ---- stands
    { const N = await rig('pass.json', true, false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig('pass.json', false); const U = await rig('pass.json', true); const row = FROZEN_HOLDS['SNOW_LOOK.blast']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOW_LOOK.blast = true; const carries = 'blast' in (snap().tables.SNOW_LOOK ?? {}); const old = snap(); delete old.tables.SNOW_LOOK.blast; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOW_LOOK.blast;
      SNOW_LOOK.blast = true; const own = snap(); SNOW_LOOK.blast = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOW_LOOK.blast;
      verdict(bare === shipped && J.stood === false && U.stood === true && typeof row === 'string' && /TPS_SNOWBLAST=1/.test(row) && carries && without === false && withIt === true,
        'stands — held off on the frozen stand, on as the page opens; a recording from before the key replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWBLAST=0 → ${J.stood}, =1 → ${U.stood} · FROZEN_HOLDS['SNOW_LOOK.blast'] = ${row ? `'${row.slice(0, 15)}…'` : 'no row'} · the journal carries the key: ${carries}; applyKnobs with no \`blast\` key → ${without}, with it on → ${withIt}`); }

    const A = await rig('pass.json', true); A.step(3);
    // open snow nearest the world's middle with lying snow all about it, and a spot under a roof with none about it
    const lies = (g: any, x: number, z: number, r: number) => { let n = 0; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (snowFieldAt(g.snowField, x + Math.cos(a) * r, z + Math.sin(a) * r).cover >= 0.5) n++; } return n + (snowFieldAt(g.snowField, x, z).cover >= 0.5 ? 1 : 0); };
    let yard: number[] | null = null, roofed: number[] | null = null; { const cx = (WORLD.min[0] + WORLD.max[0]) / 2, cz = (WORLD.min[2] + WORLD.max[2]) / 2; let best = 1e9, bestR = 1e9;
      if (A.g.snowField) for (let x = WORLD.min[0] + 3; x < WORLD.max[0] - 3; x += 0.5) for (let z = WORLD.min[2] + 3; z < WORLD.max[2] - 3; z += 0.5) { const d = Math.hypot(x - cx, z - cz);
        const n3 = lies(A.g, x, z, 3), n1 = lies(A.g, x, z, 1.5);
        if (n3 === 9 && n1 === 9 && !A.wx.underRoof(x, z) && d < best) { best = d; yard = [x, 0.2, z]; }
        if (n3 === 0 && n1 === 0 && A.wx.underRoof(x, z) && d < bestR) { bestR = d; roofed = [x, 0.2, z]; } } }
    const Y = yard ?? [20, 0.2, 14], Rf = roofed ?? [0, 0.2, 0];
    const R0 = 2.5;   // (a frag's destruction radius: frag.ts FRAG.destrM)

    // ---- crater
    { const before = marks(A.g); const did = snowBlastAt(A.g, Y, R0); const S = snowBlastStats(A.g); const size = S.last?.size ?? 0; const T = A.g.snowTracks;
      const mid = byteAt(A.g, Y[0], Y[2]); let lip = 0, lipN = 0, far = 0;
      for (let k = 0; k < 64; k++) { const a = k * Math.PI / 32; for (let r = size * 0.8; r < size * 1.6; r += 1 / TRACK_RES) { const b = byteAt(A.g, Y[0] + Math.cos(a) * r, Y[2] + Math.sin(a) * r); if (b > 0 && b < 128) { lip++; break; } } lipN++; }
      for (let x = -size * 4.5; x <= size * 4.5; x += 1 / TRACK_RES) for (let z = -size * 4.5; z <= size * 4.5; z += 1 / TRACK_RES) { if (Math.hypot(x, z) > size * 1.9 && byteAt(A.g, Y[0] + x, Y[2] + z) > 0) far++; }
      verdict(!!yard && did === true && T && T.craters === 1 && S.marked === 1 && mid >= 150 && lip >= lipN * 0.7 && far > 40 && marks(A.g) - before > 800 && size > 0.4 && size < 1,
        'crater — a blast low over open snow blows a pan into it, banks its lip and scatters rays and clods beyond',
        `the yard at (${Y[0].toFixed(1)}, ${Y[2].toFixed(1)})${yard ? '' : ' (NO open snow found)'}: snowBlastAt → ${did} ('${S.why}') · a pan ${size.toFixed(2)} m in radius · the byte at its middle ${mid} (≥ 150: pressed) · a bank in the byte's lower half on ${lip} of ${lipN} spokes about the lip · ${far} marked texels beyond 1.9 radii (rays, clods) · ${marks(A.g) - before} texels marked in all · craters counted ${T?.craters ?? 'no map'}`); }
    // ---- same
    { const B = await rig('pass.json', true); B.step(3); snowBlastAt(B.g, Y, R0); const C = await rig('pass.json', true); C.step(3); snowBlastAt(C.g, Y, R0); snowBlastAt(C.g, [Y[0] + 1, 0.2, Y[2]], R0); const hB = hash(B.g), hA = hash(A.g), hC = hash(C.g);
      verdict(hA === hB && hC !== hB && marks(B.g) > 800, 'same — the same blast in two fresh games leaves the same bytes; a second one beside it its own shape', `${hA} and ${hB}; with a second blast a metre on ${hC} (${marks(C.g)} texels against ${marks(B.g)})`); }
    // ---- where
    { const B = await rig('pass.json', true); B.step(3); const m0 = marks(B.g);
      const r1 = snowBlastAt(B.g, Rf, R0), w1 = snowBlastStats(B.g).why, m1 = marks(B.g);
      const r2 = snowBlastAt(B.g, [Y[0], 3, Y[2]], R0), w2 = snowBlastStats(B.g).why, m2 = marks(B.g);
      const r3 = snowBlastAt(B.g, [Y[0], 0.9, Y[2]], R0), s3 = snowBlastStats(B.g).last?.size ?? 0; const r4 = snowBlastAt(B.g, [Y[0] + 4, 0.2, Y[2]], R0), s4 = snowBlastStats(B.g).last?.size ?? 0;
      const C = await rig('compound.json', true); C.step(3); const rc = snowBlastAt(C.g, [20, 0.2, 14], R0);
      verdict(!!roofed && r1 === false && m1 === m0 && r2 === false && m2 === m0 && r3 === true && r4 === true && s3 < s4 && rc === false && !C.g.snowTracks && airPuffs(C.g) === 0,
        'where — only where snow lies and only from low over it; another level is not touched',
        `under a roof at (${Rf[0].toFixed(1)}, ${Rf[2].toFixed(1)})${roofed ? '' : ' (NO roofed spot found)'}: ${r1} ('${w1}'), ${m1 - m0} texels · 3 m over the yard: ${r2} ('${w2}'), ${m2 - m0} texels · 0.9 m over it: a pan ${s3.toFixed(2)} m against ${s4.toFixed(2)} m from the ground · compound.json, the switch up: ${rc}, no map, ${airPuffs(C.g)} air sources`); }
    // ---- feed: the destruction engine's own blast, as a frag, an HE round and a charge all call it
    { DESTRUCTION.on = true; const B = await rig('pass.json', true); DESTRUCTION.on = true; B.g.tune.chaos = 0.5; B.step(3); const m0 = marks(B.g); const has = typeof B.g.destr?.blast === 'function';
      if (has) hush(() => B.g.destr.blast([Y[0], 0.2, Y[2]], { who: 0, radius: R0, power: 1 })); const S = snowBlastStats(B.g);
      verdict(has && S.blasts === 1 && S.marked === 1 && marks(B.g) - m0 > 800, 'feed — a blast through the destruction engine is heard, once', `g.destr.blast over the yard (destruction on: ${DESTRUCTION.on}): ${S.blasts} heard, ${S.marked} marked the snow, ${marks(B.g) - m0} texels`); DESTRUCTION.on = was.destr; }
    // ---- dig: the standing snow (the field's hills, baked once) is dug out by a blast in it
    { const B = await rig('pass.json', true); B.step(3); const g = B.g, F = g.snowField, bx: any[] = g.level.boxes; const S = snowBlastStats(g);
      const inPlan = (b: any, x: number, z: number, pad = 0) => { const c = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0), px = x - b.c[0], pz = z - b.c[2]; return Math.abs(c * px - sn * pz) <= b.h[0] + pad && Math.abs(sn * px + c * pz) <= b.h[2] + pad; };
      const snowBox = (b: any, i: number) => i !== F?.slab && !(b.flags & 3) && snowPaintOf(b) === 'snow' && b.c[1] - b.h[1] <= 0.06 && b.c[1] + b.h[1] >= 0.03;
      // a bank: the crest tier of deep snow (its top over 0.3 m, the hill over it higher still), the biggest first
      const tier = F ? bx.filter((b, i) => snowBox(b, i) && b.c[1] + b.h[1] > 0.3 && snowFieldAt(F, b.c[0], b.c[2]).mound > 0.3).sort((p, q) => q.h[0] * q.h[2] - p.h[0] * p.h[2])[0] : null;
      const P = tier ? [tier.c[0], 0.3, tier.c[2]] : [0, 0.3, 0], ok0 = !!F && !!tier, pI = ok0 ? Math.floor((P[2] - WORLD.min[2]) * 10) * F.w + Math.floor((P[0] - WORLD.min[0]) * 10) : -1;
      const fh = () => { let h = 2166136261 >>> 0; if (F) for (let i = 0; i < F.mound.length; i++) { h ^= Math.round(F.mound[i] * 4096); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
      // the texels within 0.4 m of the blast · a hill well clear of it: the highest texel over 6 m off
      const near: number[] = []; let farI = -1; if (ok0) for (let i = 0; i < F.mound.length; i++) { const x = WORLD.min[0] + (i % F.w + 0.5) / 10, z = WORLD.min[2] + (Math.floor(i / F.w) + 0.5) / 10, d = Math.hypot(x - P[0], z - P[2]); if (d < 0.4) near.push(i); if (d > 6 && (farI < 0 || F.mound[i] > F.mound[farI])) farI = i; }
      const baked = ok0 ? F.mound.slice() : new Float32Array(0), over = () => { let n = 0; if (ok0) for (let i = 0; i < baked.length; i++) if (F.mound[i] > baked[i]) n++; return n; }, most = () => ok0 ? Math.max(...near.map(i => F.mound[i])) : NaN;
      const m0 = ok0 ? F.mound[pI] : NaN, top0 = tier ? tier.c[1] + tier.h[1] : NaN, far0 = ok0 ? F.mound[farI] : NaN, h0 = fh(); let rects = 0; const gb = g.engine?.gbuffer; if (gb) { const o = gb.setSnowFieldRect?.bind(gb); gb.setSnowFieldRect = (f: any, r: any) => { rects++; o?.(f, r); }; }
      const did = snowBlastAt(g, P, R0); B.step(1); const m1 = ok0 ? F.mound[pI] : NaN, over1 = over();
      const taken = bx.filter((o, i) => snowBox(o, i) && inPlan(o, P[0], P[2], 2.5)); for (const o of taken) o.flags |= 3; B.step(1); const m2 = most(), h2 = fh(), dug2 = S.dug, over2 = over();   // (the bank taken, as furnblast.ts takes what stands in a hole's mouth: hidden, no ray's and no body's)
      B.step(12); const dug3 = S.dug, h3 = fh(), far1 = ok0 ? F.mound[farI] : NaN, half = ok0 ? F.data[pI * 4] : -1;
      for (const o of taken) o.flags &= ~3; SB.clearSnowBlast(g); B.step(1); const m4 = ok0 ? F.mound[pI] : NaN, h4 = fh();
      verdict(ok0 && did === true && m0 > 0.3 && top0 > 0.3 && m1 >= top0 && m1 <= m0 && over1 === 0 && taken.length > 0 && m2 === 0 && half === 0 && dug2 >= 1 && over2 === 0 && h3 === h2 && dug3 === dug2 && far1 === far0 && far0 > 0.2 && m4 === m0 && h4 === h0 && (!gb || rects >= 2),
        'dig — a blast in a bank never bares a snow box that still stands; the bank taken, its hill goes to the ground; nothing is ever raised; a restart stands it again',
        `${ok0 ? `a blast on the bank at (${P[0].toFixed(1)}, ${P[2].toFixed(1)}), its box ${top0.toFixed(2)} m` : 'NO bank found'}: the hill over it ${m0.toFixed(2)} m → ${m1.toFixed(2)} m on the blast's frame (the box still stands) · ${taken.length} snow boxes taken: the highest texel within 0.4 m ${m2.toFixed(3)} m (the middle's half ${half}; ${dug2} digs) · texels over the baked hill: ${over1} then ${over2} · asked 12 frames more: ${h3 === h2 && dug3 === dug2 ? 'not a texel moved, nothing handed over' : `IT MOVED (${dug3 - dug2} digs)`} · a hill ${far0.toFixed(2)} m high over 6 m off: ${far1 === far0 ? 'as it was' : far1.toFixed(2)} · after a restart ${m4.toFixed(2)} m, the field ${h4 === h0 ? 'as baked' : 'NOT as baked'}${gb ? ` · ${rects} rects handed to the g-buffer` : ' · (no g-buffer on this stand)'}`); }
    // ---- throw, puff, air
    { const B = await rig('pass.json', true); B.step(3); const pool = mk(); fly(B, pool, 20, Y);   // (the grains are up and filed before the blast)
      const n0 = pool.recs.length; const r = fly(B, pool, 40, Y, (i) => { if (i === 0) snowBlastAt(B.g, Y, R0); });
      const size = snowBlastStats(B.g).last?.size ?? 0; const K = SNOWBLAST;
      const on = r.cfg.filter(c => c[11] > 0), first = on[0] ?? [], later = r.cfg[r.cfg.length - 1];
      const wantFrames = Math.round(K.throwS / DT);
      const okThrow = on.length >= wantFrames - 1 && on.length <= wantFrames + 2 && Math.abs(first[8] - Y[0]) < 1e-3 && Math.abs(first[9] - Y[2]) < 1e-3 && Math.abs(first[10] - size * K.throwR) < 1e-3 && first[11] > 1 && first[12] > 1 && first[13] > 0.5 && later[11] === 0 && later[7] === 1;
      const okDash = later[19] === SNOWGRAINS.wispsBack && Math.abs(later[16] - SNOWGRAINS.shutter) < 1e-6 && later[17] === SNOWGRAINS.dash && Math.abs(later[18] - SNOWGRAINS.tail) < 1e-6 && SNOWGRAINS.shutter <= 0.012 && SNOWGRAINS.dash <= 5;
      verdict(okThrow, 'throw — the grains are handed the blast for its throw, then let go', `${on.length} frames with a rate (throwS ${K.throwS} s = ${wantFrames}) · the first: at (${(first[8] ?? NaN).toFixed(1)}, ${(first[9] ?? NaN).toFixed(1)}), disc ${(first[10] ?? NaN).toFixed(2)} m, ${(first[11] ?? NaN).toFixed(1)} of the lying grains a second, out ${(first[12] ?? NaN).toFixed(1)} m/s, up ${(first[13] ?? NaN).toFixed(1)} m/s · 40 frames on: rate ${later[11]}, the grains still up (${later[7]})`);
      verdict(okDash, 'dash — how a flying grain is drawn rides with the grains\' numbers: a short dash, a few widths at most, a fading tail', `grainCfg[16‥18] = ${later[16].toFixed(4)} s, ${later[17]} widths, tail ${later[18].toFixed(2)}, and [19] the wisps' stand-back ${later[19]} (SNOWGRAINS.wispsBack ${SNOWGRAINS.wispsBack}) (SNOWGRAINS shutter ${SNOWGRAINS.shutter}, dash ${SNOWGRAINS.dash}, tail ${SNOWGRAINS.tail}; it was 0.022 s with no cap and no fade)`);
      const puffs = pool.recs.slice(n0).filter(isPuff); const pn = puffs.reduce((n: number, p: any) => n + p.count, 0); const p0 = puffs[0];
      const Wn = await rig('pass.json', true, true, false); Wn.step(3); const poolN = mk(); fly(Wn, poolN, 20, Y, (i) => { if (i === 5) snowBlastAt(Wn.g, Y, R0); });
      verdict(pn === K.puff && !!p0 && Math.abs(p0.pos[0] - Y[0]) < 1e-3 && Math.abs(p0.pos[2] - Y[2]) < 1e-3 && Math.abs(p0.opts.radius - size * K.puffR) < 1e-3 && p0.opts.speed === K.puffOut && pool.recs.slice(0, n0).filter(isPuff).length === 0 && poolN.recs.filter(isPuff).length === 0,
        'puff — a ring of powder is filed at the blast as wisp records with no gust length; none before it, none with the wisps off', `${pn} wisps in ${puffs.length} record${puffs.length === 1 ? '' : 's'} (SNOWBLAST.puff ${K.puff})${p0 ? ` at (${p0.pos[0].toFixed(1)}, ${p0.pos[2].toFixed(1)}), disc ${p0.opts.radius.toFixed(2)} m, ${p0.opts.speed} m/s out, colour [${p0.opts.color}]` : ''} · before the blast ${pool.recs.slice(0, n0).filter(isPuff).length} · the wisps' switch down: ${poolN.recs.filter(isPuff).length}`);
      const up = r.src.filter(n => n > 0).length; const wantUp = Math.round(K.airS / DT);
      verdict(r.src[0] === 1 && up >= wantUp - 2 && up <= wantUp + 2 && r.src[r.src.length - 1] === 0, 'air — one short shove in the air\'s sources, gone when its time is up', `${r.src[0]} source on the blast's frame, live for ${up} frames (airS ${K.airS} s = ${wantUp}), ${r.src[r.src.length - 1]} at the end`); }
    // ---- off
    { const B = await rig('pass.json', false); B.g.tune.chaos = 0.5; B.step(3); const pool = mk(); const m0 = marks(B.g); let ret: boolean[] = [];
      DESTRUCTION.on = true; const r = fly(B, pool, 30, Y, (i) => { if (i === 3) { ret.push(snowBlastAt(B.g, Y, R0)); hush(() => B.g.destr?.blast?.([Y[0] + 2, 0.2, Y[2]], { who: 0, radius: R0, power: 1 })); } }); DESTRUCTION.on = was.destr;
      const rate = Math.max(...r.cfg.map(c => c[11])); const S = snowBlastStats(B.g);
      verdict(B.stood === false && ret[0] === false && marks(B.g) === m0 && rate <= 0 && pool.recs.filter(isPuff).length === 0 && Math.max(...r.src) === 0 && S.blasts === 0,
        'off — the switch off: a blast leaves the snow, the pool and the air as they were', `the switch as the stand left it: ${B.stood} · snowBlastAt → ${ret[0]}; ${marks(B.g) - m0} texels; the highest throw rate handed over ${rate}; ${pool.recs.filter(isPuff).length} puff records; ${Math.max(...r.src)} air sources; ${S.blasts} blasts heard off the engine's feed`); }
    // ---- digest
    { const run = async (on: boolean) => { DESTRUCTION.on = true; const D = await rig('pass.json', on); DESTRUCTION.on = true; D.g.tune.chaos = 0.5; D.step(3); const pool = mk();
        fly(D, pool, 300, Y, (i) => { if (i === 20 || i === 21 || i === 150) hush(() => D.g.destr.blast([Y[0] + (i - 20) * 0.02, 0.2, Y[2]], { who: 0, radius: R0, power: 1 })); }, true);
        const out = { h: hashDigest(digestGame(D.g)), marked: snowBlastStats(D.g).marked, craters: D.g.snowTracks?.craters ?? 0 }; DESTRUCTION.on = was.destr; return out; };
      const d1 = await run(true), d0 = await run(false);
      verdict(d1.h === d0.h && d1.marked === 3 && d0.marked === 0 && d1.craters === 3 && d0.craters === 0, 'digest — the game does not know: one digest with three blasts marking the snow and with none', `300 frames of the pass, three blasts through the destruction engine: ${d1.h} with ${d1.marked} marked (${d1.craters} craters), ${d0.h} with ${d0.marked}`); }
    // ---- text
    { const read = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8'); const sim = read('particles.wgsl'), draw = read('particles_draw.wgsl'), common = read('particles_common.wgsl');
      const body = (src: string, fn: string) => { const i = src.indexOf(`\nfn ${fn}(`); if (i < 0) return ''; const j = src.indexOf('\n}\n', i); return src.slice(i, j < 0 ? undefined : j); };
      const step = body(sim, 'grainStep'), vert = body(draw, 'grainVertex');
      const cfg = /struct GrainCfg \{ a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f \};/.test(sim);
      const thr = /if \(grain\.c\.w > 0\.0 && grain\.b\.w > 0\.5 && /.test(step) && /grain\.c\.xy \+ dir \* \(rr \* max\(grain\.c\.z, 0\.05\)\)/.test(step) && /grain\.d\.x/.test(step) && /grain\.d\.y/.test(step);
      const ground = /distance\(q, E\.xy\) < Rn && airAt\(q\)\.w > 0\.5\) \{/.test(step) && /if \(ok && y < 0\.35\) \{/.test(step) && /p\.shade = min\(select\([^;]*\), vec3f\(GRAIN_SHADE_MAX\)\);/.test(step) && /const GRAIN_SHADE_MAX: f32 = [0-9.]+;/.test(common);
      const pack = /p\.color = u32\(clamp\(grain\.e\.x, 0\.0, 0\.999\) \* 4096\.0\)/.test(step);
      const puff = /let puffRec = SNOW_WISPS && wispRec && \(\(rec\.k\.w >> 16u\) & 255u\) == 0u;/.test(sim) && /wispRec && ok && !puffRec && !snowOneAir\(\)\) \{ ok = rnd\(seed, 200u \+ t\) < wispGust\(/.test(sim) && /wispRec && ok && !puffRec && grain\.b\.w > 0\.5/.test(sim) && /wispRec && ok && !puffRec && snowOneAir\(\)\) \{ let Aq = airAt\(q2\);/.test(sim) && /if \(SNOW_WISPS\) \{ if \(puffRec\) \{/.test(sim);
      const only = (draw.match(/\bdashK\b|\btailK\b/g) ?? []).length === (vert.match(/\bdashK\b|\btailK\b/g) ?? []).length;   // (a rain streak's own vertex shares these lines' shape: the cut is the grain's alone)
      const dash = only && !/GRAIN_SHUTTER/.test(sim + draw + common.replace(/\/\/.*$/gm, '')) && /let shutter = f32\(p\.color & 4095u\)/.test(vert) && /let L = min\(L0, dashK \* 2\.0 \* halfW\);/.test(vert) && /o\.prm2 = vec4f\([^;]*, 2\.0 \+ tailK, 1\.0\);/.test(vert) && /if \(SNOW_GRAINS\) \{ if \(v\.prm2\.z > 1\.5\) \{/.test(draw);
      const back = /< mix\(1\.0, smoothstep\(0\.55, 1\.0, distance\(q2, frame\.weatherE\.xy\) \/ max\(grain\.a\.y, 1\.0\)\), clamp\(grain\.e\.w, 0\.0, 1\.0\)\)/.test(sim);
      const buf = /makeBuffer\(device, 112, [^)]*'particleGrains'\)/.test(readFileSync(resolve(ROOT, 'src/render/particles.ts'), 'utf8')) && PT.BLOCK_TAIL_BYTES === 16 + 6 * 16;
      verdict(cfg && thr && ground && pack && puff && dash && back && buf, 'text — the shaders: the throw in the grains\' step, the puff record past the gust and the stand-back, the dash off the grain\'s own numbers',
        `GrainCfg carries five rows: ${cfg} · the throw's branch reads grain.c / .d inside grainStep: ${thr}; the step packs the dash's numbers into the grain: ${pack} · thrown only off open ground (the air's map open, not a box high) and no grain's light over GRAIN_SHADE_MAX: ${ground} · puffRec told by no gust length and let past both thinnings, born running out: ${puff} · no shutter compiled in, the dash cut to dashK widths, the tail's fade handed to the fragment behind SNOW_GRAINS: ${dash} · the wisps' stand-back is a live share (grain.e.w): ${back} · the grains' buffer is 80 bytes and the emitter block's tail has not grown (${PT.BLOCK_TAIL_BYTES} bytes): ${buf}`); }
  } finally {
    SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); AIR_SIM.on = was.air; DESTRUCTION.on = was.destr; snowConfig.on = was.cfg; snowLookConfig.wisps = was.lookW; snowLookConfig.grains = was.lookG;
    ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nsnowblast-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWBLAST_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowBlastCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
