// A SNOW LEVEL'S LYING SNOW IS ONE SOFT SURFACE, AND THAT IS ONLY A PICTURE (src/game/weatherKinds.ts SNOW_LOOK.on, src/render/snowField.ts,
// src/render/shaders/snow.wgsl).
//
// The maintainer on his first look at the pass on a GPU, 10-14: "not sure i'm feeling the snow. i think it does need to feel more organic. maybe we could do it
// with a height map or something like that? the rectangles don't seem to work. and i think we can make the material seem much cooler / feel like freshly fallen
// snow." So the level's placed snow (its slab, paths, ruts, cleared earth, drifts and banks: boxes in the snow paints) is baked into one field over the plan and
// drawn off that; the boxes stay exactly what they are to a boot, a round and a ray.
//
//   bun run tools/qa/snowlook-check.ts [--verbose] [--fast]     exit 0 = all pass, 1 = a FAIL line        (--fast: without the played runs)
//   SNOWLOOK_BREAK=1 …   = the hills are baked a finger UNDER their boxes (the boxes stand out of the snow, as rectangles): must fail
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_SNOWLOOK.
//   What it cannot see: the picture (no GPU here) — the shading, the mesh, the glints are judged on stills.
//
//   field     the pass, switch on: the game holds a field — snow over the open yard, none deep under a roof, trodden on the road, hills standing, a mesh to draw
//   under     every solid snow box of the level lies UNDER the surface, corners and centre: the hill over it is at least a centimetre above its top
//   edge      the lying snow reaches the level's bounds all the way round and nothing of it is drawn past them (black outside the map)
//   soft      no straight edge of the file survives: the road's edge wanders by centimetres along ten metres, and cleared earth's edge is not its rectangle
//   untouched the level's boxes are the file's, look on or off: same count, same places, sizes, flags and paint
//   off       switch off: no field; another level, switch on: no field; the uniform block of a page with no field is all zero (nothing is shaded)
//   same      a room clear on the pass plays the same with the look on and off: one PLAYED run each per seed, one digest every half second
//   old       a recording from before the switch replays with it off (journal.ts applyKnobs)
import { standUp, ROOT } from './headless.ts';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

export async function snowLookCheck(o: { verbose?: boolean; fast?: boolean } = {}): Promise<boolean> {
  const { SNOW, SNOW_LOOK, WEATHER_BOOT } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const SF = await import(`${ROOT}/src/render/snowField.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWLOOK_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { snow: SNOW.on, look: SNOW_LOOK.on, wisps: SNOW_LOOK.wisps }, env = { snow: process.env.TPS_SNOW, look: process.env.TPS_SNOWLOOK }, bootWas = WEATHER_BOOT.kind;

  /** a game stood up on `file` with the look where `on` says, by the stand's own word (the frozen stand's pin and the shipped stand's boot both obey) */
  async function rig(file: string, on: boolean) {
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = on ? '1' : '0'; SNOW.on = false; SNOW_LOOK.on = !on; WEATHER_BOOT.kind = null as any;
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    let W: any; try { W = await quiet(() => standUp({ level: lvl, seed: 7 })); } finally { WEATHER_BOOT.kind = bootWas; }
    return { W, g: W.game as any, lvl };
  }
  const boxSum = (boxes: any[]) => { let h = 2166136261 >>> 0; const eat = (v: number) => { h ^= Math.round(v * 4096) | 0; h = Math.imul(h, 16777619) >>> 0; }; for (const b of boxes) { for (const v of [...b.c, ...b.h, b.yaw, b.flags, ...b.albedo]) eat(v); } return h.toString(16); };

  try {
    const A = await rig('pass.json', true); const g = A.g; const n0 = A.lvl.boxes.length;
    const F = BREAK ? SF.buildSnowField(g.level, { breakIt: true }) : g.snowField;
    const at = (x: number, z: number) => SF.snowFieldAt(F, x, z);
    // ---- field
    if (!F) { verdict(false, 'field — the pass, look on: the game holds a snow field', `game.snowField is ${g.snowField} (SNOW.on ${SNOW.on}, SNOW_LOOK.on ${SNOW_LOOK.on})`); }
    else {
      const wx = g.weather as any; let roofed: number[] | null = null, open: number[] | null = null;
      for (let x = 2; x < 38 && !(roofed && open); x += 1) for (let z = 2; z < 22; z += 1) {
        const all = (v: boolean) => [-1.5, 0, 1.5].every(dx => [-1.5, 0, 1.5].every(dz => wx.underRoof(x + dx, z + dz) === v));
        if (!roofed && all(true)) roofed = [x, z];
        if (!open && all(false) && x > 14 && x < 26 && z > 12 && z < 21 && at(x, z).mound === 0 && at(x, z).packed < 0.05 && at(x, z).old < 0.05) open = [x, z];
      }
      const yard = open ? at(open[0], open[1]) : null, roof = roofed ? at(roofed[0], roofed[1]) : null, road = at(8, 25);
      let indoor = 0; for (let i = 0; i < F.mound.length; i++) if (F.roof[i] > 0.98 && F.mound[i] > 0 && !F.wall[i] && !(F.hard[i] > 0)) indoor++;   // (a bank's hill may not come through the wall it leans on into the room behind)
      verdict(!!g.snowField && !!yard && yard.cover > 0.95 && !!roof && roof.cover < 0.05 && roof.mound === 0 && (BREAK || indoor === 0) && road.packed > 0.8 && road.cover > 0.95 && F.stats.mounds > 40 && F.stats.quads > 2000 && F.stats.maxMound > 0.3 && F.stats.maxMound < 0.8 && F.quads.length === F.stats.quads * 2 && g.level.boxes[F.slab].h[0] > 15,
        'field — the pass holds a snow field: snow over the open yard, none under a roof, trodden on the road, hills standing',
        `${F.w} × ${F.h} texels · open yard ${open}: cover ${yard?.cover.toFixed(2)} · deep under a roof ${roofed}: cover ${roof?.cover.toFixed(2)}, standing ${roof?.mound} · ${(indoor / 100).toFixed(2)} m² of hill deep under a roof with no snow box of the file under it · the road (8, 25): trodden ${road.packed.toFixed(2)} · ${F.stats.mounds} solid snow boxes swallowed, the highest hill ${F.stats.maxMound.toFixed(2)} m, ${F.stats.quads} mesh quads · ${F.stats.lays} strips on the ground (${F.stats.bare} of them cleared earth) · the ground is box ${F.slab}`);
      // ---- under
      { let boxes = 0, pts = 0, bad = 0, worst = 1e9, worstAt = '';
        g.level.boxes.forEach((b: any, i: number) => {
          if (i === F.slab || (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass)) || SF.snowPaintOf(b) !== 'snow') return;
          const top = b.c[1] + b.h[1]; if (top < 0.03 || b.c[1] - b.h[1] > 0.06) return;
          boxes++; const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
          for (const [lx, lz] of [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
            const x = b.c[0] + c * lx * b.h[0] + s * lz * b.h[2], z = b.c[2] - s * lx * b.h[0] + c * lz * b.h[2];
            if (x < 0.1 || z < 0.1 || x > 39.9 || z > 27.9) continue;
            pts++; const over = at(x, z).mound - top; if (over < worst) { worst = over; worstAt = `box ${i} at (${x.toFixed(2)}, ${z.toFixed(2)}), top ${top.toFixed(2)}`; } if (over < 0.01) bad++;
          }
        });
        verdict(boxes > 40 && pts > 300 && bad === 0, 'under — every solid snow box lies under the surface', `${boxes} boxes, ${pts} corners, edge middles and centres: ${bad} with less than a centimetre of snow over them · the thinnest: ${(worst * 100).toFixed(1)} cm (${worstAt})`); }
      // ---- edge
      { // the lying snow reaches the level's edge all the way round and STOPS there: past the bounds nothing is drawn (the maintainer, 10-15: "we should just have
        // black outside the edges of the map, not extend") — every quad of the mesh is a lattice quad inside the field, and the hills' shader places none anywhere else
        const Q = Array.from(F.quads) as number[]; let out = 0;
        for (let k = 0; k < Q.length; k += 2) if (!(Q[k] >= 0 && Q[k] < F.w - 1 && Q[k + 1] >= 0 && Q[k + 1] < F.h - 1)) out++;
        let edge = 0, bare = 0;
        for (let x = 0.05; x < 40; x += 0.5) for (const z of [0.05, 27.95]) { edge++; if (at(x, z).cover < 0.9) bare++; }
        for (let z = 0.05; z < 28; z += 0.5) for (const x of [0.05, 39.95]) { edge++; if (at(x, z).cover < 0.9) bare++; }
        const sh = (await Bun.file(new URL('../../src/render/shaders/snow.wgsl', import.meta.url)).text());
        verdict(Q.length > 4000 && out === 0 && bare === 0 && !sh.includes('0x80000000u') && !sh.includes('let past = '), 'edge — the lying snow reaches the level\'s edge and stops there',
          `${Q.length / 2} mesh quads: ${out} off the field's lattice · ${edge} points along the bounds: ${bare} without snow · the hills' shader draws nothing past the bounds`);
      }
      // ---- soft
      { // the road is one strip of trodden paint, 40 m long, its north edge the line z = 23.3 in the file: where does the field put that edge?
        const edge: number[] = [];
        for (let x = 2; x < 12; x += 0.1) { let zc = NaN; for (let z = 22.6; z < 24.0; z += 0.02) { if (at(x, z).packed >= 0.5) { zc = z; break; } } if (zc === zc) edge.push(zc); }
        const mean = edge.reduce((a, b) => a + b, 0) / Math.max(1, edge.length); const sd = Math.sqrt(edge.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, edge.length)); const range = Math.max(...edge) - Math.min(...edge);
        // cleared earth: a texel a hand inside the strip's rectangle is under snow somewhere along its edge, and bare at its middle
        let bareMid = 0, crept = 0, strips = 0;
        g.level.boxes.forEach((b: any, i: number) => {
          const top = b.c[1] + b.h[1]; if (i === F.slab || top > 0.03 || top <= 0 || SF.snowPaintOf(b) || Math.min(b.h[0], b.h[2]) < 0.4 || b.emissive[0] + b.emissive[1] + b.emissive[2] > 0) return;
          if ((g.weather as any).underRoof(b.c[0], b.c[2])) return;
          strips++; if (at(b.c[0], b.c[2]).cover < 0.1) bareMid++;
          const c = Math.cos(b.yaw), s = Math.sin(b.yaw); let any = false;
          for (let t = -0.9; t <= 0.9 && !any; t += 0.05) for (const [lx, lz] of [[t * b.h[0], b.h[2] - 0.04], [t * b.h[0], -b.h[2] + 0.04], [b.h[0] - 0.04, t * b.h[2]], [-b.h[0] + 0.04, t * b.h[2]]]) { if (at(b.c[0] + c * lx + s * lz, b.c[2] - s * lx + c * lz).cover > 0.6) { any = true; break; } }
          if (any) crept++;
        });
        verdict(edge.length > 80 && sd > 0.012 && range > 0.05 && strips > 0 && bareMid === strips && crept === strips, 'soft — no straight edge of the file survives',
          `the road's edge along ten metres: ${edge.length} crossings, standing ${(sd * 100).toFixed(1)} cm off its mean line, wandering over ${(range * 100).toFixed(0)} cm · cleared earth in the open: ${strips} strips, ${bareMid} bare at the middle, ${crept} with snow crept in over their edge`); }
    }
    // ---- untouched / off
    const B = await rig('pass.json', false);
    { const sumOn = boxSum(A.g.level.boxes), sumOff = boxSum(B.g.level.boxes);
      verdict(A.g.level.boxes.length === n0 && B.g.level.boxes.length === n0 && sumOn === sumOff, 'untouched — the level\'s boxes are the file\'s, look on or off', `${n0} boxes either way · places, sizes, flags and paint: ${sumOn} on, ${sumOff} off`); }
    { const C = await rig('compound.json', true); const zero = SF.snowCfgRows(null), live = F ? SF.snowCfgRows(F) : null;
      verdict(B.g.snowField === null && C.g.snowField === null && zero.every((v: number) => v === 0) && zero.length === SF.SNOW_CFG_FLOATS && !!live && live[6] === 1 && live[3] === F.slab && live[7] === n0,
        'off — no field with the switch off, none on another level, and a page with no field shades nothing', `the pass, switch off: ${B.g.snowField} · compound.json, switch on: ${C.g.snowField} · the block with no field: ${zero.length} zeros · with one: live ${live?.[6]}, ground box ${live?.[3]}, ${live?.[7]} file boxes`); }
    // ---- same
    if (!o.fast) {
      const E = (SCENARIOS as any[]).find(s => s.level === 'pass.json');
      if (!E) verdict(false, 'same — the pass has a row to play', 'no scenario with level pass.json in scene/scenarioList.ts SCENARIOS');
      else {
        const dir = mkdtempSync(resolve(tmpdir(), 'snowlook-check-'));
        const run = async (name: string, seed: number, look: boolean) => {
          const out = resolve(dir, `${name}-${seed}.json`);
          const p = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--one', `${E.id}:${seed}`, '--out', out, '--cap', '150'],
            { stdout: 'ignore', stderr: 'pipe', env: { ...process.env, TPS_SNOW: '1', TPS_SNOWLOOK: look ? '1' : '0', PT_DIGEST: '1', SNOWLOOK_BREAK: '' } });
          const code = await p.exited; if (code !== 0 || !existsSync(out)) return { digest: `no run (exit ${code}: ${(await new Response(p.stderr).text()).trim().split('\n').pop()?.slice(0, 200)})`, secs: 0, how: '' };
          const r = JSON.parse(readFileSync(out, 'utf8')); return { digest: String(r.digest ?? 'no digest in the run'), secs: +(r.secs ?? r.t ?? 0), how: String(r.outcome ?? r.end ?? r.result ?? '') };
        };
        const SEEDS = [1, 2];
        const [on, off] = await Promise.all([Promise.all(SEEDS.map(s => run('on', s, true))), Promise.all(SEEDS.map(s => run('off', s, false)))]);
        rmSync(dir, { recursive: true, force: true });
        const hex = (d: string) => /^[0-9a-f]+$/.test(d);
        verdict(on.every((r, i) => hex(r.digest) && r.digest === off[i].digest) && on.some(r => r.secs >= 40) && on[0].digest !== on[1].digest,
          'same — a room clear on the pass plays the same with the look on and off', `played runs, their digest every half second — ${SEEDS.map((s, i) => `seed ${s}: ${on[i].digest} on (${on[i].secs.toFixed(0)} s ${on[i].how}), ${off[i].digest} off (${off[i].secs.toFixed(0)} s ${off[i].how})`).join(' · ')}`);
      }
    }
    // ---- old
    { let ok = false, how = '';
      try { SNOW_LOOK.on = true; SNOW_LOOK.wisps = true; const k = (J as any).knobsSnapshot(A.g); const had = !!k.tables && 'SNOW_LOOK' in k.tables; delete k.tables.SNOW_LOOK; const before = A.g.snowField; (J as any).applyKnobs(A.g, k); A.W.step(1 / 60); ok = had && !!before && SNOW_LOOK.on === false && SNOW_LOOK.wisps === false && A.g.snowField === null; how = `the table rides in a recording: ${had} · with it taken out, after applyKnobs and a frame: on ${SNOW_LOOK.on}, wisps ${SNOW_LOOK.wisps}, the game's field ${A.g.snowField === null ? 'taken back' : 'STILL HELD'}`; } catch (e) { how = `threw: ${(e as Error).message}`; }
      verdict(ok, 'old — a recording from before the switch replays with it off, and the game hands its field back', how); }
  } finally {
    SNOW.on = was.snow; SNOW_LOOK.on = was.look; SNOW_LOOK.wisps = was.wisps; WEATHER_BOOT.kind = bootWas;
    if (env.snow === undefined) delete process.env.TPS_SNOW; else process.env.TPS_SNOW = env.snow;
    if (env.look === undefined) delete process.env.TPS_SNOWLOOK; else process.env.TPS_SNOWLOOK = env.look;
  }
  console.log(`\nsnowlook-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWLOOK_BREAK=1: the hills baked under their boxes — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowLookCheck({ verbose: process.argv.includes('--verbose'), fast: process.argv.includes('--fast') }); process.exit(ok ? 0 : 1); }
