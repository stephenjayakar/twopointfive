// EVERY THING THAT MOVES OVER LYING SNOW MARKS IT, A MARK FORMS AND KICKS SNOW UP BY HOW HARD IT WAS MADE, AND THE GAME DOES NOT KNOW
// (src/game/weatherKinds.ts SNOW_LOOK.marks; src/game/snowMarks.ts; src/game/snowTracks.ts stampMark / formSnowTracks; the kick: src/game/snowFx.ts markKicks).
//
//   bun run tools/qa/snowmarks-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWMARKS_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts snowmarks      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switches where each line needs them by the stand's own words —
//   TPS_SNOWMARKS, TPS_SNOWLOOK, TPS_SNOWTRACKS, TPS_SNOW.
//
// The harness has no GPU: a furrow is bytes in the prints' map here, a kick is records filed into a stand-in pool — never a furrow, a print sinking in or a
// puff of snow SEEN.
//   stands    held off on the frozen stand, TPS_SNOWMARKS=1 raises it, on as the page opens; the FROZEN_HOLDS row; a recording with no `marks` key replays off
//   furrow    a chair stood on open snow and shoved: its legs cut grooves along the way it went (pressed under where each leg passed), marks counted; a chair
//             that is not moved cuts nothing
//   weight    a broad foot rides high under a light thing and presses to the floor under a heavy one; a leg cuts to the floor whatever it weighs
//   thrown    a thing coming down hard on the snow dents it where it lands, a harder landing is a harder mark; set down gently, and lying on a desk: nothing
//   debris    a chunk that comes down on the snow dents it, and one that comes to rest lies in a dent; one high in the air marks nothing
//   where     under a roof (no lying snow): a shoved chair cuts nothing
//   forms     a mark is not whole at once: just pressed, its floor is under its depth and what it threw is not there; it only ever deepens; formed, it is byte
//             for byte the mark the switch-off build presses at once; a harder mark forms faster
//   kick      a mark kicks loose snow up: flake records at the mark, more of them the harder it was made, none with the switch off
//   off       the switch off: a shoved chair and a landing leave the map as it was, a print is whole on its frame, nothing is forming, nothing is kicked
//   same      the same shove in two fresh games: the same bytes
//   digest    the game does not know: 240 stepped frames of the pass with a chair shoved over the snow, on and off — one game digest
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowMarksCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`);
  const { updateSnowFx, seedSnow, marksKicked, kicksOwed } = await import(`${ROOT}/src/game/snowFx.ts`);
  const ST = await import(`${ROOT}/src/game/snowTracks.ts`);
  const { TRACK_RES, SNOWTRACKS } = ST;
  const SM = await import(`${ROOT}/src/game/snowMarks.ts`);
  const { SNOWMARKS } = SM;
  const { snowFieldAt } = await import(`${ROOT}/src/render/snowField.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { snowConfig, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWMARKS_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWMARKS', 'TPS_SNOWTRACKS', 'TPS_SNOWAIR', 'TPS_SNOWBLAST'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, lived: LIVED.on, cfg: snowConfig.on, lookW: snowLookConfig.wisps, lookG: snowLookConfig.grains, env: ENV.map(k => process.env[k]), form: SNOWTRACKS.form };

  /** a game stood up on the pass in snow with the prints up and its rooms lived in (the chairs), the marks' switch where `on` says — by the stand's own word.
   *  `word` false: no word for the marks at all (the stand as it is). */
  async function rig(on: boolean, word = true) {
    const sw = on && !BREAK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; process.env.TPS_SNOWTRACKS = '1'; process.env.TPS_SNOWAIR = '0'; process.env.TPS_SNOWBLAST = '0';
    if (word) { process.env.TPS_SNOWMARKS = sw ? '1' : '0'; SNOW_LOOK.marks = !sw; }   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    else { delete process.env.TPS_SNOWMARKS; SNOW_LOOK.marks = harnessProfile() === 'shipped' ? was.look.marks : true; }
    LIVED.on = true;
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood: boolean = SNOW_LOOK.marks;
    const set = () => { SNOW_LOOK.marks = sw; SNOW_LOOK.on = true; SNOW_LOOK.tracks = true; SNOW_LOOK.oneAir = false; SNOW_LOOK.blast = false; }; set();
    const step = (n = 1) => { for (let i = 0; i < n; i++) { set(); W.step(DT); } };
    return { W, g, step, set, stood, sw };
  }
  type Rig = Awaited<ReturnType<typeof rig>>;
  const bytes = (g: any) => g.snowTracks ? (g.snowTracks.data as Uint8Array) : new Uint8Array(0);
  const rows = (g: any) => g.snowTracks ? (g.snowTracks.h - 3) * g.snowTracks.w : 0;   // (the map's own rows: the mess rides in the pad rows under them)
  const hash = (g: any) => { let h = 2166136261 >>> 0; const d = bytes(g), n = rows(g); for (let i = 0; i < n; i++) { h ^= d[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
  const byteAt = (T: any, x: number, z: number) => { const tx = Math.floor((x - WORLD.min[0]) * TRACK_RES), tz = Math.floor((z - WORLD.min[2]) * TRACK_RES); return tx >= 0 && tz >= 0 && tx < T.w && tz < T.h - 3 ? T.data[tz * T.w + tx] : 0; };
  /** the most pressed byte within `r` m of (x, z) */
  const mostAt = (T: any, x: number, z: number, r: number) => { let m = 0; const k = Math.ceil(r * TRACK_RES); const cx = Math.floor((x - WORLD.min[0]) * TRACK_RES), cz = Math.floor((z - WORLD.min[2]) * TRACK_RES); for (let dz = -k; dz <= k; dz++) for (let dx = -k; dx <= k; dx++) { const tx = cx + dx, tz = cz + dz; if (tx < 0 || tz < 0 || tx >= T.w || tz >= T.h - 3) continue; const b = T.data[tz * T.w + tx]; if (b > m) m = b; } return m; };
  const blank = (T: any) => ({ data: new Uint8Array(T.w * T.h), w: T.w, h: T.h, dirty: null as any });
  /** open snow for a chair: every point within 1.6 m is covered, and no man stands on it */
  const openAt = (g: any, x: number, z: number) => { const F = g.snowField; if (!F) return false; for (let dz = -1.6; dz <= 1.61; dz += 0.4) for (let dx = -1.6; dx <= 1.61; dx += 0.4) if (snowFieldAt(F, x + dx, z + dz).cover < 0.9) return false; return true; };
  const YARD: [number, number] = [15, 21];
  /** stand a chair of the level on the yard's open snow, still */
  const chairOut = (R: Rig, at: [number, number] = YARD) => { const p = R.g.props.props.find((p: any) => p.def.kind === 'chair'); if (!p) return null; p.x = at[0]; p.z = at[1]; p.vx = 0; p.vz = 0; p.w = 0; p.place(); p.wake(); return p; };
  /** shove it for `frames` frames, then let it run out; where each of its floor parts was, every frame */
  const shove = (R: Rig, p: any, frames = 24, total = 90) => { const path: number[][] = []; for (let i = 0; i < total; i++) { if (i < frames) R.g.props.applyImpulse(p, [p.x, 0.3, p.z], [p.mass * 0.35, 0, p.mass * 0.12], 0); R.step(1); path.push(p.boxes.flatMap((b: any, j: number) => p.def.parts[j].off[1] - p.def.parts[j].h[1] <= SNOWMARKS.reach ? [b.c[0], b.c[2]] : [])); } return path; };
  /** a thrown thing as the marks read one (throwables.ts Item, the fields they read) */
  const item = (x: number, z: number, y: number, vy: number, r = 0.045) => ({ pos: [x, y, z], vel: [0.5, vy, 0], radius: r, bounces: 0, settled: false, on: null as any });
  const chunk = (x: number, z: number, y: number, vy: number) => ({ box: { c: [x, y, z], h: [0.22, 0.03, 0.15] }, v: [0.3, vy, 0], rest: false, on: null as any });
  const fake = (items: any[], chunks: any[]) => ({ props: { props: [] }, items: { items }, destr: { debris: { list: chunks } } });
  /** a stand-in for the particle pool that records what is filed */
  const mk = () => { const recs: any[] = []; let queue: any[] = []; const P: any = { params: { rain: { gravity: 9.8, drag: 9.8 / 9, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 } }, rainLook: { refractReachM: -1, refractClamp: -1, refractDepth: -1 }, rainStats: { live: 0, emitted: 0 }, grainCfg: new Float32Array(28).fill(-1), cleared: 0,
      emit(kind: string, pos: number[], dir: number[], count: number, opts: any) { if (queue.length >= 24) return 0; const r = { kind, pos: [...pos], dir: [...dir], count, opts: { ...opts } }; queue.push(r); recs.push(r); return count; },
      draw() { let room = 640; for (const r of queue) { const n = Math.min(r.count, room); room -= n; P.rainStats.emitted += n; P.rainStats.live += n; } queue = []; },
      clearRain() { P.cleared++; queue = []; P.rainStats.live = 0; } }; return { P, recs }; };
  /** one drawn frame of the snow's particles against `pool`, the view on the yard */
  const draw = (R: Rig, pool: { P: any }) => { const e = R.g.engine as any; const had = { p: e.particles, gp: e.settings.gpuParticles, pr: e.settings.particleRain };
    snowConfig.on = true; snowLookConfig.wisps = false; snowLookConfig.grains = false; R.set(); e.particles = pool.P; e.settings.gpuParticles = true; e.settings.particleRain = true;
    pool.P.draw(); updateSnowFx(R.g, DT, { distance: 21, target: [YARD[0], 0, YARD[1]] } as any);
    e.particles = had.p; e.settings.gpuParticles = had.gp; e.settings.particleRain = had.pr; };
  const isKick = (r: any) => r.kind === 'rain' && (r.opts.aspect ?? 1) < 1.5 && r.pos[1] < 0.3 && r.dir[1] > 0.5;

  try {
    // ---- stands
    { const N = await rig(true, false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig(false); const U = await rig(true); const row = FROZEN_HOLDS['SNOW_LOOK.marks']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOW_LOOK.marks = true; const carries = 'marks' in (snap().tables.SNOW_LOOK ?? {}); const old = snap(); delete old.tables.SNOW_LOOK.marks; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOW_LOOK.marks;
      SNOW_LOOK.marks = true; const own = snap(); SNOW_LOOK.marks = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOW_LOOK.marks;
      verdict(bare === shipped && J.stood === false && U.stood === true && typeof row === 'string' && /TPS_SNOWMARKS=1/.test(row) && carries && without === false && withIt === true,
        'stands — held off on the frozen stand, on as the page opens; a recording from before the key replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWMARKS=0 → ${J.stood}, =1 → ${U.stood} · FROZEN_HOLDS['SNOW_LOOK.marks'] = ${row ? `'${row.slice(0, 15)}…'` : 'no row'} · the journal carries the key: ${carries}; applyKnobs with no \`marks\` key → ${without}, with it on → ${withIt}`); }

    // ---- furrow, same
    let hashA = '';
    { const A = await rig(true); const T = A.g.snowTracks; const p = chairOut(A); const open = openAt(A.g, YARD[0], YARD[1]);
      const about = () => { let n = 0; if (T) for (let dz = -1; dz <= 1; dz += 0.05) for (let dx = -1; dx <= 1; dx += 0.05) if (byteAt(T, YARD[0] + dx, YARD[1] + dz)) n++; return n; };
      A.step(2); const h0 = hash(A.g), m0 = T ? T.marks : -1, a0 = about();
      A.step(30); const still = about() === a0 && a0 === 0 && T && T.marks === m0;   // (it stands there: nothing)
      const from = p ? [p.x, p.z] : [0, 0]; const path = p ? shove(A, p) : []; if (T) ST.settleSnowTracks(T);
      const went = p ? Math.hypot(p.x - from[0], p.z - from[1]) : 0;
      // under where each floor part passed (every sixth frame of its run, short of its last stroke): pressed past the outline
      let asked = 0, pressed = 0; const legs = path.length ? path[0].length / 2 : 0;
      for (let i = 6; i < path.length; i += 6) { const moved = Math.hypot(path[i][0] - path[i - 6][0], path[i][1] - path[i - 6][1]); if (moved < 0.03) break; for (let k = 0; k < legs; k++) { if (snowFieldAt(A.g.snowField, path[i - 6][k * 2], path[i - 6][k * 2 + 1]).cover < 0.9 || snowFieldAt(A.g.snowField, path[i][k * 2], path[i][k * 2 + 1]).cover < 0.9) continue; asked++; if (T && mostAt(T, path[i - 6][k * 2], path[i - 6][k * 2 + 1], 0.05) > 200) pressed++; } }
      hashA = hash(A.g);
      verdict(!!T && !!p && open && still === true && went > 0.5 && legs === 4 && asked >= 8 && pressed === asked && T.marks > m0 + 3 && hashA !== h0,
        'furrow — a chair shoved over open snow cuts a groove under each leg, along the way it went; standing, it cuts nothing',
        `${p ? `${p.def.name} (${p.mass} kg) stood on the yard at (${YARD[0]}, ${YARD[1]})${open ? '' : ' (NOT open snow)'}` : 'NO chair on the level'}: 30 frames standing, the map the same and no mark: ${still} · shoved: ${went.toFixed(2)} m, ${legs} legs on the floor · pressed to the floor under ${pressed} of ${asked} points its legs passed over snow · ${T ? T.marks - m0 : 0} marks counted`);
      const B = await rig(true); const pb = chairOut(B); B.step(32); if (pb) shove(B, pb); if (B.g.snowTracks) ST.settleSnowTracks(B.g.snowTracks);
      verdict(!!pb && hash(B.g) === hashA && hashA !== h0, 'same — the same shove in two fresh games presses the same bytes', `${hashA} and ${hash(B.g)}`); }

    // ---- weight (the stampers themselves)
    { const R = await rig(true); const T = R.g.snowTracks; const a = blank(T), b = blank(T), c = blank(T);
      ST.pressGroove(a, 10, 10, 10.3, 10, 0.2, 0.2, 0.2 + 0.8 * (3 / SNOWMARKS.deepKg), SNOWMARKS.mess); ST.pressGroove(b, 10, 10, 10.3, 10, 0.2, 0.2, 1, SNOWMARKS.mess); ST.pressGroove(c, 10, 10, 10.3, 10, SNOWMARKS.legMin, SNOWMARKS.legMin, 1, SNOWMARKS.mess * 0.6);
      const la = mostAt(a, 10.15, 10, 0.1), lb = mostAt(b, 10.15, 10, 0.1), lc = mostAt(c, 10.15, 10, 0.03), edge = mostAt(a, 10.15, 10.6, 0.02);
      verdict(la > 128 && la < 200 && lb >= 250 && lc >= 250 && edge === 0, 'weight — a broad foot rides high under a light thing and presses to the floor under a heavy one; a leg cuts to the floor',
        `a 0.4 m foot's furrow under 3 kg: byte ${la} (the outline is 128, the floor 255) · under ${SNOWMARKS.deepKg} kg: ${lb} · a leg's groove: ${lc} · 0.6 m to its side: ${edge}`); }

    // ---- thrown, debris (the marks' own step on stand-in things over the yard)
    { const R = await rig(true); const T = R.g.snowTracks, F = R.g.snowField; R.set();
      const [x, z] = YARD; const hard = item(x, z, 0.5, -6), soft = item(x + 2, z, 0.5, -2.2), gentle = item(x + 4, z, 0.5, -0.3), desk = item(x - 2, z, 0.5, -6); desk.on = {};
      const G = fake([hard, soft, gentle, desk], []);
      const m0 = T.marks; SM.updateSnowMarks(G as any, T, F, DT);   // (first sight: nothing)
      const seen = T.marks === m0 && T.forming.length === 0;
      for (const it of [hard, soft, gentle, desk]) { it.pos[1] = it.radius + 0.002; it.bounces = 1; it.vel[1] = 1; }
      SM.updateSnowMarks(G as any, T, F, DT); const fHard = T.forming.find((m: any) => !m.thrown && Math.abs(m.x0 / TRACK_RES - x) < 1), fSoft = T.forming.find((m: any) => !m.thrown && Math.abs(m.x0 / TRACK_RES - (x + 2)) < 1);
      const kicks = T.kicks.slice(); ST.settleSnowTracks(T);
      const bh = mostAt(T, x, z, 0.04), bs = mostAt(T, x + 2, z, 0.04), bg = mostAt(T, x + 4, z, 0.2), bd = mostAt(T, x - 2, z, 0.2);
      const kh = kicks.find((k: any) => Math.abs(k.x - x) < 0.1), ks = kicks.find((k: any) => Math.abs(k.x - x - 2) < 0.1);
      verdict(seen && bh > 200 && bs > 140 && bs < bh && bg > 128 === false && bd === 0 && !!fHard && !!fSoft && fHard.sink < fSoft.sink && !!kh && !!ks && kh.force > ks.force,
        'thrown — a thing coming down on the snow dents it where it lands, harder the harder it came; lying on a desk: nothing',
        `first seen in the air: no mark: ${seen} · down at 6 m/s: byte ${bh} at its landing, force ${kh ? kh.force.toFixed(2) : '—'}, formed in ${fHard ? (fHard.sink * 1000).toFixed(0) : '—'} ms · at 2.2 m/s: byte ${bs}, force ${ks ? ks.force.toFixed(2) : '—'}, ${fSoft ? (fSoft.sink * 1000).toFixed(0) : '—'} ms · its first touch at 0.3 m/s: byte ${bg} (a light dent at most) · on a desk: ${bd}`);
      const R2 = await rig(true); const T2 = R2.g.snowTracks; R2.set();
      const fall = chunk(x, z, 0.4, -5), high = chunk(x + 3, z, 2.5, -5), lie = chunk(x - 3, z, 0.04, 0);
      const G2 = fake([], [fall, high, lie]); SM.updateSnowMarks(G2 as any, T2, R2.g.snowField, DT);
      fall.box.c[1] = 0.05; fall.v[1] = 0.5; high.box.c[1] = 2.4; lie.rest = true;
      SM.updateSnowMarks(G2 as any, T2, R2.g.snowField, DT); ST.settleSnowTracks(T2);
      const cf = mostAt(T2, x, z, 0.05), ch = mostAt(T2, x + 3, z, 0.4), cl = mostAt(T2, x - 3, z, 0.05);
      verdict(cf > 200 && ch === 0 && cl > 128, 'debris — a chunk that comes down on the snow dents it, one that comes to rest lies in a dent; high in the air: nothing',
        `a panel down at 5 m/s: byte ${cf} under it · the same 2.4 m up: ${ch} · one that came to rest: ${cl}`); }

    // ---- roll (a thing rolling on over the snow: a shallow groove in strokes — never a dent a half step, which is what the pool's bounce count would give)
    { const R = await rig(true); const T = R.g.snowTracks, F = R.g.snowField; R.set(); const [x, z] = [YARD[0] - 1, YARD[1] + 1.5];
      const it = item(x, z, 0.5, -6); const G = fake([it], []); SM.updateSnowMarks(G as any, T, F, DT);
      it.pos[1] = it.radius + 0.002; it.vel = [2, 0.6, 0]; it.bounces = 1; SM.updateSnowMarks(G as any, T, F, DT); const m1 = T.marks, k1 = T.kicks.length;
      for (let i = 0; i < 30; i++) { it.pos[0] += 2 * DT; it.vel[1] = i % 2 ? 0.05 : -0.05; it.bounces += 2; SM.updateSnowMarks(G as any, T, F, DT); }   // (a metre of rolling, the count ticking twice a frame as the pool's does)
      ST.settleSnowTracks(T); const strokes = T.marks - m1, dent = mostAt(T, x, z, 0.03), mid = mostAt(T, x + 0.5, z, 0.03), past = mostAt(T, x + 1.4, z, 0.03);
      verdict(m1 === 1 && strokes >= 4 && strokes <= 8 && T.kicks.length === k1 && dent > 200 && mid > 128 && mid < dent && past === 0,
        'roll — a thing rolling on from its landing lays one shallow groove, a stroke at a time, and no dent a half step',
        `one landing mark, then a metre rolled in 30 frames: ${strokes} strokes (a dent a frame would be 30), no kick · byte ${dent} at the landing, ${mid} half a metre along (the outline is 128), ${past} past where it got to`); }

    // ---- fog (nothing live shows in the fog: a thing on floor the team does not see marks nothing while it is there)
    { const R = await rig(true); const T = R.g.snowTracks, F = R.g.snowField; R.set(); const [x, z] = YARD;
      const seenIt = item(x - 3, z + 2, 0.5, -6), darkIt = item(x + 3, z + 2, 0.5, -6), darkCh = chunk(x + 3, z - 2, 0.4, -5);
      const G: any = fake([seenIt, darkIt], [darkCh]); G.fogOfWar = { active: true, bared: false, spotSeen: (px: number) => px < x };
      SM.updateSnowMarks(G, T, F, DT); for (const it of [seenIt, darkIt]) { it.pos[1] = it.radius + 0.002; it.vel[1] = 1; } darkCh.box.c[1] = 0.05; darkCh.v[1] = 0.5;
      SM.updateSnowMarks(G, T, F, DT); ST.settleSnowTracks(T);
      const bs = mostAt(T, x - 3, z + 2, 0.04), bd = mostAt(T, x + 3, z + 2, 0.2), bc = mostAt(T, x + 3, z - 2, 0.3);
      // … and the game's own step with every spot in the fog: a chair shoved over the yard cuts nothing; the fog lifted (bared), it does
      const D = await rig(true); const fog = D.g.fogOfWar; const p = chairOut(D); D.step(2);
      Object.defineProperty(fog, 'active', { get: () => true, configurable: true }); const was = fog.spotSeen; fog.spotSeen = () => false; fog.bared = false;
      const m0 = D.g.snowTracks.marks; if (p) shove(D, p, 24, 60); const inFog = D.g.snowTracks.marks - m0, went = p ? Math.hypot(p.x - YARD[0], p.z - YARD[1]) : 0;
      fog.spotSeen = was; delete (fog as any).active;
      verdict(bs > 200 && bd === 0 && bc === 0 && !!p && went > 0.5 && inFog === 0,
        'fog — a thing on floor the team does not see marks nothing: a landing, a chunk, a chair shoved',
        `a landing in sight: byte ${bs} · the same in the fog: ${bd} · a chunk down in the fog: ${bc} · a chair shoved ${went.toFixed(2)} m over the yard with every spot in the fog: ${inFog} marks`); }

    // ---- where
    { const R = await rig(true); const T = R.g.snowTracks; const p = R.g.props.props.find((p: any) => p.def.kind === 'chair'); const cover = p ? snowFieldAt(R.g.snowField, p.x, p.z).cover : NaN;
      const at = p ? [p.x, p.z] : [0, 0]; const about = () => { let n = 0; for (let dz = -2; dz <= 2; dz += 0.05) for (let dx = -2; dx <= 2; dx += 0.05) if (byteAt(T, at[0] + dx, at[1] + dz)) n++; return n; };
      R.step(2); const h0 = about(), m0 = T.marks; if (p) { p.wake(); shove(R, p, 16, 50); } ST.settleSnowTracks(T); const went = p ? Math.hypot(p.x - at[0], p.z - at[1]) : 0;
      verdict(!!p && cover < 0.5 && went > 0.2 && about() === h0 && T.marks === m0, 'where — under a roof no snow lies: a chair shoved in its own room cuts nothing',
        `${p ? `${p.def.name} where the level put it (cover ${cover.toFixed(2)})` : 'NO chair'} shoved ${went.toFixed(2)} m: marked points within 2 m ${h0} → ${about()} · marks ${T.marks - m0}`); }

    // ---- forms (the forming itself, on a print-sized mark and a hard one)
    { const R = await rig(true); const T = R.g.snowTracks; R.set(); const [x, z] = [YARD[0] + 1.5, YARD[1] - 2];
      const mark = (TT: any, force: number, at: number) => ST.stampMark(TT, force, (body: any, thrown: any) => { ST.pressGroove(body, at, z, at + 0.2, z, 0.06, 0.06, 1, 0.5); ST.pressClods(thrown, at + 0.1, z, 6, 0.12, 0.3, 0, 0, 3); });
      const zeroAt = (at: number) => { let n = 0; for (let dz = -0.5; dz <= 0.5; dz += 1 / TRACK_RES) for (let dx = -0.4; dx <= 0.6; dx += 1 / TRACK_RES) if (byteAt(T, at + dx, z + dz)) n++; return n; };
      mark(T, 0.45, x); const f0 = T.forming.find((m: any) => !m.thrown), t0 = T.forming.find((m: any) => m.thrown);
      const b0 = mostAt(T, x + 0.1, z, 0.02), n0 = zeroAt(x);
      let mono = true, prev = new Uint8Array(T.data); const seq: number[] = [];
      for (let i = 0; i < 40; i++) { ST.formSnowTracks(T, DT); for (let k = 0; k < prev.length; k++) if (T.data[k] < prev[k]) { mono = false; break; } prev.set(T.data); if (i % 4 === 0) seq.push(mostAt(T, x + 0.1, z, 0.02)); }
      const done = T.forming.length === 0;
      // … against the same mark pressed with the switch off, in a fresh map
      const O = await rig(false); const TO = O.g.snowTracks; O.set(); mark(TO, 0.45, x); const offB = mostAt(TO, x + 0.1, z, 0.02), offNow = TO.forming.length === 0 && offB > 200;
      R.set(); let same = TO.data.length === T.data.length; if (same) for (let k = 0; k < rows(R.g); k++) if (T.data[k] !== TO.data[k]) { same = false; break; }
      mark(T, 1.2, x + 3); const f1 = T.forming.find((m: any) => !m.thrown); ST.settleSnowTracks(T);
      verdict(!!f0 && !!t0 && b0 === 0 && n0 === 0 && t0.delay > 0 && mono && done && seq[seq.length - 1] === offB && seq[0] > 128 && seq[0] < offB && seq[1] > seq[0] && offNow && same && !!f1 && f1.sink < f0.sink,
        'forms — a mark sinks in over a moment, what it threw lands after, it only ever deepens, and formed it is byte for byte the mark pressed at once',
        `just pressed: byte ${b0} at its middle (formed: ${offB}), its lumps held back ${t0 ? (t0.delay * 1000).toFixed(0) : '—'} ms · its middle every 4 frames: ${seq.slice(0, 6).join(' ')} · never a byte lowered: ${mono} · all formed after 40 frames: ${done} · the switch-off build presses it whole at once: ${offNow}; the two maps alike: ${same} · a walker's mark forms in ${f0 ? (f0.sink * 1000).toFixed(0) : '—'} ms, a sprinter's in ${f1 ? (f1.sink * 1000).toFixed(0) : '—'} ms`); }

    // ---- kick
    { const A = await rig(true); const T = A.g.snowTracks; seedSnow(A.g, 1); const pool = mk(); A.step(2); draw(A, pool); A.set();
      for (let i = 0; i < 60; i++) draw(A, pool);   // (the first fill of the falling snow is in: the frame's births have room again)
      const n0 = pool.recs.filter(isKick).length;
      ST.stampMark(T, 0.45, (b: any) => ST.pressGroove(b, YARD[0], YARD[1], YARD[0], YARD[1], 0.06, 0.06, 1, 0), { x: YARD[0], z: YARD[1], dx: 1, dz: 0, wide: 0.1 });
      ST.stampMark(T, 1.2, (b: any) => ST.pressGroove(b, YARD[0] + 2, YARD[1], YARD[0] + 2, YARD[1], 0.06, 0.06, 1, 0), { x: YARD[0] + 2, z: YARD[1], dx: 1, dz: 0, wide: 0.1 });
      const queued = T.kicks.length, owed0 = kicksOwed(A.g); draw(A, pool); const k = pool.recs.filter(isKick).slice(n0), owed1 = kicksOwed(A.g), listed = T.kicks.length;   // (the game's list is only read: the pool's taking is the host's book, snowFx.ts kicksOwed — the list is time's to empty)
      const walk = k.find((r: any) => Math.abs(r.pos[0] - YARD[0]) < 0.01), run = k.find((r: any) => Math.abs(r.pos[0] - YARD[0] - 2) < 0.01);
      const B = await rig(false); seedSnow(B.g, 1); const poolB = mk(); B.step(2); for (let i = 0; i < 60; i++) draw(B, poolB); B.set();
      ST.stampMark(B.g.snowTracks, 1.2, (b: any) => ST.pressGroove(b, YARD[0], YARD[1], YARD[0], YARD[1], 0.06, 0.06, 1, 0), { x: YARD[0], z: YARD[1], dx: 1, dz: 0, wide: 0.1 }); const qB = B.g.snowTracks.kicks.length; draw(B, poolB);
      // a kick nobody files goes stale: queued with the flakes not drawing, half a second on it is gone and is never filed
      A.set();
      ST.stampMark(T, 1.2, (b: any) => ST.pressGroove(b, YARD[0] + 1, YARD[1] + 1, YARD[0] + 1, YARD[1] + 1, 0.06, 0.06, 1, 0), { x: YARD[0] + 1, z: YARD[1] + 1, dx: 1, dz: 0, wide: 0.1 });
      const waiting = kicksOwed(A.g); for (let i = 0; i < 30; i++) ST.formSnowTracks(T, DT); const stale = T.kicks.length; const nk = pool.recs.filter(isKick).length; draw(A, pool); const late = pool.recs.filter(isKick).length - nk;
      verdict(n0 === 0 && queued === 2 && owed0 === 2 && owed1 === 0 && listed === 2 && waiting === 1 && stale === 0 && late === 0 && !!walk && !!run && walk.count >= 2 && run.count > walk.count * 2 && run.opts.speed > walk.opts.speed && run.dir[0] > 0.2 && T.kicks.length === 0 && qB === 0 && poolB.recs.filter(isKick).length === 0 && marksKicked() > 0,
        'kick — a mark kicks loose snow up: flakes born at it, more and faster the harder it was made; none with the switch off',
        `two marks queued ${queued} kicks · a walker's boot: ${walk ? `${walk.count} flakes going up at ${walk.opts.speed.toFixed(1)} m/s` : 'NONE'} · a sprinter's: ${run ? `${run.count} at ${run.opts.speed.toFixed(1)} m/s, leaning the way he runs` : 'NONE'} · after the frame: ${owed1} still owed of ${owed0}, the game's own list untouched at ${listed} · one left unfiled for half a second: ${waiting} queued → ${stale}, filed late: ${late} · the switch off: ${qB} queued, ${poolB.recs.filter(isKick).length} filed`); }

    // ---- off, digest
    { const run = async (on: boolean) => { const R = await rig(on); const p = chairOut(R); R.step(2); const h0 = hash(R.g); const T = R.g.snowTracks;
        const it = item(YARD[0] + 3, YARD[1] + 1, 0.5, -6); const G = fake([it], []);
        if (R.sw) SM.updateSnowMarks(G as any, T, R.g.snowField, DT);
        it.pos[1] = it.radius; it.bounces = 1; it.vel[1] = 1; if (R.sw) SM.updateSnowMarks(G as any, T, R.g.snowField, DT);
        if (p) shove(R, p); R.step(150); let forming = T.forming.length, kicks = T.kicks.length;
        // a print pressed by the game's own stamper on this stand: whole at once with the switch off
        ST.stampMark(T, 0.45, (b: any) => ST.pressGroove(b, YARD[0] - 3, YARD[1] - 3, YARD[0] - 3, YARD[1] - 3, 0.06, 0.06, 1, 0), { x: YARD[0] - 3, z: YARD[1] - 3 });
        const whole = mostAt(T, YARD[0] - 3, YARD[1] - 3, 0.02) > 200; forming += T.forming.length; kicks += T.kicks.length;
        return { h0, T, marks: T.marks, forming, kicks, whole, digest: hashDigest(digestGame(R.g)), sw: R.sw, moved: p ? Math.hypot(p.x - YARD[0], p.z - YARD[1]) : 0 }; };
      const off = await run(false), on = await run(true);
      const yard = (T: any) => { let n = 0; for (let dz = -1; dz <= 1; dz += 0.1) for (let dx = -0.5; dx <= 2.5; dx += 0.1) if (byteAt(T, YARD[0] + dx, YARD[1] + dz)) n++; return n; };
      verdict(off.marks === 0 && off.forming === 0 && off.kicks === 0 && off.whole && yard(off.T) === 0 && off.moved > 0.5 && yard(on.T) > 20,
        'off — with the switch off a shoved chair and a landing leave the snow as it lay, a print is whole on its frame, nothing forms and nothing is kicked',
        `off: the chair went ${off.moved.toFixed(2)} m · ${yard(off.T)} marked points along its way (on: ${yard(on.T)}) · ${off.marks} marks · ${off.forming} forming · ${off.kicks} kicks queued · a print whole at once: ${off.whole}`);
      verdict(on.digest === off.digest && on.sw === !BREAK && on.marks > 3, 'digest — the game does not know: one game digest with the marks and without',
        `242 frames of the pass with a chair shoved over the yard: ${on.digest} with ${on.marks} marks, ${off.digest} with ${off.marks}`); }
  } finally {
    SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); LIVED.on = was.lived; snowConfig.on = was.cfg; snowLookConfig.wisps = was.lookW; snowLookConfig.grains = was.lookG; SNOWTRACKS.form = was.form;
    ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nsnowmarks: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWMARKS_BREAK=1: the switch never raised — must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowMarksCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
