// A SPLASH IS THE SAME SPLASH AT EVERY ZOOM — the check behind the scene prelude's RAIN_SCALE (src/render/frame.ts rainScaleConfig; on, ?norainscale at
// boot = as it was; picture only: no game table, nothing for a recording to carry).
//   bun run tools/qa/probes.ts rainscale        (family `weather`)        RAINSCALE_BREAK=1 = the rule off and the same lines asked: must FAIL
// the maintainer, 10-19, three zooms of one yard in the rain: "the low res rain isn't scale invariant". The ring a landing drop throws up is drawn in the
// volumetric pass (volumetrics.wgsl splashAt), its line never thinner than that pass's texel at the ground: with the camera pulled back the texel is many
// centimetres and each 2 cm ring was a blob that wide at a ring's full brightness.
// WHAT THIS CAN AND CANNOT SAY. No shader runs here. The check lifts the scalar lines of splashAt OUT OF THE SHADER'S OWN TEXT (the ring's radius, the
// factor's block, the returned brightness) and runs them as written, over a floor of 9 cm cells sampled with its own die exactly as the function lays them
// out (one ring a cell, the point asked in the ring's own cell) — so what it measures is the light a square metre of ground gets from its rings as the
// texel at the ground grows. A change to those lines that this file can no longer lift is a red line here, not a silent pass. What the picture looks like is
// the page's to show (tools/qa/weather-look.cjs).
import { readFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
export async function rainScaleCheck(): Promise<boolean> {
  const BRK = process.env.RAINSCALE_BREAK === '1'; let all = true;
  const verdict = (ok: boolean, what: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${detail}`); };
  console.log(`\n=== rainscale: a splash ring keeps its light at every zoom${BRK ? ' (the rule off: must fail)' : ''} ===`);
  const src = readFileSync(`${ROOT}/src/render/shaders/volumetrics.wgsl`, 'utf8');
  const num = (re: RegExp) => { const m = re.exec(src); return m ? Number(m[1]) : NaN; };
  const fn = /fn splashAt\(P: vec3f\) -> f32 \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  const W0 = num(/const SPLASH_W: f32 = ([0-9.]+);/), FILL = num(/const SPLASH_FILL: f32 = ([0-9.]+);/), cs = num(/let cs = ([0-9.]+);/), win = num(/if \(age > ([0-9.]+)\) \{ return 0\.0; \}/);
  const ctr = /let ctr = \(q \+ ([0-9.]+) \+ ([0-9.]+) \* vec2f/.exec(fn), rLine = /let r = ([^;]+);/.exec(fn)?.[1], block = /(var keepE = 1\.0;\s*if \(RAIN_SCALE[^\n]*\})\n/.exec(fn)?.[1], ret = /return (\(1\.0 - smoothstep\(0\.0, w, d\)\)[^;]*);/.exec(fn)?.[1];
  const lifted = [W0, FILL, cs, win].every(Number.isFinite) && !!ctr && !!rLine && !!block && !!ret && /let w = max\(SPLASH_W, /.test(fn) && /let d = abs\(distance\(P\.xz, ctr\) - r\);/.test(fn);
  if (!lifted) { verdict(false, 'the lines of splashAt this check runs are where it looks for them', `SPLASH_W ${W0} · SPLASH_FILL ${FILL} · cell ${cs} · life ${win} · centre ${!!ctr} · radius ${!!rLine} · the factor's block ${!!block} · the return ${!!ret}`); console.log('=== rainscale: FAILURES above ==='); return false; }
  const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the shader's own lines, as written (scalar WGSL of this kind reads as JavaScript: `let`, `var`, `max`, `min`, `sqrt`)
  const radius = new Function('age', `return ${rLine};`) as (age: number) => number;
  const bright = new Function('r', 'w', 'd', 'age', 'RAIN_SCALE', 'SPLASH_W', 'SPLASH_FILL', 'max', 'min', 'sqrt', 'smoothstep', `${block}\nreturn ${ret};`) as (...a: any[]) => number;
  let seed = 0x5eed; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  /** mean brightness over the ground at rain rate 1 with the pass's texel `texel` m wide at the ground (a point is asked of its own cell's ring: age uniform
   *  over the 1 / 1.4 s between landings, the ring's centre and the point as the function lays them) */
  const light = (texel: number, rule: boolean, N = 600000) => { seed = 0x5eed; let acc = 0; const f = 1.4;
    for (let i = 0; i < N; i++) { const age = rnd() / f; if (age > win) continue;
      const cx = (Number(ctr![1]) + Number(ctr![2]) * rnd()) * cs, cz = (Number(ctr![1]) + Number(ctr![2]) * rnd()) * cs, px = rnd() * cs, pz = rnd() * cs;
      const r = radius(age), w = Math.max(W0, texel), d = Math.abs(Math.hypot(px - cx, pz - cz) - r);
      acc += bright(r, w, d, age, rule, W0, FILL, Math.max, Math.min, Math.sqrt, smoothstep); }
    return acc / N; };
  const RULE = !BRK, near = light(W0 * 0.5, false), TEX = [0.009, 0.012, 0.025, 0.05, 0.075, 0.1, 0.2, 0.4];
  // (1) close in nothing changes
  { const a = light(W0 * 0.5, RULE), b = light(W0, RULE), c = light(W0, false);
    verdict(near > 0 && a === near && b === c, 'close in (the texel no wider than the ring\'s own line) the ring is the ring it was, rule on or off',
      `light at half a line's width: ${near.toExponential(3)} without the rule, ${a.toExponential(3)} as asked · at the line's width ${c.toExponential(3)} / ${b.toExponential(3)}`); }
  // (2) pulled back: the light holds
  { const on = TEX.map(t => light(t, RULE) / near), off = TEX.map(t => light(t, false) / near), lo = Math.min(...on), hi = Math.max(...on);
    verdict(lo >= 0.8 && hi <= 1.15 && Math.max(...off) > 10, 'pulled back, a square metre of ground gets the same light from its rings whatever the texel: within a fifth of the close-in light from under a centimetre to 40 cm, where without the rule it grew more than tenfold',
      TEX.map((t, i) => `${(t * 100).toFixed(1)} cm ×${on[i].toFixed(2)} (was ×${off[i].toFixed(1)})`).join(' · ')); }
  // (3) the floor is the measured one
  { const fill = near / light(5, false);
    verdict(Math.abs(fill - FILL) < 0.006, 'SPLASH_FILL is what it says: the light of a ring\'s own line over that of its whole cell lit for the ring\'s life', `measured ${fill.toFixed(4)} · the shader's ${FILL}`); }
  // (4) the switch
  { const F = await import(`${ROOT}/src/render/frame.ts`) as any, was = F.rainScaleConfig.on; let onT = '', offT = '';
    try { F.rainScaleConfig.on = true; onT = F.scenePrelude(); F.rainScaleConfig.on = false; offT = F.scenePrelude(); } finally { F.rainScaleConfig.on = was; }
    const main = readFileSync(`${ROOT}/src/main.ts`, 'utf8');
    verdict(was === true && /const RAIN_SCALE: bool = true;/.test(onT) && /const RAIN_SCALE: bool = false;/.test(offT) && /q\.has\('norainscale'\)\) rainScaleConfig\.on = false;/.test(main) && /RAIN_SCALE && w > SPLASH_W/.test(fn),
      'the prelude carries the constant, on as the page boots, and ?norainscale lowers it before the shaders are built', `on at import ${was} · in the prelude on ${/const RAIN_SCALE: bool = true;/.test(onT)}, off ${/const RAIN_SCALE: bool = false;/.test(offT)} · the page's flag ${/norainscale/.test(main)}`); }
  console.log(`=== rainscale: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
