// FRESH SNOW SPARKLES UNDER A LAMP, AND ONLY THE PICTURE KNOWS (src/game/weatherKinds.ts SNOW_LOOK.sparkle → render/frame.ts snowLookConfig.sparkle → the scene
// prelude's `const SNOW_SPARKLE`; the term is src/render/shaders/composite.wgsl snowSparkleFacet / snowSparkleLobe, walked in snowGlow's light loop; a snow pixel
// is marked in the normal target's alpha by gbuffer.wgsl fsBox and snow.wgsl fsSnow, the mark the glow reads).
//
// The maintainer, 10-14, with a still of Red Dead Redemption 2: 'rdr2 has some nice "sparkle" on the snow on the ground' — and, of the snow's whole look,
// "overall this should be subtle". Ice facets are tiny mirrors: a sparse set of grains, anchored in the world, each flashes while its own normal is the half
// vector between a lamp and the eye.
//
//   bun run tools/qa/snowsparkle-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWSPARKLE_BREAK=1 …   = the stand's word never raises the switch, and the shader text is read with its `if (SNOW_SPARKLE)` guards cut out and the term
//                             called from evalLight (what a careless edit would do): must fail
//   bun run tools/qa/probes.ts snowsparkle      (also under `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's).
//
// The harness has no GPU: not one sparkle is drawn here. What is proven is where the term stands, what cannot reach it, and what its own numbers make of it.
//   stands    the switch's words: ON in the page (?snowsparkle=0 off), OFF on the frozen stand (TPS_SNOWSPARKLE=1 raises it), a FROZEN_HOLDS row, in the
//             registry's table; the prelude's word follows render/frame.ts snowLookConfig.sparkle and nothing else
//   mark      the snow mark is written under either switch (the glow's or this one) and read on the glow's one line; the term is × the mark, never on a man's
//             pixel, and × a band round fresh snow's roughness: a boot print (matt) and a trodden path (tighter) are outside it, by snowField.ts's own numbers
//   dead      every statement that names the term stands, whole, on a line that opens `if (SNOW_SPARKLE) {`; with both snow switches off the loop is not called
//   meter     the meter's, the probes' and the bounce's programs do not name the term: it is in composite.wgsl alone; no game module reads the switch
//   fog       the fog of war draws over the composite's output after it; the flash is scored in the glow's loop behind lightReaches and evalLight as they
//             stand, on the lit side only, × the stencil's shadow ratio per class; it traces nothing; it is added once, as light
//   energy    by the shader's own numbers: the brightest point one lamp can make, and the mean light the term adds to a patch of snow — a fraction of a
//             percent of the snow's own
//   view      the shader's grains and lobe mirrored here over a patch of flat snow under one lamp: a sparse set flashes; half a metre of camera travel puts
//             some out and lights others, three metres nearly all; a grain is no finer than PX pixels at any distance, and a point is a pixel wide so no
//             sub-pixel jitter can miss it
//   digest    the game does not know: 300 stepped frames of the pass, switch on and off — one game digest
//   old       a recording from before the key replays with it off (journal.ts applyKnobs)
import { standUp, ROOT } from './headless.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowSparkleCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const FR = await import(`${ROOT}/src/render/frame.ts`);
  const PR = await import(`${ROOT}/src/host/profile.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const KN = await import(`${ROOT}/src/game/knobs.ts`);
  const { SNOW_SURF } = await import(`${ROOT}/src/render/snowField.ts`);
  const BREAK = process.env.SNOWSPARKLE_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWSPARKLE'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, env: ENV.map(k => process.env[k]), cfg: { ...FR.snowLookConfig } };

  /** a game stood up on the pass in snow with its surface, the sparkle's switch where `on` says by the stand's own word (null = the word not said: the stand's
   *  own answer) — the module's switch left the WRONG way round first, so only the stand can put it right */
  async function rig(on: boolean | null) {
    const sw = on === null ? null : on && !BREAK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; if (sw === null) delete process.env.TPS_SNOWSPARKLE; else process.env.TPS_SNOWSPARKLE = sw ? '1' : '0';
    const expect = sw ?? (PR.harnessProfile() === 'shipped'); SNOW_LOOK.sparkle = !expect;
    if (sw === null && PR.harnessProfile() === 'shipped') PR.shippedBoot();   // (the word not said on the page's stand: nothing in standUp writes the switch — the stand's own boot does, as it did when this process began)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = SNOW_LOOK.sparkle;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { SNOW_LOOK.sparkle = stood; W.step(DT); } };
    return { W, g, step, stood };
  }

  // ---- the shader text, as the build has it — or, under the break word, as a careless edit would leave it: the guards cut out, the term called from evalLight
  const SH = resolve(ROOT, 'src/render/shaders');
  const files = readdirSync(SH).filter(f => f.endsWith('.wgsl')).sort();
  const text: Record<string, string> = {};
  const CARELESS = ['  r.E = li.color * (att * c); r.ok = true;\n', '  r.E = li.color * (att * c) * (1.0 + snowSparkleLobe(N, L, N) * SNOW_SPARKLE_GAIN); r.ok = true;\n'] as const;
  for (const f of files) {
    let t = readFileSync(resolve(SH, f), 'utf8');
    if (BREAK) { t = t.replace(/if \(SNOW_SPARKLE\) \{/g, '{'); if (f === 'common.wgsl') t = t.replace(CARELESS[0], CARELESS[1]); }
    text[f] = t;
  }
  const code = (line: string) => line.replace(/\/\/.*$/, '');
  const codeOf = (f: string) => text[f].split('\n').map(code).join('\n');
  const TERM = /\bsnowSparkle\w*\b|\bSNOW_SPARKLE_[A-Z0-9]+\b|\bsparkle\b/;   // a call of the term, its hand-over, one of its numbers, or the pixel's sum (the switch itself is SNOW_SPARKLE, no underscore after)
  const OWN = /^fn snowSparkle\w*\(|^const SNOW_SPARKLE_[A-Z0-9]+\b|^var<private> snowSparkleL: vec3f;/;
  const comp = text['composite.wgsl'], compCode = codeOf('composite.wgsl');
  const num = (n: string) => { const m = comp.match(new RegExp(`^const SNOW_SPARKLE_${n}: f32 = ([0-9.]+);`, 'm')); return m ? +m[1] : NaN; };
  const vec = (n: string, k: number) => { const m = comp.match(new RegExp(`^const SNOW_SPARKLE_${n}: vec${k}f = vec${k}f\\(([0-9., ]+)\\);`, 'm')); return m ? m[1].split(',').map(Number) : Array(k).fill(NaN); };
  const GRAIN = num('GRAIN'), PX = num('PX'), SHARE = num('SHARE'), CORE = num('CORE'), SPREAD = num('SPREAD'), COS0 = num('COS0'), COS1 = num('COS1'), GAIN = num('GAIN'), WHITEN = num('WHITEN'), BROAD = num('BROAD'), EDGE = num('EDGE'), FAR = vec('FAR', 2), ROUGH = vec('ROUGH', 4);
  const ss = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  try {
    // ---- stands
    { const up = await rig(true), down = await rig(false), unsaid = await rig(null);
      const prof = PR.harnessProfile(); const row = String(PR.FROZEN_HOLDS['SNOW_LOOK.sparkle'] ?? '');
      const page = /SNOW_LOOK\.sparkle = q\.get\('snowsparkle'\) !== '0';/.test(readFileSync(resolve(ROOT, 'src/host/profile.ts'), 'utf8'));   // (read, not run: pageSwitches writes every switch the page has)
      const mod = /export const SNOW_LOOK = \{[^}]*\bsparkle: false\b[^}]*\}/.test(readFileSync(resolve(ROOT, 'src/game/weatherKinds.ts'), 'utf8'));
      const reg = !!KN.JOURNAL_KNOBS && (KN.JOURNAL_KNOBS as readonly string[]).includes('SNOW_LOOK');
      const cfgWas = FR.snowLookConfig.sparkle; FR.snowLookConfig.sparkle = false; const p0 = FR.scenePrelude(); FR.snowLookConfig.sparkle = true; const p1 = FR.scenePrelude(); FR.snowLookConfig.sparkle = cfgWas;
      const word = /const SNOW_SPARKLE: bool = false;/.test(p0) && /const SNOW_SPARKLE: bool = true;/.test(p1) && p0.replace('const SNOW_SPARKLE: bool = false;', '') === p1.replace('const SNOW_SPARKLE: bool = true;', '');
      const boot = /snowLookConfig\.sparkle = SNOW_LOOK\.on && SNOW_LOOK\.sparkle;/.test(readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8'));
      const env = /'TPS_SNOWSPARKLE'/.test(readFileSync(resolve(ROOT, 'src/host/standEnv.ts'), 'utf8'));
      verdict(up.stood === true && down.stood === false && unsaid.stood === (prof === 'shipped') && /TPS_SNOWSPARKLE=1/.test(row) && page && mod && reg && word && boot && env,
        'stands — the switch\'s words on this stand', `${prof} stand · TPS_SNOWSPARKLE=1 → ${up.stood}, =0 → ${down.stood}, not said → ${unsaid.stood} (${prof === 'shipped' ? 'the page: on' : 'frozen: off'}) · FROZEN_HOLDS row: ${row ? `'${row.slice(0, 40)}…'` : 'NONE'} · the page's boot reads ?snowsparkle=0 and is on without it: ${page} · off in the module: ${mod} · its table rides in the journal's registry: ${reg} · the stand's word is a listed name: ${env} · the prelude's word follows snowLookConfig.sparkle and is the only text that differs: ${word} · main.ts raises it only with the surface: ${boot}`); }

    // ---- mark: the snow mark under either switch, the term × it, and only fresh snow
    { const both = /\bSNOW_GLOW \|\| SNOW_SPARKLE\b/g;
      const gb = codeOf('gbuffer.wgsl'), sn = codeOf('snow.wgsl');
      const writers = /if \(SNOW_GLOW \|\| SNOW_SPARKLE\) \{ o\.normal\.a = sb\.amt \* 0\.6667; \}/.test(gb) && /o\.normal = vec4f\(n \* 0\.5 \+ 0\.5, select\(1\.0, 1\.0 - o\.normal\.a, SNOW_GLOW \|\| SNOW_SPARKLE\)\);/.test(gb) && /o\.normal = vec4f\(s\.n \* 0\.5 \+ 0\.5, select\(1\.0, 0\.3333, SNOW_GLOW \|\| SNOW_SPARKLE\)\);/.test(sn);
      const only = (gb.match(/SNOW_SPARKLE/g) ?? []).length === 2 && (gb.match(both) ?? []).length === 2 && (sn.match(/SNOW_SPARKLE/g) ?? []).length === 1 && (sn.match(both) ?? []).length === 1 && !/snowSparkle/.test(gb + sn);
      const lines = compCode.split('\n'); const at = (re: RegExp) => lines.findIndex(l => re.test(l));
      const iOpen = at(/^    if \(SNOW_GLOW \|\| SNOW_SPARKLE\) \{\s*$/), iSa = at(/let sa = snowGlowAmt\(textureLoad\(gNormal, sPix, 0\)\.a\);/), iMen = at(/if \(sa > 0\.0 && \(\(id >> 28u\) & 3u\) == 0u\) \{/);
      const iSp = at(/^        if \(SNOW_SPARKLE\) \{ sparkle = snowSparkleL \* \(sa \* snowSparkleFresh\(textureLoad\(gMat, sPix, 0\)\.x\)\); \}\s*$/);
      const order = iOpen > 0 && iSa === iOpen + 1 && iMen === iSa + 1 && iSp > iMen && iSp <= iMen + 3;
      const freshFn = /fn snowSparkleFresh\(rough: f32\) -> f32 \{ return smoothstep\(SNOW_SPARKLE_ROUGH\.x, SNOW_SPARKLE_ROUGH\.y, rough\) \* \(1\.0 - smoothstep\(SNOW_SPARKLE_ROUGH\.z, SNOW_SPARKLE_ROUGH\.w, rough\)\); \}/.test(comp);
      const fresh = (r: number) => ss(ROUGH[0], ROUGH[1], r) * (1 - ss(ROUGH[2], ROUGH[3], r));
      const roughLine = /var rough = mix\(mix\(snowCfg\.p\[7\]\.w, snowCfg\.p\[7\]\.w - 0\.14, f\.z\), 1\.0, trod\);/.test(text['snow.wgsl']) && /o\.set\(\[f\.paint\[0\], f\.paint\[1\], f\.paint\[2\], S\.rough\], 28\);/.test(readFileSync(resolve(ROOT, 'src/render/snowField.ts'), 'utf8'));
      const R = SNOW_SURF.rough as number, q8 = (r: number) => Math.round(r * 255) / 255;   // (the material target may hold a byte)
      const fFresh = Math.min(fresh(R), fresh(q8(R))), fPrint = Math.max(fresh(1), fresh(q8(1))), fPath = Math.max(fresh(R - 0.14), fresh(q8(R - 0.14))), fHalf = fresh((R + 1) / 2), fGlint = fresh(SNOW_SURF.sparkleRough as number);
      verdict(writers && only && order && freshFn && roughLine && fFresh === 1 && fPrint === 0 && fPath === 0 && fGlint === 0 && fHalf < 0.7,
        'mark — on snow pixels alone, × how much snow, and only where it lies fresh', `fsBox and fsSnow write the mark under SNOW_GLOW || SNOW_SPARKLE: ${writers}, and name this switch nowhere else: ${only} · composite.wgsl reads it on the glow's one line and the term is × it inside the never-a-man's-pixel block: ${order} · the fresh band as written: ${freshFn}, over the roughness snow.wgsl writes (fresh, −0.14 trodden, → 1 in a print): ${roughLine} · the band at fresh snow's ${R}: ${fFresh} · in a boot print (1.0): ${fPrint} · halfway into one: ${fHalf.toFixed(2)} · on a trodden path (${(R - 0.14).toFixed(2)}): ${fPath} · on one of snow.wgsl's old glint grains (${SNOW_SURF.sparkleRough}): ${fGlint}`); }

    // ---- dead: every line that names the term (outside its own functions and numbers) is one whole `if (SNOW_SPARKLE) { … }` statement
    { const bad: string[] = []; let uses = 0;
      const balanced = (c: string) => { let d = 0; for (const ch of c) { if (ch === '{') d++; else if (ch === '}') { d--; if (d < 0) return false; } } return d === 0; };
      for (const f of files) { let inOwn = false;
        text[f].split('\n').forEach((line, i) => {
          if (/^fn /.test(line)) inOwn = /^fn snowSparkle\w*\(/.test(line);
          else if (/^\}/.test(line)) { inOwn = false; return; }
          if (OWN.test(line) || inOwn) return;
          const c = code(line);
          if (/^\s*var sparkle = vec3f\(0\.0\);\s*$/.test(c)) return;   // (the pixel's sum, declared zero: every other line that touches it is counted below)
          if (/^\s*(\/\*\*|\*[ \/])/.test(line)) return;   // (a block comment's line)
          if (!TERM.test(c)) return;
          uses++; if (!(/^\s*if \(SNOW_SPARKLE\) \{/.test(c) && balanced(c))) bad.push(`${f}:${i + 1}`);
        }); }
      const defs = files.filter(f => /^fn snowSparkle\w*\(/m.test(text[f]));
      const fn = comp.slice(comp.indexOf('fn snowGlow('), comp.indexOf('\n}\n', comp.indexOf('fn snowGlow(')));
      const calledUnder = /^    if \(SNOW_GLOW \|\| SNOW_SPARKLE\) \{\s*$/m.test(compCode) && (compCode.match(/\bsnowGlow\(/g) ?? []).length === 2;   // (its definition and its one call, inside that block)
      const glowAsWas = /^    if \(!SNOW_GLOW\) \{ continue; \}/m.test(fn) && /^        if \(SNOW_GLOW\) \{ let lE = luminance\(Ed\); let lI = luminance\(Ei\); dif \+= albedo \* \(glow \+ Ei \* \(SNOW_GLOW_SHADE - vec3f\(1\.0\)\) \* \(lI \/ max\(lE \+ lI, 1e-5\)\)\) \* \(sa \/ PI\); \}/m.test(comp);
      const quick = /if \(SNOW_SPARKLE\) \{ snowSparkleL = vec3f\(0\.0\); fac = snowSparkleFacet\(P, N, z\); if \(!SNOW_GLOW && fac\.w <= 0\.0\) \{ return vec3f\(0\.0\); \} \}/.test(fn);
      verdict(bad.length === 0 && uses >= 5 && defs.length === 1 && defs[0] === 'composite.wgsl' && calledUnder && glowAsWas && quick,
        'dead — every sparkle statement in the shaders stands behind SNOW_SPARKLE', bad.length ? `not one whole guarded statement: ${bad.join(', ')}` : `${uses} lines name the term outside its own functions and numbers, each one whole \`if (SNOW_SPARKLE) { … }\` statement · the term is defined in ${defs.join(', ') || 'NO FILE'} · the light loop is called only under SNOW_GLOW || SNOW_SPARKLE (both off: not at all): ${calledUnder} · with the glow off the loop adds none of the glow's terms and the pixel's diffuse is as it was: ${glowAsWas} · the sparkle alone leaves a pixel with no facet before the stencil is read: ${quick}`); }

    // ---- meter
    { const named = files.filter(f => /\bsnowSparkle\w*\b|\bSNOW_SPARKLE/.test(codeOf(f)));
      const cfgWas = FR.snowLookConfig.sparkle; FR.snowLookConfig.sparkle = true; let prelude = FR.scenePrelude(); FR.snowLookConfig.sparkle = cfgWas;
      if (BREAK) prelude = prelude.replace(CARELESS[0], CARELESS[1]);
      const probeProg = (prelude + text['lighting_common.wgsl'] + text['probe.wgsl']).split('\n').map(code).join('\n');
      const inProbe = (probeProg.match(/\bsnowSparkle\w*\b|\bSNOW_SPARKLE\w*/g) ?? []).filter(w => w !== 'SNOW_SPARKLE');
      const decl = (probeProg.match(/\bSNOW_SPARKLE\b/g) ?? []).length;   // the prelude's one declaration
      const probeTs = readFileSync(resolve(ROOT, 'src/render/probe.ts'), 'utf8'); const built = /makeShader\(device, scenePrelude\(\) \+ lightingCommon \+ probeSrc, 'probe'\)/.test(probeTs) && !/composite/.test(probeTs);
      const body = (src: string, name: string) => { const a = src.indexOf(`fn ${name}(`); if (a < 0) return null; const b = src.indexOf('\n}\n', a); return src.slice(a, b < 0 ? undefined : b); };
      const fns = [['common.wgsl', 'evalLight'], ['common.wgsl', 'evalLightRaw'], ['common.wgsl', 'directIrradiance'], ['lighting_common.wgsl', 'hitRadiance'], ['lighting_common.wgsl', 'diceIrradiance']] as const;
      const dirty = fns.filter(([f, n]) => { const b = body(text[f], n); return b === null || /snow/i.test(b.split('\n').map(code).join('\n')); }).map(([f, n]) => `${f} ${n}`);
      const srcTs: string[] = []; const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(resolve(d, e.name)); else if (e.name.endsWith('.ts')) srcTs.push(resolve(d, e.name)); } }; walk(resolve(ROOT, 'src'));
      const rd = (re: RegExp, raw = false) => srcTs.filter(p => { const t = readFileSync(p, 'utf8'); return re.test(raw ? t : t.split('\n').map(code).join('\n')); }).map(p => p.slice(ROOT.length + 5)).sort();
      const swReaders = rd(/SNOW_LOOK\.sparkle\b/), cfgReaders = rd(/snowLookConfig\.sparkle\b/, true), wordTs = rd(/\bSNOW_SPARKLE\b/, true);   // (the last two as written, comments and all: the prelude's line is a template with `//` inside it)
      const game = swReaders.filter(p => p.startsWith('game/') && p !== 'game/journal.ts');
      const want = ['composite.wgsl', 'gbuffer.wgsl', 'snow.wgsl'];
      verdict(named.join() === want.join() && inProbe.length === 0 && decl === 1 && built && dirty.length === 0 && game.length === 0 && cfgReaders.join() === ['main.ts', 'render/frame.ts'].join() && wordTs.join() === 'render/frame.ts',
        'meter — the meter\'s, the probes\' and the bounce\'s programs do not hold the term', `shaders that name the switch or the term: ${named.join(', ')} (want ${want.join(', ')}: the two g-buffer files only mark the pixel) · the probe's program is the prelude + lighting_common.wgsl + probe.wgsl and nothing of composite.wgsl: ${built}; in it the term is named ${inProbe.length} times and the switch ${decl} (its declaration) · evalLight, evalLightRaw, directIrradiance, hitRadiance, diceIrradiance ${dirty.length ? `NAME SNOW: ${dirty.join(', ')}` : 'do not name snow'} · SNOW_LOOK.sparkle is read in ${swReaders.join(', ')}${game.length ? ` — A GAME MODULE: ${game.join(', ')}` : ' (in src/game the journal\'s rule alone)'} · snowLookConfig.sparkle in ${cfgReaders.join(', ')}`); }

    // ---- fog
    { const passes = readFileSync(resolve(ROOT, 'src/render/passes.ts'), 'utf8');
      const iComp = passes.indexOf(`beginRenderPass({ label: 'composite'`), iFog = passes.indexOf('new FogPass(this.device, this.sceneLayout)).encode(enc, this.fogFrame');
      const fogKnows = /snowSparkle|SNOW_SPARKLE/.test(codeOf('fogofwar.wgsl'));
      const a = comp.indexOf('fn snowGlow('); const fn = comp.slice(a, comp.indexOf('\n}\n', a));
      const iReach = fn.search(/if \(!lightReaches\(i, P\)\) \{ continue; \}\s*\n\s*let li = lights\[i\];\s*\n\s*let ev = evalLight\(li, P, vec3f\(0\.0\)\);\s*(?:\/\/[^\n]*)?\n\s*if \(!ev\.ok\) \{ continue; \}/);
      const flash = 'if (SNOW_SPARKLE) { if (fac.w > 0.0 && c > 0.0) { let k = mix(ev.E, vec3f(w), SNOW_SPARKLE_WHITEN) * (snowSparkleLobe(fac.xyz, ev.L, V) * smoothstep(0.0, SNOW_SPARKLE_EDGE, c)); if (broad) { kB += k * SNOW_SPARKLE_BROAD; } else { kS += k; } } }';
      const iFlash = fn.indexOf(flash), iOut = fn.indexOf('if (SNOW_SPARKLE) { snowSparkleL = (kS * vis.x + kB * vis.y) * (fac.w * SNOW_SPARKLE_GAIN); }'), iVis = fn.search(/let vis = clamp\(S \/ max\(U, vec2f\(1e-4\)\), vec2f\(0\.0\), vec2f\(1\.0\)\) \*/), iShade = fn.indexOf('if (S.x <= 0.0 && S.y <= 0.0) { return vec3f(0.0); }'), iZero = fn.indexOf('snowSparkleL = vec3f(0.0);');
      const inLoop = iReach > 0 && iFlash > iReach && iVis > iFlash && iOut > iVis && iZero > 0 && iZero < iShade && iShade < iReach;
      const writes = (compCode.match(/\bsnowSparkleL =/g) ?? []).length, sums = (compCode.match(/\bk[SB] \+=/g) ?? []).length;
      const own = ['snowSparkleFacet', 'snowSparkleLobe', 'snowSparkleFresh', 'snowSparkleHash'].map(n => { const s = comp.indexOf(`fn ${n}(`); return s < 0 ? 'occluded' : comp.slice(s, comp.indexOf('\n', comp.indexOf('{', s)) < 0 ? undefined : (comp.indexOf('\n}\n', s) < 0 ? undefined : comp.indexOf('\n}\n', s))); }).join('\n');
      const noRay = !/occluded|shadowSample|traceRay|trace\(|textureLoad|textureSample|lights\[/.test(own.split('\n').map(code).join('\n'));
      const added = (compCode.match(/if \(SNOW_SPARKLE\) \{ spec \+= sparkle; color \+= sparkle \* glassT; \}/g) ?? []).length, touched = (compCode.match(/\bsparkle\b/g) ?? []).length;
      verdict(iComp > 0 && iFog > iComp && !fogKnows && inLoop && writes === 2 && sums === 2 && noRay && added === 1 && touched === 4,
        'fog — the flash is under the fog of war, under the reach masks and evalLight, and under the direct pass\'s own shadows', `passes.ts encodes the fog of war's pass over hdr AFTER the composite: ${iComp > 0 && iFog > iComp} · fogofwar.wgsl names the term: ${fogKnows} · the flash is scored in snowGlow's loop after lightReaches and evalLight as they stand, on the lit side only (c > 0), and leaves × the stencil's shadow ratio per class; a stencil in full shade leaves it zero: ${inLoop} · the hand-over is written in ${writes} places (zeroed, then the sum) and the sums in ${sums} · the term's own functions read no texture, no light and trace nothing: ${noRay} · added to the pixel in ${added} place, as light (never × the albedo), and the pixel's sum is touched on ${touched} lines`); }

    // ---- energy and view: the shader's formulas (asserted as text), mirrored
    const hashLine = 'fn snowSparkleHash(p: vec2i, salt: u32) -> f32 { var h = (u32(p.x + 32768) * 73856093u) ^ (u32(p.y + 32768) * 19349663u) ^ (salt * 0x9E3779B9u); h = h * 747796405u + 2891336453u; h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u; return f32(((h >> 22u) ^ h) & 0xffffu) * (1.0 / 65536.0); }';
    const form = comp.includes(hashLine)
      && comp.includes('let fp = z * 2.0 * frame.post.w * frame.invScreen.y;')
      && comp.includes('let oct = ceil(log2(max(SNOW_SPARKLE_PX * fp, SNOW_SPARKLE_GRAIN) / SNOW_SPARKLE_GRAIN));')
      && comp.includes('let g = SNOW_SPARKLE_GRAIN * exp2(oct); let q = P.xz / g; let c0 = vec2i(floor(q)); let salt = 41u + u32(oct + 0.5);')
      && comp.includes('let cj = c0 + vec2i(j % 3, j / 3) - 1;')
      && comp.includes('if (snowSparkleHash(cj, salt) >= SNOW_SPARKLE_SHARE) { continue; }')
      && comp.includes('let w = clamp(SNOW_SPARKLE_CORE + 1.0 - length(q - (vec2f(cj) + vec2f(snowSparkleHash(cj, salt + 7u), snowSparkleHash(cj, salt + 13u)))) * (g / max(fp, 1e-6)), 0.0, 1.0);')
      && comp.includes('if (w > dot1) { dot1 = w; ci = cj; }')
      && comp.includes('let h = vec2f(snowSparkleHash(ci, salt + 19u), snowSparkleHash(ci, salt + 29u));')
      && comp.includes('let a = 6.2831853 * h.x; let lean = SNOW_SPARKLE_SPREAD * sqrt(h.y);')
      && comp.includes('let bright = snowSparkleHash(ci, salt + 37u);')
      && comp.includes('return vec4f(normalize(N + (T * cos(a) + B * sin(a)) * lean), dot1 * mix(0.25, 1.0, bright * bright) * far);')
      && comp.includes('return smoothstep(SNOW_SPARKLE_COS0, SNOW_SPARKLE_COS1, dot(Nf, hv * inverseSqrt(h2))) * max(dot(Nf, L), 0.0);');
    const hash = (x: number, y: number, salt: number) => { let h = (Math.imul((x + 32768) >>> 0, 73856093) ^ Math.imul((y + 32768) >>> 0, 19349663) ^ Math.imul(salt >>> 0, 0x9E3779B9)) >>> 0; h = (Math.imul(h, 747796405) + 2891336453) >>> 0; h = Math.imul(((h >>> ((h >>> 28) + 4)) ^ h) >>> 0, 277803737) >>> 0; return (((h >>> 22) ^ h) & 0xffff) / 65536; };
    const octOf = (fp: number) => Math.ceil(Math.log2(Math.max(PX * fp, GRAIN) / GRAIN));
    type V3 = [number, number, number]; const nrm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }; const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    /** the flash of the grain in cell (cx, cz) of flat snow (N up; the shader's T = (0,0,1), B = (1,0,0) there) at its point's place, lamp at `lamp`, eye at `eye`:
     *  the shader's facet × lobe × the lit side's ease, before GAIN (0 = no facet in the cell, or it does not face the mirror line) */
    const flashOf = (cx: number, cz: number, oct: number, g: number, lamp: V3, eye: V3) => {
      const salt = 41 + oct; if (hash(cx, cz, salt) >= SHARE) return 0;
      const h = [hash(cx, cz, salt + 7), hash(cx, cz, salt + 13), hash(cx, cz, salt + 19), hash(cx, cz, salt + 29)];
      const px = (cx + h[0]) * g, pz = (cz + h[1]) * g;
      const a = 6.2831853 * h[2], lean = SPREAD * Math.sqrt(h[3]); const b = hash(cx, cz, salt + 37);
      const Nf = nrm([Math.sin(a) * lean, 1, Math.cos(a) * lean]);
      const L = nrm([lamp[0] - px, lamp[1], lamp[2] - pz]), V = nrm([eye[0] - px, eye[1], eye[2] - pz]); const H = nrm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);
      return ss(COS0, COS1, dot(Nf, H)) * Math.max(dot(Nf, L), 0) * (0.25 + 0.75 * b * b) * ss(0, EDGE, L[1]);
    };
    let pointPx = 0; { const n = 4000, R = CORE + 1; for (let i = 0; i < n; i++) { const d = (i + 0.5) / n * R; pointPx += Math.min(1, R - d) * 2 * Math.PI * d * R / n; } }   // ∫ a point's weight over the screen, in pixels² (full within CORE, gone a pixel further out)
    // a patch of flat fresh snow 6 m square, a bare lamp 3 m up over one edge, the follow camera 9 m off at the page's pitch (62° down), 1080 lines of a 35° view
    const fp = 9 * 2 * Math.tan(17.5 * Math.PI / 180) / 1080, oct = octOf(fp), g = GRAIN * 2 ** oct, n = Math.round(6 / g);
    const dotArea = pointPx * (fp / g) ** 2;   // … as a share of its cell there
    const lamp: V3 = [0, 3, 3], eyeAt = (dx: number): V3 => [3 + dx, 9 * Math.sin(1.08), 3 + 9 * Math.cos(1.08)];
    const run = (eye: V3) => { const on = new Set<number>(); let sum = 0, lit = 0, top = 0;
      for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) { const f = flashOf(cx, cz, oct, g, lamp, eye); const px = (cx + 0.5) * g, pz = (cz + 0.5) * g; lit += 3 / Math.hypot(px - lamp[0], 3, pz - lamp[2]);   // (the snow's own N·L there)
        if (f > 0) { sum += f; top = Math.max(top, f); if (f > 0.05) on.add(cz * n + cx); } }
      return { on, mean: sum / (n * n) * dotArea, litMean: lit / (n * n), top }; };
    const A = run(eyeAt(0)), B = run(eyeAt(0.5)), C = run(eyeAt(3));
    const both = (x: Set<number>, y: Set<number>) => { let k = 0; for (const v of x) if (y.has(v)) k++; return k; };
    const alb = 0.2126 * SNOW_SURF.fresh[0] + 0.7152 * SNOW_SURF.fresh[1] + 0.0722 * SNOW_SURF.fresh[2];

    { const peak = GAIN * Math.PI / alb;                         // a full facet on its mirror line ∕ snow square under the same lamp (albedo ∕ π × its light)
      const meanShare = GAIN * A.mean / (alb / Math.PI * A.litMean);   // the term's mean over the patch ∕ the snow's own diffuse light over it
      const lobeDeg = [Math.acos(COS0) * 180 / Math.PI, Math.acos(COS1) * 180 / Math.PI];
      const ok = form && GAIN > 0 && GAIN <= 2 && peak <= 8 && meanShare > 0 && meanShare < 0.01 && WHITEN >= 0 && WHITEN <= 1 && BROAD > 0 && BROAD <= 1 && EDGE > 0 && EDGE <= 0.3
        && COS1 > COS0 && COS1 < 1 && lobeDeg[0] <= 6 && lobeDeg[1] >= 1 && SHARE > 0 && SHARE <= 1 && CORE >= 0 && CORE <= 0.5 && SPREAD >= 0.3 && SPREAD <= 1 && FAR[1] > FAR[0] && FAR[0] >= 12;
      verdict(ok, 'energy — a point is a few times the snow beside it at most, and the whole term a fraction of a percent of the snow\'s light',
        `GRAIN ${GRAIN} m PX ${PX} SHARE ${SHARE} CORE ${CORE} px SPREAD ${SPREAD} (${(Math.atan(SPREAD) * 180 / Math.PI).toFixed(0)}°) lobe ${lobeDeg[1].toFixed(1)}°‥${lobeDeg[0].toFixed(1)}° GAIN ${GAIN} WHITEN ${WHITEN} BROAD ${BROAD} EDGE ${EDGE} FAR ${FAR.join('‥')} m · the shader's grain, facet and lobe formulas as written: ${form} · every factor of a flash but GAIN is ≤ 1 (the lobe, the facet's cosine, the point's footprint, the grain's own brightness, the mark, the fresh band, the shadow ratio), so one lamp's brightest point is GAIN × its square-on light = ${peak.toFixed(1)} × fresh snow square under it (albedo ${alb.toFixed(2)}) · over a 6 m patch under a lamp 3 m up, seen from 9 m: the term's mean is ${(meanShare * 100).toFixed(3)} % of the snow's own light there (the brightest grain on the patch ${(GAIN * A.top * Math.PI / alb).toFixed(1)} × snow square under the lamp)`); }

    // ---- view
    { const cells = n * n, shareOn = A.on.size / cells, keepHalf = both(A.on, B.on) / Math.max(A.on.size, 1), keep3 = both(A.on, C.on) / Math.max(A.on.size, 1);
      let pxMin = Infinity, pxMax = 0; for (let e = -3; e <= 0; e += 0.01) { const f = 10 ** e; const px = GRAIN * 2 ** octOf(f) / f; if (PX * f >= GRAIN) { pxMin = Math.min(pxMin, px); pxMax = Math.max(pxMax, px); } }
      const least = Math.min(1, CORE + 1 - Math.SQRT1_2);   // what the nearest sample takes of a point wherever the jitter falls (never further than half a pixel's diagonal)
      const nine = comp.includes('for (var j = 0; j < 9; j++) {') && (CORE + 1) / PX <= 1;   // a point reaches CORE + 1 px = under one cell: the nine cells round a pixel hold every point that reaches it
      const ok = form && A.on.size > 20 && B.on.size > 20 && shareOn < 0.01 && shareOn * dotArea < 0.004 && keepHalf > 0.05 && keepHalf < 0.85 && keep3 < 0.25 && both(A.on, B.on) < Math.min(A.on.size, B.on.size)
        && pxMin >= PX - 1e-6 && pxMax < 2 * PX + 1e-6 && PX >= 1.5 && least > 0.5 && nine && 2 * (CORE + 1) <= 3;
      verdict(ok, 'view — a sparse set of grains flashes, and it changes as the eye moves',
        `the shader's grains mirrored over ${n}×${n} cells of ${(g * 1000).toFixed(0)} mm (6 m of flat fresh snow, a lamp 3 m up, the eye 9 m off, 1080 lines): ${A.on.size} grains flash (${(shareOn * 100).toFixed(2)} % of the cells; their points weigh ${(shareOn * dotArea * 100).toFixed(3)} % of the snow's pixels) · the eye moved 0.5 m: ${B.on.size} flash, ${both(A.on, B.on)} of the first set still among them (${(keepHalf * 100).toFixed(0)} %) · moved 3 m: ${C.on.size} flash, ${both(A.on, C.on)} kept (${(keep3 * 100).toFixed(0)} %) · a cell is ${pxMin.toFixed(2)}‥${pxMax.toFixed(2)} px across at every distance past the finest grain (never under PX ${PX}) · a point is full within ${CORE} px and gone at ${CORE + 1} (${pointPx.toFixed(2)} px² in all), so the sample nearest it takes ${least.toFixed(2)} of it at the least, whatever the jitter, and the nine cells a pixel asks hold every point that reaches it: ${nine}`); }

    // ---- digest: two fresh games of the pass in snow with its surface, the same frames, the switch on and off
    { const D1 = await rig(true), D0 = await rig(false); D1.step(300); D0.step(300);
      const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      const boxes = (g: any) => g.level.boxes.length;
      verdict(h1 === h0 && D1.stood === true && D0.stood === false && boxes(D1.g) === boxes(D0.g) && !!D1.g.snowField && !!D0.g.snowField,
        'digest — the game does not know: one digest with the switch on and off', `300 frames of the pass in snow, its surface on: ${h1} with the sparkle's switch ${D1.stood ? 'on' : 'OFF'}, ${h0} with it ${D0.stood ? 'ON' : 'off'} · ${boxes(D1.g)} and ${boxes(D0.g)} boxes · the snow field stands in both: ${!!D1.g.snowField && !!D0.g.snowField}`); }

    // ---- old
    { const A = await rig(true); A.step(3); let ok = false, how = '';
      try {
        SNOW_LOOK.on = true; SNOW_LOOK.sparkle = true; const k = (J as any).knobsSnapshot(A.g); const had = !!k.tables?.SNOW_LOOK && 'sparkle' in k.tables.SNOW_LOOK && k.tables.SNOW_LOOK.sparkle === true;
        const k1 = JSON.parse(JSON.stringify(k)); delete k1.tables.SNOW_LOOK.sparkle; SNOW_LOOK.sparkle = true; (J as any).applyKnobs(A.g, k1); const noKey = SNOW_LOOK.sparkle, lookKept = SNOW_LOOK.on;
        const k2 = JSON.parse(JSON.stringify(k)); delete k2.tables.SNOW_LOOK; SNOW_LOOK.sparkle = true; (J as any).applyKnobs(A.g, k2); const noTable = SNOW_LOOK.sparkle;
        SNOW_LOOK.sparkle = false; (J as any).applyKnobs(A.g, JSON.parse(JSON.stringify(k))); const back = SNOW_LOOK.sparkle;
        ok = had && noKey === false && lookKept === true && noTable === false && back === true;
        how = `the key rides in a recording, as the game had it: ${had} · a recording with the table but not the key: sparkle ${noKey} after applyKnobs (the surface kept: ${lookKept}) · one with no table: ${noTable} · one with the key: ${back}`;
      } catch (e) { how = `threw: ${(e as Error).message}`; }
      verdict(ok, 'old — a recording from before the key replays with the sparkle off', how); }
  } finally { SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); Object.assign(FR.snowLookConfig, was.cfg); ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; }); }
  console.log(`\nsnowsparkle-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWSPARKLE_BREAK=1: the switch never raised, the shaders read with their guards cut out — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowSparkleCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
