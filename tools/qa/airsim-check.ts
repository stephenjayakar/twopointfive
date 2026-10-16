// THE AIR AS ONE SIMULATED FIELD: WHAT THE GAME HANDS IT (src/game/airSim.ts AIR_SIM / updateAirSim / airMask; the field itself is render/airField.ts +
// shaders/air_field.wgsl, a GPU solver with a page test of its own — not this file's).
//
//   bun run tools/qa/airsim-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   AIRSIM_BREAK=1 …   = the switch never raised and the same lines asked: must fail
//   bun run tools/qa/probes.ts airsim      (also under `snow` and `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switch where each line needs it by the stand's own word, TPS_AIR.
//
// The harness has no GPU and its engine no air field: the field here is a RECORDING STAND-IN on the engine (setCells / setSources / reset, 200 × 140 cells), so
// what is proven is what the game would hand a field — the map, the wind, when — never air seen moving.
//   stands    the frozen stand holds the switch off and TPS_AIR=1 raises it, the shipped stand has it on; FROZEN_HOLDS has the row; a recording with no AIR_SIM
//             table replays with it off (journal.ts applyKnobs), one that carries it plays as it says
//   map       (the pass in snow, the compound, the office) every standing box's middle is solid; every cell that is not solid is 254 under the sky and
//             round(roofShare × 254) under one of the level's roofs (weather.ts roofsOf); a placed snow bank is not solid, nor a box that tops out under minTop
//   leak      no wall leaks: every standing axis-aligned box a metre long or more is solid in every cell along its long middle line
//   door      a shut leaf's line is solid and nothing passes the frame; swung to 1.4 rad the doorway's middle is open and the solid cells stand where the leaf
//             does — the leaves were stamped again (`restamped`), the level's boxes not drawn again (`rebuilt`)
//   destroyed a standing box that destruction hid is gone from the map on the next ask (`rebuilt`), and back when it is shown again
//   feed      the switch on: the map is sent once and not again while nothing changes; the ambient is the storm's vector at its ground share and the field is
//             run; the wind's master at 0 = no ambient, no sources, and after AIR_SIM.settle seconds the field is no longer stepped
//   vents     the office: one local source for every blowing vent, each spreading air out across the floor (`out` > 0), finite, AIR_SOURCES at most
//   off       the switch off: nothing sent, the engine's ambient zero and its field not run
//   digest    the game does not know: 300 stepped frames of the pass with the stand-in field, switch on and off — one game digest
//   constants the cells a metre agree (airSim.ts AIR_CELLS, airField.ts AIR_RES, particles.wgsl AIR_CELLS_PER_M), and the source caps (AIR_SOURCES, AIR_SRC_MAX)
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function airSimCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { AIR_SIM, AIR_CELLS, AIR_SOURCES, airMask, airSimStats, airLive, airWant } = await import(`${ROOT}/src/game/airSim.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { roofsOf } = await import(`${ROOT}/src/game/weather.ts`);
  const { snowPaintOf } = await import(`${ROOT}/src/render/snowField.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const { FROZEN_HOLDS, harnessProfile } = await import(`${ROOT}/src/host/profile.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.AIRSIM_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const was = { on: AIR_SIM.on, envAir: process.env.TPS_AIR, envSnow: process.env.TPS_SNOW };
  const setEnv = (k: string, v: string | undefined) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };

  /** the recording stand-in for the engine's field (render/airField.ts AirField's face, as airSim.ts calls it) */
  const mkAir = () => ({ w: 200, h: 140, cells: [] as Uint8Array[], sources: [] as { n: number; recs: Float32Array }[], resets: 0,
    setCells(m: Uint8Array, _r?: unknown) { this.cells.push(m.slice()); }, setSources(recs: Float32Array, n: number) { this.sources.push({ n, recs: recs.slice(0, n * 8) }); }, reset() { this.resets++; } });
  /** a game stood up on `file` (null: the office, the harness's own level), the switch where `on` says — by the stand's own word (`word` false: no word at all,
   *  the stand as it is). `field`: the stand-in on the engine from before the first frame. `read` false: nothing asks for the air (as on a level with no reader);
   *  otherwise the rig is the reader, every frame, as the grains are on the page (airWant). */
  async function rig(file: string | null, on: boolean, opt: { field?: boolean; word?: boolean; snow?: boolean; read?: boolean } = {}) {
    const sw = on && !BREAK;
    setEnv('TPS_SNOW', opt.snow ? '1' : was.envSnow);
    if (opt.word === false) { delete process.env.TPS_AIR; AIR_SIM.on = harnessProfile() === 'shipped' ? was.on : true; }   // (frozen: left up, for the stand's pin to put down; shipped: as the page's boot left it when the harness loaded — headless.ts shippedBoot, once — which no stand-up touches)
    else { process.env.TPS_AIR = sw ? '1' : '0'; AIR_SIM.on = !sw; }
    const lvl = file ? loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) : undefined;
    const W: any = await quiet(() => standUp(lvl ? { level: lvl, seed: 7 } : { seed: 7 }));
    const g = W.game; const stood: boolean = AIR_SIM.on; if (opt.word !== false) AIR_SIM.on = sw;
    const e = g.engine as any; const air = mkAir(); if (opt.field) { e.air = air; e.airWind = [0, 0]; e.airOn = false; }
    const step = (n = 1) => { for (let i = 0; i < n; i++) { if (opt.word !== false) AIR_SIM.on = sw; if (opt.read !== false) airWant(g); W.step(DT); } };
    return { W, g, e, air, step, stood, sw };
  }

  // ---- the map's own geometry, re-derived here (airSim.ts `stands` / `stamp` say the same)
  const ox = WORLD.min[0], oz = WORLD.min[2], cell = 1 / AIR_CELLS;
  const EDGE = 1e-6;
  const ci = (x: number) => Math.floor((x - ox) * AIR_CELLS), cj = (z: number) => Math.floor((z - oz) * AIR_CELLS);
  const HIDDEN = BoxFlag.NoPrimary | BoxFlag.NoShadow;
  const tall = (b: any) => b.c[1] + b.h[1] >= AIR_SIM.minTop && b.c[1] - b.h[1] <= AIR_SIM.maxFoot;
  const plain = (b: any) => !b.rot && (b.flags & BoxFlag.Dynamic) === 0 && (b.flags & HIDDEN) !== HIDDEN && (b.flags & BoxFlag.NoShadow) === 0;
  const standsIn = (g: any, b: any, bi: number) => plain(b) && tall(b) && ((b.flags & BoxFlag.Glass) !== 0 ? !(g.glassBreak && g.glassBreak.openFraction(bi) > AIR_SIM.glassOpen) : snowPaintOf(b) === null);
  /** is ground point (x, z) within `pad` of box b's footprint (its yaw turns +x toward −z) */
  const over = (b: any, x: number, z: number, pad: number) => { const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0), px = x - b.c[0], pz = z - b.c[2]; return Math.abs(c * px - s * pz) <= b.h[0] + pad && Math.abs(s * px + c * pz) <= b.h[2] + pad; };
  const squareYaw = (b: any) => { const y = b.yaw || 0; return Math.abs(Math.sin(y) * Math.cos(y)) < 1e-3; };

  function mapLines(g: any, name: string, wantBanks: boolean) {
    const M = airMask(g); const { mask, w, h } = M; const S = airSimStats(g); const boxes: any[] = g.col.boxes; const leaves: any[] = (g.doors?.list ?? []).filter((d: any) => !d.off).map((d: any) => d.box);
    const at = (x: number, z: number) => { const i = ci(x), j = cj(z); return i < 0 || j < 0 || i >= w || j >= h ? -1 : mask[j * w + i]; };
    /** … a point on the edge between cells is in either (a thin wall on a cell's edge may be drawn into the one or the other): solid if any cell it touches is */
    const atEdge = (x: number, z: number) => { let v = at(x, z); for (const dx of [-EDGE, EDGE]) for (const dz of [-EDGE, EDGE]) { const u = at(x + dx, z + dz); if (u === 255) v = 255; } return v; };
    const standing = boxes.map((b, bi) => ({ b, bi })).filter(({ b, bi }) => standsIn(g, b, bi));
    const coveredBy = (x: number, z: number, but: any) => standing.some(({ b }) => b !== but && over(b, x, z, 0.3)) || leaves.some(b => over(b, x, z, 0.3));
    // every standing box's middle is solid (the box inside the world)
    let mids = 0, midsBad: string[] = [];
    for (const { b, bi } of standing) { const v = atEdge(b.c[0], b.c[2]); if (v < 0) continue; mids++; if (v !== 255) midsBad.push(`box ${bi} at (${b.c[0].toFixed(2)}, ${b.c[2].toFixed(2)}) half (${b.h[0]}, ${b.h[2]}) yaw ${(b.yaw || 0).toFixed(2)} = ${v}`); }
    // every cell that is not solid: 254 under the sky, the roof's share under a roof
    const roofs: number[][] = roofsOf(boxes); const under = Math.max(0, Math.min(254, Math.round(AIR_SIM.roofShare * 254)));
    let sky = 0, roofed = 0, solid = 0, wrong = 0, firstWrong = '';
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const v = mask[j * w + i]; if (v === 255) { solid++; continue; }
      const x = ox + (i + 0.5) * cell, z = oz + (j + 0.5) * cell; const r = roofs.some(R => x > R[0] && z > R[1] && x < R[2] && z < R[3]);
      if (r) roofed++; else sky++;
      if (v !== (r ? under : 254)) { wrong++; firstWrong ||= `cell (${i}, ${j}) = ${v}, ${r ? 'under a roof' : 'under the sky'}`; }
    }
    // placed snow and low boxes: not solid (where nothing that stands is over the same spot)
    let banks = 0, banksSolid = 0, lows = 0, lowsSolid = 0;
    boxes.forEach((b, bi) => {
      if (!plain(b) || at(b.c[0], b.c[2]) < 0 || coveredBy(b.c[0], b.c[2], b)) return;
      if (snowPaintOf(b) !== null && tall(b)) { banks++; if (at(b.c[0], b.c[2]) === 255) banksSolid++; }
      else if (snowPaintOf(b) === null && (b.flags & BoxFlag.Glass) === 0 && b.c[1] + b.h[1] < AIR_SIM.minTop && b.c[1] + b.h[1] > 0.05 && !standsIn(g, b, bi)) { lows++; if (at(b.c[0], b.c[2]) === 255) lowsSolid++; }
    });
    const statsOk = S.solid === solid && S.w === w && S.h === h && w === Math.round((WORLD.max[0] - WORLD.min[0]) * AIR_CELLS) && h === Math.round((WORLD.max[2] - WORLD.min[2]) * AIR_CELLS);
    verdict(mids > 20 && midsBad.length === 0 && wrong === 0 && sky > 0 && solid > 0 && banksSolid === 0 && lowsSolid === 0 && (!wantBanks || banks > 0) && lows > 0 && statsOk,
      `map — ${name}: what stands is solid, the yard is open to the whole wind, a roof's share under a roof, snow banks and low boxes are ground`,
      `${w} × ${h} cells · ${standing.length} boxes stand of ${boxes.length}: ${mids} middles asked, ${midsBad.length} not solid${midsBad.length ? ` (${midsBad.slice(0, 3).join('; ')})` : ''} · ${solid} solid cells (the stats say ${S.solid}), ${sky} under the sky, ${roofed} under ${roofs.length} roofs at ${under}: ${wrong} cells wrong${firstWrong ? ` (${firstWrong})` : ''} · ${banks} snow banks that reach ${AIR_SIM.minTop} m, ${banksSolid} solid · ${lows} low boxes, ${lowsSolid} solid · the stats' open ${S.open}, roofed ${S.roofed} (counted here: ${sky} open, ${roofed} roofed and not solid)`);
    // no wall leaks
    let walls = 0, cells = 0; const leaks: string[] = [];
    for (const { b, bi } of standing) {
      if (!squareYaw(b)) continue; const turned = Math.abs(Math.sin(b.yaw || 0)) > 0.5; const hx = turned ? b.h[2] : b.h[0], hz = turned ? b.h[0] : b.h[2];
      if (2 * Math.max(hx, hz) < 1) continue; walls++; const alongX = hx >= hz; let bad = 1e9, n = 0;
      // (the row of cells its middle line is in — on a cell's edge, either of the two rows, but ONE row from end to end: a wall drawn half in each still leaks)
      const rows = alongX ? [...new Set([cj(b.c[2] - EDGE), cj(b.c[2] + EDGE)])] : [...new Set([ci(b.c[0] - EDGE), ci(b.c[0] + EDGE)])];
      for (const r of rows) { let open = 0; n = 0;
        if (alongX) { for (let i = ci(b.c[0] - hx); i <= ci(b.c[0] + hx); i++) { const x = ox + (i + 0.5) * cell; if (Math.abs(x - b.c[0]) > hx - 1e-6 || i < 0 || i >= w || r < 0 || r >= h) continue; n++; if (mask[r * w + i] !== 255) open++; } }
        else { for (let j = cj(b.c[2] - hz); j <= cj(b.c[2] + hz); j++) { const z = oz + (j + 0.5) * cell; if (Math.abs(z - b.c[2]) > hz - 1e-6 || r < 0 || r >= w || j < 0 || j >= h) continue; n++; if (mask[j * w + r] !== 255) open++; } }
        bad = Math.min(bad, open); }
      cells += n; if (bad) leaks.push(`box ${bi} at (${b.c[0].toFixed(3)}, ${b.c[2].toFixed(3)}) half (${hx}, ${hz}): ${bad} of ${n} cells open`);
    }
    verdict(walls > 10 && leaks.length === 0, `leak — ${name}: no wall leaks`, `${walls} standing axis-aligned boxes a metre long or more, ${cells} cells along their long middle lines: ${leaks.length} boxes with an open cell${leaks.length ? ` (${leaks.slice(0, 4).join('; ')})` : ''}`);
    return { standing, coveredBy, at };
  }

  try {
    // ---- stands
    { const N = await rig('pass.json', true, { word: false }); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const A = await rig('pass.json', true), B = await rig('pass.json', false);
      const row = FROZEN_HOLDS['AIR_SIM.on']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(B.g)));
      AIR_SIM.on = true; const carries = !!snap().tables.AIR_SIM; const old = snap(); delete old.tables.AIR_SIM; await quiet(() => JOURNAL.applyKnobs(B.g, old)); const without = AIR_SIM.on;
      AIR_SIM.on = true; const own = snap(); AIR_SIM.on = false; await quiet(() => JOURNAL.applyKnobs(B.g, own)); const withIt = AIR_SIM.on; AIR_SIM.on = false;
      verdict(bare === shipped && A.stood === true && B.stood === false && typeof row === 'string' && /TPS_AIR=1/.test(row) && carries && without === false && withIt === true,
        'stands — held off on the frozen stand, on as the page opens, raised by TPS_AIR=1; a recording from before the table replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_AIR=1 → ${A.stood}, TPS_AIR=0 → ${B.stood} · FROZEN_HOLDS['AIR_SIM.on'] = ${row ? `'${row.slice(0, 12)}…'` : 'no row'} · the journal carries the table: ${carries}; applyKnobs with no AIR_SIM table → ${without}, with it on → ${withIt}`); }

    // ---- map / leak / door / destroyed (the map is drawn on the ask: airMask)
    const P = await rig('pass.json', true, { snow: true }); P.step(2);
    const pm = mapLines(P.g, 'the pass in snow', true);
    { const C = await rig('compound.json', true); C.step(2); mapLines(C.g, 'the compound', false); }
    { const g = P.g; const doors: any[] = g.doors.list; const S = airSimStats(g);
      const lineOf = (b: any) => { const c = Math.cos(b.yaw || 0), s = Math.sin(b.yaw || 0); const long = b.h[0] >= b.h[2]; const hl = Math.max(b.h[0], b.h[2]); const ax = long ? [c, -s] : [s, c]; const pts: number[][] = [];
        for (let t = -hl + 0.16; t <= hl - 0.16 + 1e-9; t += 0.1) pts.push([b.c[0] + ax[0] * t, b.c[2] + ax[1] * t]); return { pts, ax, hl }; };
      const solidAlong = (b: any) => { const M = airMask(g); const { pts, ax } = lineOf(b); let best = 0;   // (a leaf whose line lies on a cell's edge is drawn into the cells of one side or the other: the better of the line itself and the line a hair to each side)
        for (const k of [0, -1, 1]) { let n = 0; for (const p of pts) if (M.mask[cj(p[1] + ax[0] * k * EDGE) * M.w + ci(p[0] - ax[1] * k * EDGE)] === 255) n++; best = Math.max(best, n); } return { n: best, of: pts.length }; };
      /** can the air pass the frame: a walk over open cells from 0.5 m on one side of the shut leaf's middle to 0.5 m on the other, kept inside the frame's own
       *  neighbourhood (0.3 m past the leaf's ends, 0.7 m either side) */
      const passes = (b: any) => { const M = airMask(g); const { ax, hl } = lineOf(b); const nx = -ax[1], nz = ax[0]; const inWin = (i: number, j: number) => { const x = ox + (i + 0.5) * cell - b.c[0], z = oz + (j + 0.5) * cell - b.c[2]; return Math.abs(x * ax[0] + z * ax[1]) <= hl + 0.3 && Math.abs(x * nx + z * nz) <= 0.7; };
        const a = [ci(b.c[0] + nx * 0.5), cj(b.c[2] + nz * 0.5)], z = [ci(b.c[0] - nx * 0.5), cj(b.c[2] - nz * 0.5)]; if (M.mask[a[1] * M.w + a[0]] === 255 || M.mask[z[1] * M.w + z[0]] === 255) return null;
        const seen = new Set<number>([a[1] * M.w + a[0]]); const q = [a];
        while (q.length) { const [i, j] = q.pop()!; if (i === z[0] && j === z[1]) return true; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = i + di, v = j + dj, k = v * M.w + u; if (u < 0 || v < 0 || u >= M.w || v >= M.h || seen.has(k) || M.mask[k] === 255 || !inWin(u, v)) continue; seen.add(k); q.push([u, v]); } }
        return false; };
      const shut = doors.filter(d => !d.off && Math.abs(d.angle) < 1e-3 && squareYaw(d.box));
      let through = 0, asked = 0; const leaky: string[] = []; for (const d of shut) { const r = passes(d.box); if (r === null) continue; asked++; if (r) { through++; leaky.push(`${d.def?.name ?? d.def?.id ?? '?'} at (${d.box.c[0].toFixed(2)}, ${d.box.c[2].toFixed(2)})`); } }
      const d = shut[0];
      if (!d) verdict(false, 'door — a leaf stands in the wind where it hangs', `the pass has no shut door (${doors.length} doors)`);
      else {
        const b = d.box; const c0 = [b.c[0], b.c[2]]; const closed = solidAlong(b); const r0 = { ...S };
        const keep = { angle: d.angle, vel: d.vel, latched: d.latched, closing: d.closing };
        d.angle = d.maxA > 0.5 ? Math.min(d.maxA, 1.4) : Math.max(d.minA, -1.4); d.vel = 0; d.latched = false; d.closing = false; d.place();   // (as the door code itself poses a leaf: doors.ts place() writes the box from the angle)
        const ang = d.angle; const M = airMask(g); const mid = M.mask[cj(c0[1]) * M.w + ci(c0[0])]; const open = solidAlong(d.box); const r1 = { ...airSimStats(g) };
        const again = airMask(g); const r1b = { ...airSimStats(g) }; void again;
        d.angle = keep.angle; d.vel = keep.vel; d.latched = keep.latched; d.closing = keep.closing; d.place(); const back = solidAlong(d.box); const r2 = { ...airSimStats(g) };
        verdict(closed.n === closed.of && closed.of >= 3 && through === 0 && asked > 0 && Math.abs(ang) > 1.2 && mid !== 255 && open.n === open.of && r1.restamped === r0.restamped + 1 && r1.rebuilt === r0.rebuilt && r1b.restamped === r1.restamped && back.n === back.of && r2.restamped === r1.restamped + 1 && r2.rebuilt === r0.rebuilt,
          'door — a leaf stands in the wind where it hangs: shut it closes its doorway, swung it stands in the room and the doorway is open',
          `'${d.def?.name ?? d.def?.id ?? '?'}' at (${c0[0].toFixed(2)}, ${c0[1].toFixed(2)}), shut: ${closed.n} of ${closed.of} points along the leaf solid · the air passes the frame of ${through} of ${asked} shut doors${leaky.length ? ` (${leaky.slice(0, 4).join('; ')})` : ''} · swung to ${ang.toFixed(2)} rad: the doorway's middle cell = ${mid}, ${open.n} of ${open.of} points along the leaf where it stands now solid · restamped ${r0.restamped} → ${r1.restamped} (asked again with nothing moved: ${r1b.restamped}), rebuilt ${r0.rebuilt} → ${r1.rebuilt} · shut again: ${back.n} of ${back.of} solid, restamped ${r2.restamped}`);
        // … and blown off its hinges (a charge, a ram): the slab lies on the floor, the doorway is open air
        const D = d as any; const hadSlab = D.slab; const wasOff = d.off;
        if (typeof wasOff !== 'boolean') verdict(false, 'door — a leaf off its hinges is out of the map', 'the door has no `off` to read');
        else { D.off = true; const M3 = airMask(g); const mid3 = M3.mask[cj(c0[1]) * M3.w + ci(c0[0])]; const r3 = { ...airSimStats(g) }; const gone = solidAlong(b);
          D.off = wasOff; D.slab = hadSlab; airMask(g); const r4 = { ...airSimStats(g) }; const back2 = solidAlong(d.box);
          verdict(mid3 !== 255 && r3.leaves === r2.leaves - 1 && r3.restamped === r2.restamped + 1 && r3.rebuilt === r2.rebuilt && gone.n < gone.of && r4.leaves === r2.leaves && back2.n === back2.of,
            'door — a leaf off its hinges is out of the map: its doorway is open air',
            `the same door marked off its hinges: the doorway's middle cell = ${mid3}, ${gone.n} of ${gone.of} points along where it hung solid, leaves in the map ${r2.leaves} → ${r3.leaves}, restamped ${r2.restamped} → ${r3.restamped} · hung again: ${r4.leaves} leaves, ${back2.n} of ${back2.of} solid`); }
      }
      // ---- destroyed
      const pick = pm.standing.find(({ b }) => b.c[1] + b.h[1] > 1.5 && pm.at(b.c[0], b.c[2]) === 255 && !pm.coveredBy(b.c[0], b.c[2], b) && (b.flags & BoxFlag.Glass) === 0);
      if (!pick) verdict(false, 'destroyed — what destruction hid is out of the map', 'no standing box on the pass with nothing else over its middle');
      else { const b = pick.b; const r0 = { ...airSimStats(g) }; const f0 = b.flags; const v0 = pm.at(b.c[0], b.c[2]);
        b.flags |= HIDDEN; const M1 = airMask(g); const v1 = M1.mask[cj(b.c[2]) * M1.w + ci(b.c[0])]; const r1 = { ...airSimStats(g) };
        b.flags = f0; const M2 = airMask(g); const v2 = M2.mask[cj(b.c[2]) * M2.w + ci(b.c[0])]; const r2 = { ...airSimStats(g) };
        verdict(v0 === 255 && v1 !== 255 && v1 >= 0 && r1.rebuilt === r0.rebuilt + 1 && v2 === 255 && r2.rebuilt === r1.rebuilt + 1 && r1.solid < r0.solid && r2.solid === r0.solid,
          'destroyed — a box destruction hid is out of the map on the next ask, and back when it stands again',
          `box ${pick.bi} at (${b.c[0].toFixed(2)}, ${b.c[2].toFixed(2)}): its middle ${v0} standing, ${v1} hidden (NoPrimary | NoShadow), ${v2} shown again · rebuilt ${r0.rebuilt} → ${r1.rebuilt} → ${r2.rebuilt} · solid cells ${r0.solid} → ${r1.solid} → ${r2.solid}`); }
    }

    // ---- feed: the pass in snow, the stand-in field on the engine from the first frame
    { const F = await rig('pass.json', true, { snow: true, field: true }); const g = F.g, e = F.e, K = AIR_SIM;
      F.step(1); const first = { cells: F.air.cells.length, resets: F.air.resets, calls: F.air.sources.length };
      F.step(90); const storm = g.wind.byName('storm'); const S = airSimStats(g);
      const want = storm && storm.speed > 0 ? [storm.dir[0] * storm.speed * K.ground, storm.dir[2] * storm.speed * K.ground] : [0, 0];
      const near = (a: number, b: number) => Math.abs(a - b) < 1e-9; const wind = [e.airWind[0], e.airWind[1]]; const sent = F.air.cells[0]; const M = airMask(g);
      let same = !!sent && sent.length === M.mask.length; if (same) for (let i = 0; i < sent.length; i++) if (sent[i] !== M.mask[i]) { same = false; break; }
      const blowing = { cells: F.air.cells.length, calls: F.air.sources.length, on: e.airOn, live: airLive(g), why: S.why, active: S.active };
      verdict(F.stood === true && first.cells === 1 && first.resets === 1 && blowing.cells === 1 && same && blowing.calls === 91 && !!storm && storm.speed > 0.1 && near(wind[0], want[0]) && near(wind[1], want[1]) && Math.hypot(wind[0], wind[1]) > 0.05 && blowing.on === true && blowing.live && blowing.active,
        'feed — the map goes over once, the storm\'s vector at its ground share every frame, and the field is run',
        `the stand's word raised the switch: ${F.stood} · frame 1: ${first.cells} map sent, ${first.resets} reset · 90 frames on: ${blowing.cells} map sent in all (the map as asked for now: ${same}), the sources handed over ${blowing.calls} times · storm ${storm ? storm.speed.toFixed(3) : 'none'} m/s × ${K.ground} along (${storm ? storm.dir[0].toFixed(2) : '-'}, ${storm ? storm.dir[2].toFixed(2) : '-'}) = (${want[0].toFixed(4)}, ${want[1].toFixed(4)}); the engine's ambient (${wind[0].toFixed(4)}, ${wind[1].toFixed(4)}) · run: ${blowing.on} (${blowing.why})`);
      // the wind's master at 0
      const t0 = g.tune.wind; g.tune.wind = 0; F.step(1); const still = { wind: [e.airWind[0], e.airWind[1]], n: F.air.sources.at(-1)?.n, on: e.airOn, why: airSimStats(g).why, calm: airSimStats(g).calm };
      const nSettle = Math.ceil(K.settle / DT); F.step(nSettle - 30); const before = e.airOn; F.step(60); const after = { on: e.airOn, why: airSimStats(g).why, cells: F.air.cells.length };
      g.tune.wind = t0; F.step(2); const again = { on: e.airOn, wind: Math.hypot(e.airWind[0], e.airWind[1]), cells: F.air.cells.length };
      verdict(still.wind[0] === 0 && still.wind[1] === 0 && still.n === 0 && still.on === true && still.calm === 0 && before === true && after.on === false && after.cells === 1 && again.on === true && again.wind > 0.05 && again.cells === 1,
        'feed — the wind\'s master at 0 is still air: no ambient, no source, and after the settle time the field is not stepped',
        `tune.wind 0, one frame: ambient (${still.wind[0]}, ${still.wind[1]}), ${still.n} sources, the wind's own speed for the readers (calm) ${still.calm.toFixed(3)}, run: ${still.on} (${still.why}) · ${((nSettle - 29) * DT).toFixed(1)} s on: run ${before} · ${((nSettle + 31) * DT).toFixed(1)} s on (settle ${K.settle} s): run ${after.on} (${after.why}) · the master back up: run ${again.on}, ambient ${again.wind.toFixed(3)} m/s, ${again.cells} map sent in all`);
    }
    // ---- unread: the field is stepped only while something reads it, and only while its setting is on
    { const U = await rig('pass.json', true, { snow: true, field: true, read: false }); const g = U.g, e = U.e;
      U.step(60); const S0 = { ...airSimStats(g) }; const idle = { cells: U.air.cells.length, calls: U.air.sources.length, on: e.airOn, live: airLive(g) };
      airWant(g); U.step(1); const asked = { cells: U.air.cells.length, calls: U.air.sources.length, on: e.airOn, why: airSimStats(g).why };
      U.step(1); const dropped = { on: e.airOn, why: airSimStats(g).why };
      const had = e.settings.airSim; e.settings.airSim = false; airWant(g); U.step(1); const setOff = { live: airLive(g), on: e.airOn, why: airSimStats(g).why, calls: U.air.sources.length };
      e.settings.airSim = had; airWant(g); U.step(1); const setOn = { live: airLive(g), on: e.airOn };
      verdict(idle.cells === 0 && idle.calls === 0 && idle.on === false && idle.live && S0.calm > 0.05 && S0.active === false && asked.cells === 1 && asked.calls === 1 && asked.on === true && dropped.on === false
        && setOff.live === false && setOff.on === false && setOff.calls === asked.calls && setOn.live === true && setOn.on === true,
        'unread — the field is there on every level, drawn and stepped only on a frame a reader asked for it, and never with its setting off',
        `60 frames in a storm with no reader: ${idle.cells} maps, ${idle.calls} source calls, run: ${idle.on} (${S0.why}), the wind's own speed still told the readers: ${S0.calm.toFixed(3)} m/s · one reader asks: ${asked.cells} map, ${asked.calls} source call, run: ${asked.on} (${asked.why}) · the next frame, unasked: run ${dropped.on} (${dropped.why}) · the engine's airSim setting off and asked for: live ${setOff.live}, run ${setOff.on} (${setOff.why}), ${setOff.calls} source calls in all · on again: live ${setOn.live}, run ${setOn.on}`); }
    // ---- vents: the office
    { const V = await rig(null, true, { field: true }); const g = V.g; V.step(30);
      mapLines(g, 'the office', false);   // (a third level's walls: the office's partitions are thinner than a cell and many stand on a cell's edge)
      const act: any[] = g.wind.active.filter((s: any) => s.kind !== 'storm' && s.speed > 0); const vents = act.filter(s => s.why === 'vent'), down = act.filter(s => s.dir[1] < -0.5);
      const last = V.air.sources.at(-1) ?? { n: -1, recs: new Float32Array(0) }; const n = last.n; let finite = true, outs = 0; const speeds: string[] = [];
      for (let i = 0; i < n * 8; i++) if (!Number.isFinite(last.recs[i])) finite = false;
      for (let i = 0; i < n; i++) { if (last.recs[i * 8 + 5] > 0) outs++; speeds.push(last.recs[i * 8 + 5].toFixed(2)); }
      const inWorld = Array.from({ length: Math.max(0, n) }, (_, i) => last.recs[i * 8] > WORLD.min[0] && last.recs[i * 8] < WORLD.max[0] && last.recs[i * 8 + 1] > WORLD.min[2] && last.recs[i * 8 + 1] < WORLD.max[2] && last.recs[i * 8 + 4] >= AIR_SIM.sigmaMin && last.recs[i * 8 + 4] <= AIR_SIM.sigmaMax && last.recs[i * 8 + 6] === AIR_SIM.rate).every(Boolean);
      verdict((g.level.vents?.length ?? 0) > 0 && vents.length > 0 && n === Math.min(AIR_SOURCES, act.length) && n <= AIR_SOURCES && finite && outs === Math.min(n, down.length) && outs > 0 && inWorld && airSimStats(g).sources === n,
        'vents — the office: one local source for every blowing vent, its air spreading out across the floor',
        `${g.level.vents?.length ?? 0} vents on the level, ${vents.length} blowing this frame (${down.length} down from the ceiling), ${act.length} local wind sources in all · ${n} records handed over (cap ${AIR_SOURCES}), every number finite: ${finite}, in the world with a footprint ${AIR_SIM.sigmaMin}‥${AIR_SIM.sigmaMax} m and rate ${AIR_SIM.rate}: ${inWorld} · out (m/s) ${speeds.join(', ') || 'none'}: ${outs} above 0`); }
    // ---- off
    { const O = await rig('pass.json', false, { snow: true, field: true }); O.e.airWind[0] = 9; O.e.airWind[1] = 9; O.e.airOn = true; O.step(60); const S = airSimStats(O.g);
      verdict(O.stood === false && O.air.cells.length === 0 && O.air.sources.length === 0 && O.air.resets === 0 && O.e.airOn === false && O.e.airWind[0] === 0 && O.e.airWind[1] === 0 && S.active === false && !airLive(O.g),
        'off — with the switch off nothing is handed to the field and the engine does not run it',
        `the switch as the stand left it: ${O.stood} · 60 frames with a field on the engine: ${O.air.cells.length} maps, ${O.air.sources.length} source calls, ${O.air.resets} resets · the engine's ambient (${O.e.airWind[0]}, ${O.e.airWind[1]}) (was left at 9, 9), run: ${O.e.airOn} (${S.why})`); }
    // ---- digest
    { const D1 = await rig('pass.json', true, { snow: true, field: true }), D0 = await rig('pass.json', false, { snow: true, field: true });
      D1.step(300); D0.step(300); const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      verdict(h1 === h0 && D1.air.cells.length >= 1 && D1.air.sources.length === 300 && D0.air.cells.length === 0 && D0.air.sources.length === 0,
        'digest — the game does not know: one digest with the field fed and without', `300 frames of the pass: ${h1} with ${D1.air.cells.length} map and ${D1.air.sources.length} source calls handed over, ${h0} with ${D0.air.cells.length} and ${D0.air.sources.length}`); }
    // ---- constants
    { const AF: any = await import(`${ROOT}/src/render/airField.ts`); const wgsl = readFileSync(resolve(ROOT, 'src/render/shaders/particles.wgsl'), 'utf8');
      const m = /const AIR_CELLS_PER_M\s*:\s*f32\s*=\s*([0-9.]+)\s*;/.exec(wgsl); const shader = m ? Number(m[1]) : NaN; const cap = AF.AIR_SRC_MAX;
      verdict(AF.AIR_RES === AIR_CELLS && shader === AIR_CELLS && cap === AIR_SOURCES,
        'constants — the game, the field and the particles\' shader count the same cells to a metre, and the same sources', `airSim.ts AIR_CELLS ${AIR_CELLS} · airField.ts AIR_RES ${AF.AIR_RES} · particles.wgsl AIR_CELLS_PER_M ${m ? m[1] : 'not found'} · airSim.ts AIR_SOURCES ${AIR_SOURCES} · airField.ts AIR_SRC_MAX ${cap === undefined ? 'not exported' : cap}`); }
  } finally { AIR_SIM.on = was.on; setEnv('TPS_AIR', was.envAir); setEnv('TPS_SNOW', was.envSnow); }
  console.log(`\nairsim-check: ${checks - fails}/${checks} pass${BREAK ? ' (AIRSIM_BREAK=1: the switch never raised — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await airSimCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
