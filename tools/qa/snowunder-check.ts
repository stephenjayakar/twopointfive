// NO SNOW UNDER THE ROOFS, WHICHEVER SLAB (SNOW_LOOK.under; ?snowunder=0, TPS_SNOWUNDER=1) — particles_common.wgsl flakeUnder / flakeHidden under the prelude's
// SNOW_UNDER, game/snowFx.ts flakeUnder / flakeHidden. Two finds of a review of the rule that hides a flake from a surface under a roof: it drew each roof's
// rectangle in by itself, so the seam where two slabs of one building meet was open to snow (the doorways on that line), and it opened EVERY top at the ceiling,
// the partitions' deep inside a building as the outer walls'.
//
//   bun run tools/qa/snowunder-check.ts [--verbose]     exit 0 = all pass, 1 = a FAIL line
//   SNOWUNDER_BREAK=1 …                                 = the switch never reaches the prelude and the same lines asked: must fail
//   TPS_PROFILE=shipped …                               = the same on the stand the page opens on
//
//   stands    held off on the frozen stand, on as the page opens, off by the page's own word; a recording from before the key replays with it off
//   prelude   the page hands the switch to the shaders as `const SNOW_UNDER` (main.ts → frame.ts snowLookConfig.under): true with it on, false with it off
//   seam      on the pass no floor with roof over the whole square about it shows snow (with it off: the strip where two slabs of one building meet does)
//   same      away from that seam nothing moves at the floor, nothing is newly OPEN, and what stands above the ceiling's plane is in the open as it was
//   tops      a partition's top deep inside a building is under the roof; the whole top of every wall with open sky beside it still takes the snow
//   text      the shader carries the rule and the CPU's two numbers, ahead of the old lines, which stand whole for the switch off
//
// THE ORACLE is not the rule: `whole(x, z, d)` asks every point of the square 2 d wide (a 9 × 9 lattice), where the rule asks its middle and four corners.
//
// HEADLESS: no GPU — flakeHidden is asked by the splat's fragment shader, which nothing here runs. The lines ask its CPU twin over the pass's own roofs and boxes;
// the text line holds the shader to the twin's shape; a page boot proves it compiles.
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export async function snowUnderCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { flakeHidden, flakeHiddenUnder, FLAKE_WALL_IN, FLAKE_TOP_IN } = await import(`${ROOT}/src/game/snowFx.ts`);
  const { scenePrelude, snowLookConfig } = await import(`${ROOT}/src/render/frame.ts`);
  const { FROZEN_HOLDS, harnessProfile, pageSwitches } = await import(`${ROOT}/src/host/profile.ts`);
  const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
  const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
  const BREAK = process.env.SNOWUNDER_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWUNDER'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, cfg: { ...snowLookConfig }, env: ENV.map(k => process.env[k]) };

  /** the pass stood up in snow with the switch where `on` says — by the stand's own word (`word` false: no word at all, the stand as it is) */
  async function rig(on: boolean, word = true) {
    process.env.TPS_SNOW = '1';
    if (word) { process.env.TPS_SNOWUNDER = on ? '1' : '0'; SNOW_LOOK.under = !on; }   // (the module's switch left the WRONG way round: only the stand's word can put it right)
    else { delete process.env.TPS_SNOWUNDER; SNOW_LOOK.under = harnessProfile() === 'shipped' ? was.look.under : true; }
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    return { W, g: W.game, stood: SNOW_LOOK.under as boolean };
  }
  /** what the page's shaders are compiled with, the switch standing as it does: main.ts copies it to the prelude's config at boot (under SNOWUNDER_BREAK it never does) */
  const compiled = (): boolean => { snowLookConfig.under = BREAK ? false : SNOW_LOOK.under; return /const SNOW_UNDER: bool = true;/.test(scenePrelude()); };

  try {
    // ---- stands
    { const N = await rig(true, false); const shipped = harnessProfile() === 'shipped'; const bare = N.stood;
      const J = await rig(false); const U = await rig(true); const row = FROZEN_HOLDS['SNOW_LOOK.under']; const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(J.g)));
      SNOW_LOOK.under = true; const carries = 'under' in (snap().tables.SNOW_LOOK ?? {}); const old = snap(); delete old.tables.SNOW_LOOK.under; await quiet(() => JOURNAL.applyKnobs(J.g, old)); const without = SNOW_LOOK.under;
      SNOW_LOOK.under = true; const own = snap(); SNOW_LOOK.under = false; await quiet(() => JOURNAL.applyKnobs(J.g, own)); const withIt = SNOW_LOOK.under;
      const tables = snap(); pageSwitches(new URLSearchParams('')); const pOn = SNOW_LOOK.under; pageSwitches(new URLSearchParams('snowunder=0')); const pOff = SNOW_LOOK.under; pageSwitches(new URLSearchParams('snowpast=0')); const pOther = SNOW_LOOK.under;
      await quiet(() => JOURNAL.applyKnobs(J.g, tables));   // (pageSwitches wrote every table: each back as this line found it)
      verdict(bare === shipped && J.stood === false && U.stood === true && typeof row === 'string' && /TPS_SNOWUNDER=1/.test(row) && carries && without === false && withIt === true && pOn === true && pOff === false && pOther === true,
        'stands — held off on the frozen stand, on as the page opens, off by the page\'s own word; a recording from before the key replays with it off',
        `this stand (${shipped ? 'shipped' : 'frozen'}) with no word: ${bare} · TPS_SNOWUNDER=0 → ${J.stood}, =1 → ${U.stood} · FROZEN_HOLDS['SNOW_LOOK.under'] = ${row ? `'${row.slice(0, 15)}…'` : 'no row'} · the page's boot: no flag → ${pOn}, ?snowunder=0 → ${pOff}, another flag → ${pOther} · the journal carries the key: ${carries}; applyKnobs with no \`under\` key → ${without}, with it on → ${withIt}`); }

    const A = await rig(true); const on = compiled(); await rig(false); const off = compiled(); SNOW_LOOK.under = true;
    // ---- prelude
    { const main = readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8'); const fed = /snowLookConfig\.under = SNOW_LOOK\.under;/.test(main);
      verdict(on === true && off === false && fed, 'prelude — the page compiles its shaders with the switch: `const SNOW_UNDER` true with it on, false with it off',
        `the prelude with the switch on: SNOW_UNDER ${on} · off: ${off} · main.ts hands it over at boot: ${fed}`); }

    const roofs: number[][] = (A.g.weather as any).roofs ?? []; const CY = WORLD.ceilingY as number; const boxes: { c: number[]; h: number[]; yaw?: number }[] = A.g.engine.world.statics;
    /** the rule the page's shaders were compiled with (`on`), asked of the CPU's copy */
    const hid = (x: number, y: number, z: number, under: boolean) => under ? flakeHiddenUnder(roofs, x, y, z, CY) : flakeHidden(roofs, x, y, z, CY);
    const roofed = (x: number, z: number) => roofs.some(R => x >= R[0] && z >= R[1] && x <= R[2] && z <= R[3]);
    /** THE ORACLE: is every point of the square 2 d wide about (x, z) under a roof (a 9 × 9 lattice; the rule asks five of them) */
    const whole = (x: number, z: number, d: number) => { for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) if (!roofed(x + i * d / 4, z + j * d / 4)) return false; return true; };
    const solid = (x: number, y: number, z: number) => boxes.some(b => !b.yaw && Math.abs(x - b.c[0]) <= b.h[0] && Math.abs(y - b.c[1]) <= b.h[1] && Math.abs(z - b.c[2]) <= b.h[2]);
    const ST = 0.04, A2 = ST * ST;
    // ---- seam + same (the level's whole plan at the floor, 4 cm apart)
    { let openOn = 0, openOff = 0, foot = 0, door = 0, newlyOpen = 0, moved = 0, movedOff = 0, wrong = 0, pts = 0, aboveHid = 0, above = 0; const box = [1e9, 1e9, -1e9, -1e9];
      for (let z = WORLD.min[2] + ST / 2; z < WORLD.max[2]; z += ST) for (let x = WORLD.min[0] + ST / 2; x < WORLD.max[0]; x += ST) { pts++;
        const a = hid(x, 0.05, z, on), b = hid(x, 0.05, z, false), deep = whole(x, z, FLAKE_WALL_IN);
        if (a !== deep) wrong++;
        if (deep && !a) openOn += A2;
        if (deep && !b) { openOff += A2; if (!solid(x, 1, z)) { if (solid(x, 2.6, z)) door += A2; else foot += A2; } box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], z); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], z); }
        if (a !== b) { moved++; if (!deep) movedOff++; if (b && !a) newlyOpen++; }
        if (pts % 7 === 0) { above++; if (hid(x, CY + 0.5, z, on)) aboveHid++; } }
      verdict(roofs.length >= 2 && openOn < 0.01 && wrong === 0 && openOff > 0.5 && foot + door > 0.3 && door > 0.05, 'seam — no floor with roof over the whole square about it shows snow (off: the strip where two slabs of one building meet does)',
        `${roofs.length} roofs of the pass · floor with roof over every point ${FLAKE_WALL_IN} m about it, and open to snow: ${openOn.toFixed(2)} m² (off: ${openOff.toFixed(2)} m², x ${box[0].toFixed(1)}‥${box[2].toFixed(1)}, z ${box[1].toFixed(2)}‥${box[3].toFixed(2)}: ${foot.toFixed(2)} m² of it bare floor along that wall's foot, ${door.toFixed(2)} m² the floor of the doorway in it) · the rule's five points against the whole square: ${wrong} of ${pts} differ`);
      const mid = roofs.map(R => hid((R[0] + R[2]) / 2, 0, (R[1] + R[3]) / 2, on)), yard = hid(20, 0, 16, on);
      verdict(newlyOpen === 0 && movedOff === 0 && moved > 0 && aboveHid === 0 && mid.every(Boolean) && !yard, 'same — away from that seam nothing moves at the floor, nothing is newly open, and above the ceiling\'s plane all is in the open',
        `${pts} points of the plan at the floor: the rule answers differently at ${moved}, every one with roof over its whole square (${movedOff} elsewhere), none newly open (${newlyOpen}) · half a metre above the ceiling, ${above} points: ${aboveHid} hidden · each roof's middle hidden: ${mid.join(' ')} · the yard hidden: ${yard}`); }

    // ---- tops (every box that tops out at the ceiling: the rule's own 5 cm)
    { let deepOpenOn = 0, deepOpenOff = 0, wrong = 0, n = 0, outer = 0, outerTop = 0, outerDry = 0, outerDryLess = 0, inner = 0;
      for (const b of boxes) { const top = b.c[1] + b.h[1]; if (b.yaw || Math.abs(top - CY) > 0.05) continue; n++;
        // an OUTER wall: a thin box with open sky 0.4 m off one of its long faces (asked of the roofs, not of the rule)
        const thinX = b.h[0] < 0.2 && b.h[2] > 0.3, thinZ = b.h[2] < 0.2 && b.h[0] > 0.3; let sky = false;
        if (thinX) for (let z = b.c[2] - b.h[2] + 0.1; z < b.c[2] + b.h[2]; z += 0.1) sky ||= !roofed(b.c[0] - b.h[0] - 0.4, z) || !roofed(b.c[0] + b.h[0] + 0.4, z);
        if (thinZ) for (let x = b.c[0] - b.h[0] + 0.1; x < b.c[0] + b.h[0]; x += 0.1) sky ||= !roofed(x, b.c[2] - b.h[2] - 0.4) || !roofed(x, b.c[2] + b.h[2] + 0.4);
        if (sky) outer++; else if (thinX || thinZ) inner++;
        for (let z = b.c[2] - b.h[2] + ST / 2; z < b.c[2] + b.h[2]; z += ST) for (let x = b.c[0] - b.h[0] + ST / 2; x < b.c[0] + b.h[0]; x += ST) { if (!roofed(x, z)) continue;
          const a = hid(x, top, z, on), deep = whole(x, z, FLAKE_TOP_IN);
          if (a !== deep) wrong++;
          if (deep) { if (!a) deepOpenOn += A2; if (!hid(x, top, z, false)) deepOpenOff += A2; }
          if (sky) { outerTop += A2; if (a) outerDry += A2; if (on && flakeHiddenUnder(roofs, x, top, z, CY, FLAKE_WALL_IN, FLAKE_TOP_IN - 0.05)) outerDryLess += A2; } } }
      verdict(n >= 20 && outer >= 8 && inner >= 3 && deepOpenOn < 0.01 && deepOpenOff > 1 && wrong === 0 && outerTop > 10 && outerDry < 0.005 && outerDryLess < 0.005 && FLAKE_TOP_IN > FLAKE_WALL_IN,
        'tops — a partition\'s top deep inside a building is under the roof; the whole top of every wall with open sky beside it still takes the snow',
        `${n} boxes of the pass top out at the ceiling: ${outer} walls with open sky 0.4 m off a long face, ${inner} walls with none · top with roof over every point ${FLAKE_TOP_IN} m about it, and open to snow: ${deepOpenOn.toFixed(2)} m² (off: ${deepOpenOff.toFixed(2)} m²) · the outer walls' tops, ${outerTop.toFixed(1)} m²: ${outerDry.toFixed(2)} m² hidden (with the number 5 cm less: ${outerDryLess.toFixed(2)}) · the rule's five points against the whole square: ${wrong} differ`); }

    // ---- text
    { const com = readFileSync(resolve(ROOT, 'src/render/shaders/particles_common.wgsl'), 'utf8');
      const num = Number(/const FLAKE_TOP_IN: f32 = ([0-9.]+);/.exec(com)?.[1]) === FLAKE_TOP_IN && Number(/const FLAKE_WALL_IN: f32 = ([0-9.]+);/.exec(com)?.[1]) === FLAKE_WALL_IN;
      const under = /fn flakeUnder\(p: vec2f, d: f32\) -> bool \{ return wxRoofed\(p\) && wxRoofed\(p \+ vec2f\(d, d\)\) && wxRoofed\(p \+ vec2f\(-d, d\)\) && wxRoofed\(p \+ vec2f\(d, -d\)\) && wxRoofed\(p - vec2f\(d, d\)\); \}/.test(com);
      const rule = /\n  if \(SNOW_UNDER\) \{ if \(P\.y > CEIL_Y \+ 0\.05 \|\| !flakeUnder\(q, FLAKE_WALL_IN\)\) \{ return false; \} return P\.y <= CEIL_Y - 0\.05 \|\| flakeUnder\(q, FLAKE_TOP_IN\); \}\n/.test(com);
      // the old path, whole, right after the new branch (git show of the build before this switch: these four lines, to the letter)
      const old = com.includes(`); }\n  if (P.y > CEIL_Y - 0.05) { return false; }\n  var r = flakeRectIn(frame.weatherC, q) || flakeRectIn(frame.weatherD, q);\n  if (WX_KINDS) { if (frame.cardCfg.y != 0u) { r = r || flakeRectIn(wxRect(frame.cardCfg.y), q) || flakeRectIn(wxRect(frame.cardCfg.z), q); } }\n  return r;\n}\n`)
        && /fn flakeRectIn\(R: vec4f, p: vec2f\) -> bool \{ return p\.x >= R\.x \+ FLAKE_WALL_IN && p\.y >= R\.y \+ FLAKE_WALL_IN && p\.x <= R\.z - FLAKE_WALL_IN && p\.y <= R\.w - FLAKE_WALL_IN; \}/.test(com);
      verdict(num && under && rule && old, 'text — the shader carries the rule and the CPU\'s two numbers, ahead of the old lines, which stand whole for the switch off',
        `FLAKE_WALL_IN ${FLAKE_WALL_IN} and FLAKE_TOP_IN ${FLAKE_TOP_IN} in the shader: ${num} · flakeUnder asks the roofs as one, the point and four corners: ${under} · flakeHidden takes the SNOW_UNDER branch first, with the ceiling's plane as its upper bound: ${rule} · the old rule after it, every line: ${old}`); }
  } finally {
    SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); Object.assign(snowLookConfig, was.cfg);
    ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; });
  }
  console.log(`\nsnowunder-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWUNDER_BREAK=1: the switch never reaches the prelude — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowUnderCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
