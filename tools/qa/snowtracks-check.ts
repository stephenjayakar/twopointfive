// BOOTS PRESS THE SNOW, AND THAT IS ONLY A PICTURE (src/game/weatherKinds.ts SNOW_LOOK.tracks, src/game/snowTracks.ts, src/render/shaders/snow.wgsl snowPrint).
//
// The maintainer, 10-14: "any initial feasibility results on if the engine can handle dynamic snow? ideally it looks natural, deforms with character movement".
// So on a snow level whose lying snow is one surface, every foot that comes down on snow leaves its print in one more texture over the plan, and a man who falls
// leaves the hollow he lies in. Nothing in the simulation reads a print.
//
//   bun run tools/qa/snowtracks-check.ts [--verbose] [--fast]     exit 0 = all pass, 1 = a FAIL line        (--fast: without the played runs)
//   SNOWTRACKS_BREAK=1 …   = the check hands the prints a field that says snow lies everywhere (a boot presses the floor of a room): must fail
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's): it puts the switches where each line needs them by the stand's own words.
//   What it cannot see: the picture (no GPU here) — how a print is shaded is judged on stills.
//
//   pressed   the pass, switch on: the player walks ten paces over open snow — prints at a stride's spacing along his path, left and right, handed to the g-buffer
//   where     … and walks under a roof: nothing is pressed there; no pressed texel of the whole run lies where the field holds no snow
//   slow      a crouch at the slowest pace leaves a print a footfall (the swinging foot is not one)
//   fog       a man lying in view leaves his hollow once he has come to rest, once; a man the fog of war hides presses nothing (stand-ins' bones)
//   hollow    a real fall: one of the squad put down on snow, his ragdoll run — one hollow, where he comes to rest, under his trunk
//   restart   a restart unmarks the snow
//   clean     SNOWTRACKS.mess 0 presses the clean sole, byte for byte as before there was the number: a fixed walk of stand-ins' bones against the old stamp
//             kept in this check, and against its digest recorded on the module before the change
//   untidy    … mess 1 presses other bytes (a broken lip, clods and scuffs outside the clean print), still a boot's worth each, and the map tells the shader
//   twice     … the same bytes every time (a hash of the print's own place and number: no die, no clock)
//   each      one foot set down eight times a metre apart: eight identical prints at mess 0, no two alike at mess 1
//   sprint    the same footfalls set down at a sprint mark more of the snow (longer scuffs, more clods, a spray thrown out behind); at a walk's pace or with
//             SNOWTRACKS.runMess 0 they are the walk's bytes
//   off       the prints' switch off: no texture, and the look's block says no prints; the look off: none; another level: none
//   same      a room clear on the pass plays the same with prints on and off: one PLAYED run each per seed, one digest every half second
//   old       a recording from before the key replays with it off (journal.ts applyKnobs), and the game hands its texture back
import { standUp, ROOT } from './headless.ts';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

export async function snowTracksCheck(o: { verbose?: boolean; fast?: boolean } = {}): Promise<boolean> {
  const { SNOW, SNOW_LOOK, WEATHER_BOOT } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const SF = await import(`${ROOT}/src/render/snowField.ts`);
  const ST = await import(`${ROOT}/src/game/snowTracks.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
  const BREAK = process.env.SNOWTRACKS_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const NAMES = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWTRACKS'] as const;
  const marksWas = { env: process.env.TPS_SNOWMARKS, sw: SNOW_LOOK.marks as boolean };
  const was = { snow: SNOW.on, ...SNOW_LOOK }, env = NAMES.map(n => process.env[n]), bootWas = WEATHER_BOOT.kind;
  const DT = 1 / 60, R = ST.TRACK_RES;

  /** a game stood up on `file` with the look and the prints where `look` / `tracks` say, by the stand's own words */
  async function rig(file: string, look: boolean, tracks: boolean) {
    process.env.TPS_SNOWMARKS = '0'; SNOW_LOOK.marks = false;   // (a print is whole on its frame, as these lines read it — a mark that FORMS is snowmarks-check's)
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = look ? '1' : '0'; process.env.TPS_SNOWTRACKS = tracks ? '1' : '0'; SNOW.on = false; SNOW_LOOK.on = !look; SNOW_LOOK.tracks = !tracks; WEATHER_BOOT.kind = null as any;
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')));
    let W: any; try { W = await quiet(() => standUp({ level: lvl, seed: 7 })); } finally { WEATHER_BOOT.kind = bootWas; }
    const g = W.game as any; const up: (readonly number[] | undefined)[] = [];
    // (the harness has no g-buffer: one that only remembers what it was handed)
    g.engine.gbuffer = { setSnowField() { }, setSnowCfg() { }, setSnowTracks(_t: unknown, rect?: readonly number[]) { up.push(rect ? [...rect] : undefined); } };
    return { W, g, lvl, up };
  }
  /** put a man at a spot, standing, still */
  const put = (c: any, x: number, z: number) => { c.pos[0] = x; c.pos[1] = 0; c.pos[2] = z; c.vel = [0, 0, 0]; c.update(0); };
  /** hold `key` for `secs`: the player's path (x, z each frame) */
  const walk = (W: any, key: string, secs: number) => { const path: [number, number][] = []; W.input.keys.add(key); for (let t = 0; t < secs; t += DT) { W.step(DT); path.push([W.game.player.char.pos[0], W.game.player.char.pos[2]]); } W.input.keys.delete(key); for (let i = 0; i < 20; i++) W.step(DT); return path; };
  const len = (p: [number, number][]) => p.length ? Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]) : 0;
  /** pressed texels (byte ≥ 128: inside a print's outline) within `r` m of a path — and their count over the whole plan */
  const near = (T: any, path: [number, number][], r: number) => { let n = 0; const seen = new Set<number>(); for (const [x, z] of path) { const x0 = Math.floor((x - r - WORLD.min[0]) * R), x1 = Math.ceil((x + r - WORLD.min[0]) * R), z0 = Math.floor((z - r - WORLD.min[2]) * R), z1 = Math.ceil((z + r - WORLD.min[2]) * R); for (let tz = Math.max(0, z0); tz <= Math.min(T.h - 1, z1); tz++) for (let tx = Math.max(0, x0); tx <= Math.min(T.w - 1, x1); tx++) { const i = tz * T.w + tx; if (T.data[i] >= 128 && !seen.has(i)) { seen.add(i); n++; } } } return n; };
  const pressed = (T: any) => { let n = 0; for (let i = 0; i < T.data.length; i++) if (T.data[i] >= 128) n++; return n; };

  try {
    const A = await rig('pass.json', true, true); const g = A.g, W = A.W; const F = g.snowField, T = g.snowTracks;
    if (!F || !T) { verdict(false, 'pressed — the pass, switches on: the game holds a field and a prints texture', `game.snowField ${F ? 'held' : F} · game.snowTracks ${T ? 'held' : T} (SNOW_LOOK ${JSON.stringify(SNOW_LOOK)})`); }
    else {
      const wx = g.weather as any; const at = (x: number, z: number) => SF.snowFieldAt(F, x, z);
      // an open stretch of fresh snow with room to walk, and a spot deep under a roof
      let open: number[] | null = null, roofed: number[] | null = null; const roofs: number[][] = [];
      for (let x = 3; x < 37; x += 0.5) for (let z = 3; z < 25; z += 0.5) {
        const all = (v: boolean, r: number) => [-r, 0, r].every(dx => [-r, 0, r].every(dz => wx.underRoof(x + dx, z + dz) === v && !g.col.solidBlocked([x, 1.0, z], [x + dx, 1.0, z + dz])));
        if (!open && all(false, 2.5) && [-2, 0, 2].every(dx => [-2, 0, 2].every(dz => at(x + dx, z + dz).cover > 0.9 && at(x + dx, z + dz).mound < 0.05))) open = [x, z];
        if (all(true, 2) && [-2, -1, 0, 1, 2].every(dx => [-2, -1, 0, 1, 2].every(dz => at(x + dx, z + dz).cover < 0.05))) roofs.push([x, z]);
      }
      // (… one a man can stand on: a building nobody enters is roofed too, and puts him back outside)
      const stands = (x: number, z: number) => { put(g.player.char, x, z); for (let i = 0; i < 30; i++) W.step(DT); return Math.hypot(g.player.char.pos[0] - x, g.player.char.pos[2] - z) < 0.3; };
      if (!open || !roofs.length) verdict(false, 'pressed — the pass has open snow to walk and a roofed floor', `open ${open} · roofed ${roofs.length}`);
      else {
        const pc = g.player.char; const KEYS = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
        // ---- pressed
        const stood = stands(open[0], open[1]);
        const p0 = T.prints, n0 = near(T, [[open[0], open[1]]], 3); A.up.length = 0;
        let path: [number, number][] = []; let key = '';
        for (const k of KEYS) { put(pc, open[0], open[1]); path = walk(W, k, 2.0); key = k; if (len(path) > 1.5) break; }
        const made = T.prints - p0, on = near(T, path, 0.45) - n0, per = len(path) / Math.max(1, made);
        const rects = A.up.filter(r => r && r.length === 4).length;
        verdict(stood && len(path) > 1.5 && made >= 4 && per > 0.2 && per < 1.2 && on > made * 15 && rects >= made / 2 && T.dirty === null,
          'pressed — a walk over open snow leaves prints along it, and they are handed to the g-buffer',
          `from (${open})${stood ? '' : ' (he would not stand there)'} holding ${key} for 2 s: ${len(path).toFixed(2)} m walked · ${made} prints (one every ${per.toFixed(2)} m) · ${on} texels pressed within 45 cm of his path (a boot is some ${Math.round(0.3 * 0.11 * R * R)}) · ${rects} changed rectangles handed over, none waiting: ${T.dirty === null}`);
        // ---- slow: a crouch at the slowest pace — the swinging foot is not a footfall
        { g.player.crouch = true; const paceWas = g.player.pace; g.player.pace = 0.35; let slow: [number, number][] = []; const q0 = T.prints;
          for (const k of KEYS) { if (!stands(open[0], open[1])) break; const q = T.prints; slow = walk(W, k, 3.0); if (len(slow) > 0.8) { const n = T.prints - q, each = len(slow) / Math.max(1, n);
            verdict(n >= 2 && each > 0.17, 'slow — a slow crouch leaves a print a footfall, not a smear', `crouched at pace 0.35 holding ${k} for 3 s: ${len(slow).toFixed(2)} m, ${n} prints, one every ${each.toFixed(2)} m, left and right in turn (with the swinging foot read as down it was one every 0.12 m, the floor \`apart\` sets)`); break; } }
          if (!(len(slow) > 0.8)) verdict(false, 'slow — a slow crouch leaves a print a footfall, not a smear', `he would not walk: ${len(slow).toFixed(2)} m, ${T.prints - q0} prints`);
          g.player.crouch = false; g.player.pace = paceWas; }
        // ---- where
        if (BREAK) g.snowField = { ...F, cover: new Float32Array(F.cover.length).fill(1) };
        for (const r of roofs) if (stands(r[0], r[1])) { roofed = r; break; }
        if (!roofed) roofed = roofs[0];
        const before = pressed(T); let in2: [number, number][] = [];
        for (const k of KEYS) { if (!stands(roofed[0], roofed[1])) break; in2 = walk(W, k, 0.9); if (len(in2) > 0.6) break; }
        const inside = pressed(T) - before; g.snowField = F;
        let bare = 0; for (let tz = 0; tz < T.h; tz++) for (let tx = 0; tx < T.w; tx++) if (T.data[tz * T.w + tx] >= 128 && at(WORLD.min[0] + (tx + 0.5) / R, WORLD.min[2] + (tz + 0.5) / R).cover < 0.05) {
          // (a print's own outline may lap a hand over an edge of the snow: bare = no snow within 25 cm either)
          const x = WORLD.min[0] + (tx + 0.5) / R, z = WORLD.min[2] + (tz + 0.5) / R; if ([-0.25, 0, 0.25].every(dx => [-0.25, 0, 0.25].every(dz => at(x + dx, z + dz).cover < 0.05))) bare++;
        }
        verdict(len(in2) > 0.6 && inside === 0 && bare === 0, 'where — nothing is pressed where no snow lies',
          `under the roof at (${roofed}): ${len(in2).toFixed(2)} m walked, ${inside} texels pressed anywhere meanwhile · over the whole plan: ${pressed(T)} pressed texels, ${bare} of them with no snow within 25 cm`);
        // ---- fog (stand-ins' bones: who is hidden is the one thing on trial)
        { const lying = (x: number, z: number) => ({ alive: false, bodyYaw: 0, pos: [x, 0, z], vel: [0, 0, 0], bones: { hips: [x, 0.16, z], head: [x + 0.62, 0.12, z + 0.1], footL: [x - 0.8, 0.08, z - 0.12], footR: [x - 0.78, 0.08, z + 0.14] } });
          const hx = open[0] + 1.5, hz = open[1] - 1.5, fx = open[0] - 1.5, fz = open[1] - 1.5;
          const seen = { char: lying(hx, hz) }, unseen = { char: lying(fx, fz) };
          const G = { player: { char: { alive: true, pos: [0, 0, 0], vel: [0, 0, 0], bones: {} } }, guards: [seen, unseen], civilians: [], fogOfWar: { hidden: (gd: unknown) => gd === unseen } };
          const h0 = T.hollows, b0 = near(T, [[hx, hz]], 1.2), f0 = near(T, [[fx, fz]], 1.2);
          ST.updateSnowTracks(G as any, T, F, DT); const early = T.hollows - h0;
          for (let i = 0; i < 60; i++) ST.updateSnowTracks(G as any, T, F, DT); const once = T.hollows; for (let i = 0; i < 60; i++) ST.updateSnowTracks(G as any, T, F, DT);
          const body = near(T, [[hx, hz]], 1.2) - b0, fog = near(T, [[fx, fz]], 1.2) - f0;
          verdict(early === 0 && once === h0 + 1 && T.hollows === once && body > 250 && fog === 0, 'fog — a man lying in view leaves his hollow once he has come to rest, once; a man the fog hides presses nothing (the fog\'s stand-in here has no fog up, so this is the rule with FOG.tracks off; with it his marks are kept and found: probes.ts fog-tracks)',
            `a man down at (${hx}, ${hz}): ${early} hollows on the first frame, ${once - h0} after a second, ${body} texels pressed (a trunk and two legs: some ${Math.round((0.62 * 0.38 + 2 * 0.8 * 0.21) * R * R)}), none again in the next second: ${T.hollows === once} · one down in the fog at (${fx}, ${fz}): ${fog} texels`); }
        // ---- restart
        { const had = pressed(T), pr = T.prints; A.up.length = 0; g.resetLevelState(); const left = pressed(T); W.step(DT);
          verdict(had > 0 && left === 0 && T.prints <= 2 && T.hollows <= 1 && A.up.length >= 1, 'restart — a restart unmarks the snow',
            `${had} pressed texels and ${pr} prints before · ${left} texels after · the cleared bytes handed over on the next frame: ${A.up.length >= 1}`); }
      }
    }
    // ---- untidy prints (SNOWTRACKS.mess): the stamps alone, on a map of their own — stand-ins' bones over a field that says snow lies everywhere
    { const K = ST.SNOWTRACKS, messWas = K.mess;
      const everywhere = { w: 1, h: 1, cover: new Float32Array([1]), mound: new Float32Array(1), packed: new Float32Array(1), old: new Float32Array(1) };
      const fnv = (d: Uint8Array) => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
      /** footfalls → a fresh map: each foot stands four frames where it lands (ankle at `at`, toe along `dir`), the other is in the air */
      const stamp = (mess: number, falls: { at: [number, number]; dir: [number, number]; left: boolean; mid?: [number, number] }[], pace = 1.4) => {
        K.mess = mess; const T = ST.makeSnowTracks();
        const c: any = { alive: true, bodyYaw: 0, pos: [0, 0, 0], vel: [0, 0, 0], bones: {} };
        const G = { player: { char: c }, guards: [], civilians: [], fogOfWar: { hidden: () => false } };
        for (const { at: [x, z], dir: [fx, fz], left, mid } of falls) {
          const down = [x, 0.08, z], toe = [x + fx * 0.17, 0.03, z + fz * 0.17], up = [x - fx * 0.4, 0.4, z - fz * 0.4];
          c.pos = [mid ? mid[0] : x, 0, mid ? mid[1] : z]; c.bodyYaw = Math.atan2(fx, fz); c.vel = [fx * pace, 0, fz * pace];
          c.bones = { hips: [x, 0.95, z], footL: left ? down : up, toeL: left ? toe : up, footR: left ? up : down, toeR: left ? up : toe };
          for (let i = 0; i < 4; i++) ST.updateSnowTracks(G as any, T, everywhere as any, DT);
        }
        return T;
      };
      const plan = (T: any): Uint8Array => T.data.subarray(0, T.w * (T.h - ST.TRACK_PAD));
      const count = (d: Uint8Array, min: number) => { let n = 0; for (let i = 0; i < d.length; i++) if (d[i] >= min) n++; return n; };
      // THE FIXED WALK: fourteen footfalls along a bent line, left and right in turn
      const WALK = Array.from({ length: 14 }, (_, s) => { const a = 0.35 + s * 0.06, fx = Math.sin(a), fz = Math.cos(a), left = s % 2 === 0;
        return { at: [12.03 + s * 0.31 * fx + (left ? -0.09 : 0.09) * fz, 9.07 + s * 0.31 * fz - (left ? -0.09 : 0.09) * fx] as [number, number], dir: [fx, fz] as [number, number], left }; });
      try {
        // ---- clean: mess 0 writes the bytes the stamp wrote before there was a mess number
        { const T = stamp(0, WALK), d = plan(T);
          // (the clean sole as snowTracks.ts pressed it on 10-14, kept here word for word: a capsule heel → toe, 255 inside, 128 on its outline, 0 half a skirt out)
          const ref = new Uint8Array(d.length), ox = WORLD.min[0], oz = WORLD.min[2], H = T.h - ST.TRACK_PAD;
          const press = (ax: number, az: number, bx: number, bz: number, r: number, r0: number) => {
            const pad = Math.max(r, r0) + K.skirt * 0.5 + 1 / R;
            const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad - ox) * R)), x1 = Math.min(T.w - 1, Math.ceil((Math.max(ax, bx) + pad - ox) * R));
            const z0 = Math.max(0, Math.floor((Math.min(az, bz) - pad - oz) * R)), z1 = Math.min(H - 1, Math.ceil((Math.max(az, bz) + pad - oz) * R));
            const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
            for (let tz = z0; tz <= z1; tz++) { const pz = oz + (tz + 0.5) / R - az;
              for (let tx = x0; tx <= x1; tx++) { const px = ox + (tx + 0.5) / R - ax;
                const t = l2 > 1e-8 ? Math.max(0, Math.min(1, (px * dx + pz * dz) / l2)) : 0;
                const dd = Math.hypot(px - dx * t, pz - dz * t) - (r0 + (r - r0) * t);
                const b = Math.round(Math.max(0, Math.min(1, 0.5 - dd / K.skirt)) * 255), i = tz * T.w + tx; if (b > ref[i]) ref[i] = b; } }
          };
          for (const { at: [x, z], dir: [fx, fz] } of WALK) {
            let ux = (x + fx * 0.17) - x, uz = (z + fz * 0.17) - z; const ul = Math.hypot(ux, uz); ux /= ul; uz /= ul;
            const cx = x + ux * 0.06, cz = z + uz * 0.06, half = Math.max(0, K.footLen - K.footWide);
            press(cx - ux * half, cz - uz * half, cx + ux * half, cz + uz * half, K.footWide, K.footWide * K.heel);
          }
          let off = 0; for (let i = 0; i < d.length; i++) if (d[i] !== ref[i]) off++;
          const past = count(T.data.subarray(d.length), 1), WAS = '27b624ef';   // (the fixed walk's bytes on the module of 10-14, before the number: 1280 × 896, 14 prints, 1077 texels marked, 434 pressed)
          verdict(T.prints === 14 && off === 0 && fnv(d) === WAS && count(d, 1) === 1077 && count(d, 128) === 434 && past === 0 && T.data[ST.messAt(T)] === 0,
            'clean — mess 0 presses the clean sole, byte for byte as before the number',
            `the fixed walk (14 footfalls, stand-ins' bones) at mess 0: ${T.prints} prints · ${off} of ${d.length} plan bytes differ from the old stamp kept in this check · digest ${fnv(d)} (recorded on the module before the change: ${WAS}; a retuned SOLE — footLen, footWide, heel, skirt — moves it and is re-pinned) · ${count(d, 1)} texels marked, ${count(d, 128)} pressed · ${past} bytes set in the ${ST.TRACK_PAD} rows past the plan (the shader's mess: ${T.data[ST.messAt(T)]})`); }
        // ---- untidy: mess 1 writes other bytes, the same ones every time, and says so to the shader
        { const A0 = plan(stamp(0, WALK)).slice(), T1 = stamp(1, WALK), A1 = plan(T1).slice(), T2 = stamp(1, WALK), A2 = plan(T2), Th = plan(stamp(0.5, WALK));
          let diff = 0, lumps = 0, half = 0; for (let i = 0; i < A0.length; i++) { if (A0[i] !== A1[i]) diff++; if (A0[i] === 0 && A1[i] > 0) lumps++; if (Th[i] !== A0[i] && Th[i] !== A1[i]) half++; }
          let same = T1.data.length === T2.data.length; for (let i = 0; same && i < T1.data.length; i++) if (T1.data[i] !== T2.data[i]) same = false;
          const pr0 = count(A0, 128), pr1 = count(A1, 128);
          verdict(diff > 400 && lumps > 60 && pr1 > pr0 * 0.6 && pr1 < pr0 * 1.6 && T1.data[ST.messAt(T1)] === 100 && T1.prints === 14,
            'untidy — mess 1 presses other bytes: a broken lip, clods and scuffs outside the clean print, and the map tells the shader',
            `the fixed walk at mess 1: ${diff} plan bytes differ from mess 0's (${count(A0, 1)} marked there, ${count(A1, 1)} here) · ${lumps} texels marked that the clean prints leave untouched (clods, scuffs, the bank's longer reach) · ${pr1} pressed against ${pr0} (still a boot's worth each: ${(pr1 / 14).toFixed(0)} a print) · the map's mess byte ${T1.data[ST.messAt(T1)]} (× 100) · at mess 0.5: ${half} bytes that are neither mess 0's nor mess 1's`);
          verdict(same && fnv(A1) === fnv(A2), 'twice — the same walk presses the same bytes (a hash of the print\'s place and number: no die, no clock)',
            `the fixed walk at mess 1, twice, each on a fresh map: every byte the same: ${same} · digests ${fnv(A1)} and ${fnv(A2)}`); }
        // ---- each: one foot set down eight times a metre apart, on the same texel phase — at mess 0 eight identical prints, at mess 1 no two alike
        { const HOP = Array.from({ length: 8 }, (_, s) => ({ at: [12 + s, 9.25] as [number, number], dir: [1, 0] as [number, number], left: true, mid: [12 + s, 9.35] as [number, number] }));
          const win = (T: any, s: number) => { const tx = (12 + s - WORLD.min[0]) * R, tz = Math.round((9.25 - WORLD.min[2]) * R), o = new Uint8Array(32 * 32); for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) o[j * 32 + i] = T.data[(tz - 16 + j) * T.w + tx - 14 + i]; return o; };
          const T0 = stamp(0, HOP), T1 = stamp(1, HOP); const w0 = HOP.map((_, s) => win(T0, s)), w1 = HOP.map((_, s) => win(T1, s));
          const differ = (a: Uint8Array, b: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
          let clean = 0, least = 1e9, most = 0; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { clean = Math.max(clean, differ(w0[a], w0[b])); const n = differ(w1[a], w1[b]); least = Math.min(least, n); most = Math.max(most, n); }
          const floors = w1.map(w => w.reduce((m, v) => Math.max(m, v), 0)), sizes = w1.map(w => count(w, 128)), thrown = w1.map((w, s) => { let n = 0; for (let i = 0; i < w.length; i++) if (w[i] > 0 && w0[s][i] === 0) n++; return n; });
          const spread = (a: number[]) => Math.max(...a) - Math.min(...a);
          verdict(T1.prints === 8 && clean === 0 && least >= 40 && spread(floors) >= 12 && spread(sizes) >= 12 && spread(thrown) >= 12 && sizes.every(n => n > 15 && n < 80),
            'each — no two prints of a trail are alike: depth, outline and what was thrown out are each print\'s own',
            `one foot set down 8 times a metre apart (the same texel phase): at mess 0 the eight 32 × 32-texel windows differ by at most ${clean} bytes · at mess 1 any two differ by ${least} to ${most} bytes · deepest byte of each ${floors.join(' ')} · pressed texels ${sizes.join(' ')} (clean: ${count(w0[0], 128)}) · texels marked outside the clean print ${thrown.join(' ')}`); }
        // ---- sprint: the same footfalls set down at a sprint are torn up — and at a walk's pace, or with runMess 0, they are the walk's bytes
        { const runWas = K.runMess; try {
            const FAST = BREAK ? 1.4 : 4.7;   // (SNOWTRACKS_BREAK=1: the sprinter is handed to the prints as a walker)
            const Aw = plan(stamp(1, WALK)).slice(), As = plan(stamp(1, WALK, FAST)).slice(), As2 = plan(stamp(1, WALK, FAST)).slice(), Aj = plan(stamp(1, WALK, 3.3)).slice();
            K.runMess = 0; const Az = plan(stamp(1, WALK, 4.7)).slice(); K.runMess = runWas;
            const differ = (a: Uint8Array, b: Uint8Array) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
            const mw = count(Aw, 1), ms = count(As, 1), mj = count(Aj, 1), pw = count(Aw, 128), ps = count(As, 128);
            let fresh = 0; for (let i = 0; i < Aw.length; i++) if (Aw[i] === 0 && As[i] > 0) fresh++;
            verdict(differ(Aw, As) > 800 && ms > mw * 1.25 && fresh > 500 && mj > mw && mj < ms && ps > pw * 0.7 && ps < pw * 2.2 && differ(As, As2) === 0 && differ(Az, Aw) === 0 && K.runLo > 2.2,
              'sprint — a sprint tears the trail up: longer scuffs, more thrown out and a spray behind; a walk\'s prints are untouched and runMess 0 = a walk\'s',
              `the fixed walk's 14 footfalls at mess 1, the man going 1.4 m/s, 3.3 and ${FAST}: ${mw}, ${mj} and ${ms} texels marked (× ${(ms / mw).toFixed(2)} at the sprint) · ${fresh} texels marked that the walk leaves untouched · ${differ(Aw, As)} bytes differ · pressed ${pw} → ${ps} (still boots) · the sprint twice: ${differ(As, As2)} bytes differ · runMess 0 at 4.7 m/s against the walk: ${differ(Az, Aw)} bytes differ · no run under ${K.runLo} m/s (a walk tops out near 2)`);
          } finally { K.runMess = runWas; } }
      } finally { K.mess = messWas; }
    }
    // ---- off
    { const B = await rig('pass.json', true, false); B.W.step(DT); const cfgOff = SF.snowCfgRows(B.g.snowField, B.g.snowTracks ? R : 0);
      const C = await rig('pass.json', false, true); const D = await rig('compound.json', true, true);
      verdict(!!B.g.snowField && B.g.snowTracks === null && cfgOff[34] === 0 && cfgOff[35] === 0 && C.g.snowTracks === null && C.g.snowField === null && D.g.snowTracks === null
        && SF.snowCfgRows(F0(A), R)[34] > 0 && SF.snowCfgRows(F0(A), R)[35] === R,
        'off — no prints with their switch off, none with the look off, none on another level',
        `the pass, prints off: field ${B.g.snowField ? 'held' : 'none'}, texture ${B.g.snowTracks}, the block's depth ${cfgOff[34]} and rate ${cfgOff[35]} · look off: ${C.g.snowTracks} · compound.json: ${D.g.snowTracks} · with prints on the block says ${SF.snowCfgRows(F0(A), R)[34].toFixed(3)} m deep at ${SF.snowCfgRows(F0(A), R)[35]} texels a metre`); }
    // ---- hollow: a real fall (the scenario's squad on the snow, one man put down, his ragdoll run)
    { const H = await rig('pass.json', true, true); const g2 = H.g, T2 = g2.snowTracks;
      await quiet(() => startFromQuery(g2, '?levelFile=pass.json&roomclear=0&squad4')); for (let i = 0; i < 60; i++) H.W.step(DT);
      g2.fogOfWar.on = false;
      const man = (g2.guards as any[]).find(x => x.team === 'operative' && x.char.alive && SF.snowFieldAt(g2.snowField, x.char.pos[0], x.char.pos[2]).cover > 0.9);
      if (!T2 || !man) verdict(false, 'hollow — the pass has a man standing on snow to put down', `texture ${T2 ? 'held' : T2} · ${g2.guards.length} men, ${man ? 'one' : 'none'} of the team on snow`);
      else {
        const c = man.char, h0 = T2.hollows; let at = -1, hipsThen: number[] | null = null;
        killGuard(g2, man, [0, 0, 1]);
        for (let i = 0; i < 360; i++) { H.W.step(DT); if (at < 0 && T2.hollows > h0) { at = i; hipsThen = [...c.bones.hips]; } }
        const b = c.bones, head = b.head ?? b.hips; let on = 0, n = 0;
        for (let t = 0; t <= 1.0001; t += 0.1) { const x = b.hips[0] + (head[0] - b.hips[0]) * t, z = b.hips[2] + (head[2] - b.hips[2]) * t; n++; if (T2.data[Math.floor((z - WORLD.min[2]) * R) * T2.w + Math.floor((x - WORLD.min[0]) * R)] >= 128) on++; }
        const slid = hipsThen ? Math.hypot(b.hips[0] - hipsThen[0], b.hips[2] - hipsThen[2]) : 9;
        verdict(T2.hollows === h0 + 1 && at > 30 && slid < 0.1 && on >= n - 1, 'hollow — a man put down on snow leaves one hollow, where he comes to rest',
          `#${c.id} put down at (${c.pos[0].toFixed(1)}, ${c.pos[2].toFixed(1)}): ${T2.hollows - h0} hollow(s), pressed ${at} frames after the shot · his hips ${slid.toFixed(2)} m from there six seconds on · ${on} of ${n} points along his trunk lie on pressed snow`);
      } }
    // ---- same
    if (!o.fast) {
      const E = (SCENARIOS as any[]).find(s => s.level === 'pass.json');
      if (!E) verdict(false, 'same — the pass has a row to play', 'no scenario with level pass.json in scene/scenarioList.ts SCENARIOS');
      else {
        const dir = mkdtempSync(resolve(tmpdir(), 'snowtracks-check-'));
        const run = async (name: string, seed: number, tracks: boolean) => {
          const out = resolve(dir, `${name}-${seed}.json`);
          const p = Bun.spawn(['bun', 'run', resolve(ROOT, 'tools/qa/playthrough.ts'), '--one', `${E.id}:${seed}`, '--out', out, '--cap', '150'],
            { stdout: 'ignore', stderr: 'pipe', env: { ...process.env, TPS_SNOW: '1', TPS_SNOWLOOK: '1', TPS_SNOWTRACKS: tracks ? '1' : '0', PT_DIGEST: '1', SNOWTRACKS_BREAK: '' } });
          const code = await p.exited; if (code !== 0 || !existsSync(out)) return { digest: `no run (exit ${code}: ${(await new Response(p.stderr).text()).trim().split('\n').pop()?.slice(0, 200)})`, secs: 0, how: '' };
          const r = JSON.parse(readFileSync(out, 'utf8')); return { digest: String(r.digest ?? 'no digest in the run'), secs: +(r.secs ?? r.t ?? 0), how: String(r.outcome ?? r.end ?? r.result ?? '') };
        };
        const SEEDS = [1, 2];
        const [on, off] = await Promise.all([Promise.all(SEEDS.map(s => run('on', s, true))), Promise.all(SEEDS.map(s => run('off', s, false)))]);
        rmSync(dir, { recursive: true, force: true });
        const hex = (d: string) => /^[0-9a-f]+$/.test(d);
        verdict(on.every((r, i) => hex(r.digest) && r.digest === off[i].digest) && on.some(r => r.secs >= 40) && on[0].digest !== on[1].digest,
          'same — a room clear on the pass plays the same with prints on and off', `played runs, their digest every half second — ${SEEDS.map((s, i) => `seed ${s}: ${on[i].digest} on (${on[i].secs.toFixed(0)} s ${on[i].how}), ${off[i].digest} off (${off[i].secs.toFixed(0)} s ${off[i].how})`).join(' · ')}`);
      }
    }
    // ---- old
    { let ok = false, how = '';
      try { SNOW_LOOK.on = true; SNOW_LOOK.tracks = true; A.W.step(DT); const held = !!A.g.snowTracks; const k = (J as any).knobsSnapshot(A.g); const had = !!k.tables?.SNOW_LOOK && 'tracks' in k.tables.SNOW_LOOK; delete k.tables.SNOW_LOOK.tracks; (J as any).applyKnobs(A.g, k); A.W.step(DT);
        ok = held && had && SNOW_LOOK.tracks === false && A.g.snowTracks === null && !!A.g.snowField; how = `a snapshot carries the key: ${had} · held before: ${held} · the key taken out and applied: SNOW_LOOK.tracks ${SNOW_LOOK.tracks}, the game's texture ${A.g.snowTracks === null ? 'handed back' : 'still held'}, its field ${A.g.snowField ? 'kept' : 'gone'}`; }
      catch (e) { how = `threw: ${(e as Error).message}`; }
      verdict(ok, 'old — a recording from before the key replays with it off, and the game hands its texture back', how); }
  } finally {
    SNOW.on = was.snow; SNOW_LOOK.on = was.on; SNOW_LOOK.wisps = was.wisps; SNOW_LOOK.tracks = was.tracks; SNOW_LOOK.glow = was.glow; WEATHER_BOOT.kind = bootWas;
    SNOW_LOOK.marks = marksWas.sw; if (marksWas.env === undefined) delete process.env.TPS_SNOWMARKS; else process.env.TPS_SNOWMARKS = marksWas.env;
    NAMES.forEach((n, i) => { if (env[i] === undefined) delete process.env[n]; else process.env[n] = env[i]; });
  }
  console.log(`\nsnowtracks-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWTRACKS_BREAK=1: the prints told snow lies everywhere — this run must fail)' : ''}`);
  return fails === 0;
  function F0(X: any) { return X.g.snowField; }
}

if (import.meta.main) { const ok = await snowTracksCheck({ verbose: process.argv.includes('--verbose'), fast: process.argv.includes('--fast') }); process.exit(ok ? 0 : 1); }
