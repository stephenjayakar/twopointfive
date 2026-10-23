// LAMP LIGHT GLOWS THROUGH LYING SNOW, AND ONLY THE PICTURE KNOWS (src/game/weatherKinds.ts SNOW_LOOK.glow → render/frame.ts snowLookConfig.glow → the scene
// prelude's `const SNOW_GLOW`; the term is src/render/shaders/composite.wgsl snowGlow, a snow pixel is marked in the normal target's alpha by gbuffer.wgsl fsBox
// and snow.wgsl fsSnow).
//
// The maintainer, 10-14, of the pass: "ideally it looks natural, deforms with character movement, and maybe even has some subsurface scattering to look great?"
// This is the last of the three, as an approximation: on snow a lamp's light wraps a little past its terminator and comes through bluer, and shade leans to blue.
//
//   bun run tools/qa/snowglow-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SNOWGLOW_BREAK=1 …   = the stand's word never raises the switch, and the shader text is read with its SNOW_GLOW guards cut out and the term called from
//                          evalLight (what a careless edit would do): must fail
//   bun run tools/qa/probes.ts snowglow      (also under `weather`)
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's).
//
// The harness has no GPU: not one pixel of the glow is drawn here. What is proven is where the term stands and what cannot reach it.
//   stands    the switch's words: ON in the page (?snowglow=0 off), OFF on the frozen stand (TPS_SNOWGLOW=1 raises it), a FROZEN_HOLDS row, in the registry's
//             table; the prelude's word follows render/frame.ts snowLookConfig.glow and nothing else
//   mark      a snow pixel is told by the normal target's alpha: fsBox and fsSnow write under 1 only behind SNOW_GLOW (or SNOW_SPARKLE, which shares the mark:
//             snowsparkle-check.ts), every other writer of that target stores 1, and no shader reads that alpha but the term's own line (gdown.wgsl copies the
//             texel whole)
//   dead      every glow statement in the shaders stands behind SNOW_GLOW (no call of the term, none of its numbers, outside a guarded statement)
//   meter     the meter's and the probes' program (the prelude + lighting_common.wgsl + probe.wgsl), the bounce's (hitRadiance → directIrradiance → evalLight)
//             and every other shader do not name the term: it is in composite.wgsl alone, which the probe is not built from; no game module reads the switch
//   fog       the fog of war draws over the composite's output after it (passes.ts), its own shader knows nothing of the term, and the term is × the direct
//             pass's shadowed light (never a light the plain term did not show within its reach)
//   energy    by the shader's own numbers: nothing added square under a lamp, a few percent at most at 45°, GAIN at the terminator, nothing past WRAP; the
//             shade's tint keeps its luminance
//   digest    the game does not know: 300 stepped frames of the pass, switch on and off — one game digest
//   old       a recording from before the key replays with it off (journal.ts applyKnobs)
import { standUp, ROOT } from './headless.ts';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DT = 1 / 60;

export async function snowGlowCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const WK = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { SNOW, SNOW_LOOK } = WK;
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const FR = await import(`${ROOT}/src/render/frame.ts`);
  const PR = await import(`${ROOT}/src/host/profile.ts`);
  const J = await import(`${ROOT}/src/game/journal.ts`);
  const KN = await import(`${ROOT}/src/game/knobs.ts`);
  const BREAK = process.env.SNOWGLOW_BREAK === '1';
  const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWGLOW'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, env: ENV.map(k => process.env[k]), cfg: { ...FR.snowLookConfig } };

  /** a game stood up on the pass in snow with its surface, the glow's switch where `on` says by the stand's own word (null = the word not said: the stand's own
   *  answer) — the module's switch left the WRONG way round first, so only the stand can put it right */
  async function rig(on: boolean | null) {
    const sw = on === null ? null : on && !BREAK;
    process.env.TPS_SNOW = '1'; process.env.TPS_SNOWLOOK = '1'; if (sw === null) delete process.env.TPS_SNOWGLOW; else process.env.TPS_SNOWGLOW = sw ? '1' : '0';
    const expect = sw ?? (PR.harnessProfile() === 'shipped'); SNOW_LOOK.glow = !expect;
    if (sw === null && PR.harnessProfile() === 'shipped') PR.shippedBoot();   // (the word not said on the page's stand: nothing in standUp writes the switch — the stand's own boot does, as it did when this process began)
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed: 7 }));
    const g = W.game; const stood = SNOW_LOOK.glow;
    const step = (n = 1) => { for (let i = 0; i < n; i++) { SNOW_LOOK.glow = stood; W.step(DT); } };
    return { W, g, step, stood };
  }

  // ---- the shader text, as the build has it — or, under the break word, as a careless edit would leave it: the guards cut out, the term called from evalLight
  const SH = resolve(ROOT, 'src/render/shaders');
  const files = readdirSync(SH).filter(f => f.endsWith('.wgsl')).sort();
  const text: Record<string, string> = {};
  for (const f of files) {
    let t = readFileSync(resolve(SH, f), 'utf8');
    t = t.split('\n').map(l => /\/\/.*THE LOOK PROTOTYPE/.test(l) && /\bLOOK\b/.test(l.replace(/\/\/.*$/, '')) ? '' : l).join('\n');   // (the look prototype's own lines, each tagged in its comment and behind LOOK in its code: live only on its page — shaders/look.wgsl. It reads and writes the mark's fourth level, alpha 0, and is not this check's)
    if (BREAK) {
      t = t.replace(/if \(SNOW_GLOW(?: \|\| SNOW_SPARKLE)?\) \{/g, '{').replace(/select\(1\.0, ([^,()]+(?:\([^()]*\))?[^,()]*), SNOW_GLOW(?: \|\| SNOW_SPARKLE)?\)/g, '$1');
      if (f === 'common.wgsl') t = t.replace('  r.E = li.color * (att * c); r.ok = true;\n', '  r.E = li.color * (att * c) + snowGlow(vec2i(0), P, N, 1.0, vec3f(0.0), vec3f(0.0)); r.ok = true;\n');
    }
    text[f] = t;
  }
  const code = (line: string) => line.replace(/\/\/.*$/, '');
  const TERM = /\bsnowGlow\w*\s*\(|\bSNOW_GLOW_[A-Z]+\b/;   // a call of the term or one of its numbers (the switch itself is SNOW_GLOW, no underscore after)
  const OWN = /^fn snowGlow\w*\(|^const SNOW_GLOW_[A-Z]+\b/;

  try {
    // ---- stands
    { const up = await rig(true), down = await rig(false), unsaid = await rig(null);
      const prof = PR.harnessProfile(); const row = String(PR.FROZEN_HOLDS['SNOW_LOOK.glow'] ?? '');
      const page = /SNOW_LOOK\.glow = q\.get\('snowglow'\) !== '0';/.test(readFileSync(resolve(ROOT, 'src/host/profile.ts'), 'utf8'));   // (read, not run: pageSwitches writes every switch the page has)
      const mod = /export const SNOW_LOOK = \{[^}]*\bglow: false\b[^}]*\}/.test(readFileSync(resolve(ROOT, 'src/game/weatherKinds.ts'), 'utf8'));
      const reg = !!KN.JOURNAL_KNOBS && (KN.JOURNAL_KNOBS as readonly string[]).includes('SNOW_LOOK');
      const cfgWas = FR.snowLookConfig.glow; FR.snowLookConfig.glow = false; const p0 = FR.scenePrelude(); FR.snowLookConfig.glow = true; const p1 = FR.scenePrelude(); FR.snowLookConfig.glow = cfgWas;
      const word = /const SNOW_GLOW: bool = false;/.test(p0) && /const SNOW_GLOW: bool = true;/.test(p1) && p0.replace('const SNOW_GLOW: bool = false;', '') === p1.replace('const SNOW_GLOW: bool = true;', '');
      const boot = /snowLookConfig\.glow = SNOW_LOOK\.on && SNOW_LOOK\.glow;/.test(readFileSync(resolve(ROOT, 'src/main.ts'), 'utf8'));
      verdict(up.stood === true && down.stood === false && unsaid.stood === (prof === 'shipped') && /TPS_SNOWGLOW=1/.test(row) && page && mod && reg && word && boot,
        'stands — the switch\'s words on this stand', `${prof} stand · TPS_SNOWGLOW=1 → ${up.stood}, =0 → ${down.stood}, not said → ${unsaid.stood} (${prof === 'shipped' ? 'the page: on' : 'frozen: off'}) · FROZEN_HOLDS row: ${row ? `'${row.slice(0, 40)}…'` : 'NONE'} · the page's boot reads ?snowglow=0 and is on without it: ${page} · off in the module: ${mod} · its table rides in the journal's registry: ${reg} · the prelude's word follows snowLookConfig.glow and is the only text that differs: ${word} · main.ts raises it only with the surface: ${boot}`); }

    // ---- mark
    { const writers: string[] = [], badW: string[] = [], readers: string[] = [], badR: string[] = [];
      const NAMES = /@binding\(\d+\) var (\w*[Nn]ormal\w*): texture_2d<f32>/g;
      for (const f of files) {
        const names = new Set<string>(); for (const m of text[f].matchAll(NAMES)) names.add(m[1]);
        text[f].split('\n').forEach((line, i) => { const c = code(line);
          const w = c.match(/\b\w+\.normal = vec4f\((.*)\);/);
          if (w && !/textureLoad/.test(c)) { writers.push(`${f}:${i + 1}`); const one = /, 1\.0\)$/.test(`${w[1]})`), sw = /, select\(1\.0, [^,]+, SNOW_GLOW \|\| SNOW_SPARKLE\)\)$/.test(`${w[1]})`); if (!one && !(sw && (f === 'gbuffer.wgsl' || f === 'snow.wgsl'))) badW.push(`${f}:${i + 1}`); }
          if (/\bo\.normal\.a\s*=/.test(c) && !/if \(SNOW_GLOW \|\| SNOW_SPARKLE\) \{ o\.normal\.a = sb\.amt \* 0\.6667; \}/.test(c)) badW.push(`${f}:${i + 1} (the mark)`);
          for (const n of names) for (const m of c.matchAll(new RegExp(`textureLoad\\(${n},`, 'g'))) {
            let e = m.index! + 'textureLoad('.length, depth = 1; while (e < c.length && depth > 0) { if (c[e] === '(') depth++; else if (c[e] === ')') depth--; e++; }   // the call's own closing bracket
            const sz = (c.slice(e).match(/^\.[xyzwrgba]+/) ?? [''])[0]; if (sz === '.xyz' || sz === '.rgb' || sz === '.xy') continue;
            readers.push(`${f}:${i + 1}${sz}`);
            const whole = f === 'gdown.wgsl' && sz === '' && /r\.normal = textureLoad\(oNormal, o, 0\);/.test(c);
            const mine = f === 'composite.wgsl' && sz === '.a' && /let sa = snowGlowAmt\(textureLoad\(gNormal, sPix, 0\)\.a\);/.test(c);
            if (!whole && !mine) badR.push(`${f}:${i + 1}${sz}`);
          } }); }
      const clear = (readFileSync(resolve(ROOT, 'src/render/gbuffer.ts'), 'utf8').match(/normal\w*View, loadOp: 'clear', storeOp: 'store', clearValue: \{ r: 0\.5, g: 1, b: 0\.5, a: 0 \}/g) ?? []).length;
      const amt = /fn snowGlowAmt\(a: f32\) -> f32 \{\s*return clamp\(\(1\.0 - a\) \* 1\.5, 0\.0, 1\.0\); \}/.test(text['composite.wgsl']);
      const men = /if \(sa > 0\.0 && \(\(id >> 28u\) & 3u\) == 0u\) \{/.test(text['composite.wgsl']);
      verdict(writers.length >= 4 && badW.length === 0 && readers.length === 2 && badR.length === 0 && amt && men && clear >= 1,
        'mark — a snow pixel is told by the normal target\'s alpha, written under 1 only behind the switch and read by the term alone', `${writers.length} writers of the target in the shaders (${writers.join(', ')})${badW.length ? ` · NOT 1 and not behind SNOW_GLOW: ${badW.join(', ')}` : ': fsBox and fsSnow under 1 only behind SNOW_GLOW || SNOW_SPARKLE, the rest store 1'} · reads of more than its xyz: ${readers.join(', ') || 'none'}${badR.length ? ` · NOT the term's: ${badR.join(', ')}` : ' (the term\'s own, and gdown.wgsl\'s whole-texel copy)'} · the reader's decode: ${amt} · never on a man's pixel or a cap's: ${men} · nothing drawn = alpha 0 with depth 1, never shaded (${clear} clear values)`); }

    // ---- dead: every call of the term and every use of its numbers sits on a line guarded by SNOW_GLOW, in a block one opened, or inside the term's own functions
    { const bad: string[] = []; let uses = 0;
      for (const f of files) { let inOwn = false, block = -1;
        text[f].split('\n').forEach((line, i) => {
          if (/^fn /.test(line)) inOwn = /^fn snowGlow\w*\(/.test(line);
          else if (/^\}/.test(line)) { inOwn = false; return; }
          const c = code(line); const indent = line.search(/\S/);
          if (block >= 0 && indent >= 0 && indent <= block) block = -1;
          if (/\bSNOW_GLOW\b/.test(c) && /\{\s*$/.test(c)) { block = indent; return; }
          if (OWN.test(line) || inOwn) return;
          if (TERM.test(c)) { uses++; if (block < 0 && !/\bSNOW_GLOW\b/.test(c)) bad.push(`${f}:${i + 1}`); }
          else if (/\bo\.normal\.a\b/.test(c) && !/\bSNOW_GLOW\b/.test(c)) bad.push(`${f}:${i + 1}`);
        }); }
      const defs = files.filter(f => /^fn snowGlow\w*\(/m.test(text[f]));
      verdict(bad.length === 0 && uses >= 2 && defs.length === 1 && defs[0] === 'composite.wgsl',
        'dead — every glow statement in the shaders stands behind SNOW_GLOW', bad.length ? `unguarded: ${bad.join(', ')}` : `${uses} lines call the term or use its numbers outside its own functions, each inside a statement the switch guards · the term is defined in ${defs.join(', ') || 'NO FILE'}`); }

    // ---- meter
    { const named = files.filter(f => /\bsnowGlow\w*\b|\bSNOW_GLOW/.test(text[f].split('\n').map(code).join('\n')));
      const cfgWas = FR.snowLookConfig.glow; FR.snowLookConfig.glow = true; let prelude = FR.scenePrelude(); FR.snowLookConfig.glow = cfgWas;
      if (BREAK) prelude = prelude.replace(readFileSync(resolve(SH, 'common.wgsl'), 'utf8'), text['common.wgsl']).replace('  r.E = li.color * (att * c); r.ok = true;\n', '  r.E = li.color * (att * c) + snowGlow(vec2i(0), P, N, 1.0, vec3f(0.0), vec3f(0.0)); r.ok = true;\n');
      const probeProg = (prelude + text['lighting_common.wgsl'] + text['probe.wgsl']).split('\n').map(code).join('\n');
      const inProbe = (probeProg.match(/\bsnowGlow\w*\b|\bSNOW_GLOW\w*/g) ?? []).filter(w => w !== 'SNOW_GLOW');
      const decl = (probeProg.match(/\bSNOW_GLOW\b/g) ?? []).length;   // the prelude's one declaration
      const probeTs = readFileSync(resolve(ROOT, 'src/render/probe.ts'), 'utf8'); const built = /makeShader\(device, scenePrelude\(\) \+ lightingCommon \+ probeSrc, 'probe'\)/.test(probeTs) && !/composite/.test(probeTs);
      const body = (src: string, name: string) => { const a = src.indexOf(`fn ${name}(`); if (a < 0) return null; const b = src.indexOf('\n}\n', a); return src.slice(a, b < 0 ? undefined : b); };
      const fns = [['common.wgsl', 'evalLight'], ['common.wgsl', 'directIrradiance'], ['lighting_common.wgsl', 'hitRadiance'], ['lighting_common.wgsl', 'diceIrradiance']] as const;
      const dirty = fns.filter(([f, n]) => { const b = body(text[f], n); return b === null || /snow/i.test(b.split('\n').map(code).join('\n')); }).map(([f, n]) => `${f} ${n}`);
      const srcTs: string[] = []; const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { if (e.isDirectory()) walk(resolve(d, e.name)); else if (e.name.endsWith('.ts')) srcTs.push(resolve(d, e.name)); } }; walk(resolve(ROOT, 'src'));
      const rd = (re: RegExp, raw = false) => srcTs.filter(p => { const t = readFileSync(p, 'utf8'); return re.test(raw ? t : t.split('\n').map(code).join('\n')); }).map(p => p.slice(ROOT.length + 5)).sort();
      const swReaders = rd(/SNOW_LOOK\.glow\b/), cfgReaders = rd(/snowLookConfig\.glow\b/, true), wordTs = rd(/\bSNOW_GLOW\b/, true);   // (the last two as written, comments and all: the prelude's line is a template with `//` inside it)
      const game = swReaders.filter(p => p.startsWith('game/') && p !== 'game/journal.ts');
      const want = ['composite.wgsl', 'gbuffer.wgsl', 'snow.wgsl'];
      verdict(named.join() === want.join() && inProbe.length === 0 && decl === 1 && built && dirty.length === 0 && game.length === 0 && cfgReaders.join() === ['main.ts', 'render/frame.ts'].join() && wordTs.join() === 'render/frame.ts',
        'meter — the meter\'s, the probes\' and the bounce\'s programs do not hold the term', `shaders that name the switch or the term: ${named.join(', ')} (want ${want.join(', ')}: the two g-buffer files only mark the pixel) · the probe's program is the prelude + lighting_common.wgsl + probe.wgsl and nothing of composite.wgsl: ${built}; in it the term is named ${inProbe.length} times and the switch ${decl} (its declaration) · evalLight, directIrradiance, hitRadiance, diceIrradiance ${dirty.length ? `NAME SNOW: ${dirty.join(', ')}` : 'do not name snow'} · SNOW_LOOK.glow is read in ${swReaders.join(', ')}${game.length ? ` — A GAME MODULE: ${game.join(', ')}` : ' (in src/game the journal\'s rule alone)'} · snowLookConfig.glow in ${cfgReaders.join(', ')}`); }

    // ---- fog
    { const passes = readFileSync(resolve(ROOT, 'src/render/passes.ts'), 'utf8');
      const iComp = passes.indexOf(`beginRenderPass({ label: 'composite'`), iFog = passes.indexOf('new FogPass(this.device, this.sceneLayout)).encode(enc, this.fogFrame');
      const fogKnows = /snowGlow|SNOW_GLOW/.test(text['fogofwar.wgsl'].split('\n').map(code).join('\n'));
      const fn = text['composite.wgsl'].slice(text['composite.wgsl'].indexOf('fn snowGlow('));
      const shadowed = /return gS \* vis\.x \+ gB \* vis\.y;/.test(fn) && /let vis = clamp\(S \/ max\(U, vec2f\(1e-4\)\), vec2f\(0\.0\), vec2f\(1\.0\)\) \*/.test(fn) && /var S = vec2f\(luminance\(EdS\), luminance\(EdB\)\);/.test(fn) && /S \+= vec2f\(luminance\(textureLoad\(directTex, q, 0\)\.rgb\), luminance\(textureLoad\(softTex, q, 0\)\.rgb\)\);/.test(fn);
      const reach = /if \(!lightReaches\(i, P\)\) \{ continue; \}\s*\n\s*let li = lights\[i\];\s*\n\s*let ev = evalLight\(li, P, vec3f\(0\.0\)\);/.test(fn);
      const noRay = !/occluded|shadowSample|traceRay|trace\(/.test(fn.slice(0, fn.indexOf('\n}\n')).split('\n').map(code).join('\n'));
      const calls = (text['composite.wgsl'].split('\n').map(code).join('\n').match(/\bsnowGlow\(/g) ?? []).length - 1;   // (less the definition)
      verdict(iComp > 0 && iFog > iComp && !fogKnows && shadowed && reach && noRay && calls === 1,
        'fog — the term is under the fog of war and under the direct pass\'s own shadows', `passes.ts encodes the fog of war's pass over hdr AFTER the composite: ${iComp > 0 && iFog > iComp} · fogofwar.wgsl names the term: ${fogKnows} (an unseen pixel is drawn from the paint and the fog's own lights) · the term is × the stencil's shadowed ∕ unshadowed direct light per class (directTex, softTex): ${shadowed} · only lights whose reach mask has the cell, scored by evalLight as it stands: ${reach} · it traces nothing: ${noRay} · called from ${calls} place (the primary hit's diffuse)`); }

    // ---- energy: the shader's numbers, through the shader's own two formulas (asserted as text, then mirrored)
    { const t = text['composite.wgsl']; const num = (n: string) => { const m = t.match(new RegExp(`^const SNOW_GLOW_${n}: f32 = ([0-9.]+);`, 'm')); return m ? +m[1] : NaN; };
      const vec = (n: string) => { const m = t.match(new RegExp(`^const SNOW_GLOW_${n}: vec3f = vec3f\\(([0-9.]+), ([0-9.]+), ([0-9.]+)\\);`, 'm')); return m ? [+m[1], +m[2], +m[3]] : [NaN, NaN, NaN]; };
      const WRAP = num('WRAP'), GAIN = num('GAIN'), WHITEN = num('WHITEN'), REACH = num('REACH'), CONF = num('CONF'), TINT = vec('TINT'), SHADE = vec('SHADE');
      const form = /let t = \(c \+ SNOW_GLOW_WRAP\) \/ SNOW_GLOW_WRAP; let l = 1\.0 - min\(c, 1\.0\); let l2 = l \* l;/.test(t) && /\* \(SNOW_GLOW_GAIN \* select\(l2 \* l2, t \* t, c < 0\.0\)\);/.test(t) && /if \(c <= -SNOW_GLOW_WRAP\) \{ continue; \}/.test(t);
      const k = (c: number) => c <= -WRAP ? 0 : GAIN * (c < 0 ? ((c + WRAP) / WRAP) ** 2 : (1 - Math.min(c, 1)) ** 4);
      const lum = (v: number[]) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
      const rel = (c: number) => k(c) / c;   // the term's share of the plain light N·L at that angle (a white lamp, unshadowed: the most it can be)
      const ok = form && k(1) === 0 && rel(0.9) < 0.001 && rel(Math.SQRT1_2) < 0.03 && rel(0.5) < 0.05 && Math.abs(k(0) - GAIN) < 1e-9 && k(-WRAP) === 0 && k(-WRAP / 2) > 0 && k(-WRAP / 2) < GAIN
        && GAIN > 0 && GAIN <= 0.35 && WRAP > 0.1 && WRAP <= 0.6 && TINT[2] > TINT[1] && TINT[1] > TINT[0] && Math.max(...TINT) <= 1 && WHITEN >= 0 && WHITEN <= 1 && REACH > 0 && REACH <= 0.3 && CONF > 0
        && Math.abs(lum(SHADE) - 1) < 0.01 && SHADE[2] > 1 && SHADE[0] < 1 && SHADE[2] < 1.25;
      verdict(ok, 'energy — snow square under a lamp is as bright as it was; the change is at the terminator and in the shade',
        `WRAP ${WRAP} GAIN ${GAIN} TINT ${TINT.join(' ')} WHITEN ${WHITEN} REACH ${REACH} m CONF ${CONF} SHADE ${SHADE.join(' ')} · the shader's two formulas as written: ${form} · added, as a share of the plain light: N·L 1 → ${k(1)}, 0.9 → ${(rel(0.9) * 100).toFixed(3)} %, 0.71 → ${(rel(Math.SQRT1_2) * 100).toFixed(2)} %, 0.5 → ${(rel(0.5) * 100).toFixed(2)} % · of the lamp's square-on light: at the terminator ${k(0).toFixed(3)}, halfway into the wrap ${k(-WRAP / 2).toFixed(3)}, at −WRAP ${k(-WRAP)} · the shade's tint keeps ${(lum(SHADE) * 100).toFixed(1)} % of the luminance`); }

    // ---- digest: two fresh games of the pass in snow with its surface, the same frames, the switch on and off
    { const D1 = await rig(true), D0 = await rig(false); D1.step(300); D0.step(300);
      const h1 = hashDigest(digestGame(D1.g)), h0 = hashDigest(digestGame(D0.g));
      const boxes = (g: any) => g.level.boxes.length;
      verdict(h1 === h0 && D1.stood === true && D0.stood === false && boxes(D1.g) === boxes(D0.g) && !!D1.g.snowField && !!D0.g.snowField,
        'digest — the game does not know: one digest with the switch on and off', `300 frames of the pass in snow, its surface on: ${h1} with the glow's switch ${D1.stood ? 'on' : 'OFF'}, ${h0} with it ${D0.stood ? 'ON' : 'off'} · ${boxes(D1.g)} and ${boxes(D0.g)} boxes · the snow field stands in both: ${!!D1.g.snowField && !!D0.g.snowField}`); }

    // ---- old
    { const A = await rig(true); A.step(3); let ok = false, how = '';
      try {
        SNOW_LOOK.on = true; SNOW_LOOK.glow = true; const k = (J as any).knobsSnapshot(A.g); const had = !!k.tables?.SNOW_LOOK && 'glow' in k.tables.SNOW_LOOK && k.tables.SNOW_LOOK.glow === true;
        const k1 = JSON.parse(JSON.stringify(k)); delete k1.tables.SNOW_LOOK.glow; SNOW_LOOK.glow = true; (J as any).applyKnobs(A.g, k1); const noKey = SNOW_LOOK.glow, lookKept = SNOW_LOOK.on;
        const k2 = JSON.parse(JSON.stringify(k)); delete k2.tables.SNOW_LOOK; SNOW_LOOK.glow = true; (J as any).applyKnobs(A.g, k2); const noTable = SNOW_LOOK.glow;
        SNOW_LOOK.glow = false; (J as any).applyKnobs(A.g, JSON.parse(JSON.stringify(k))); const back = SNOW_LOOK.glow;
        ok = had && noKey === false && lookKept === true && noTable === false && back === true;
        how = `the key rides in a recording, as the game had it: ${had} · a recording with the table but not the key: glow ${noKey} after applyKnobs (the surface kept: ${lookKept}) · one with no table: ${noTable} · one with the key: ${back}`;
      } catch (e) { how = `threw: ${(e as Error).message}`; }
      verdict(ok, 'old — a recording from before the key replays with the glow off', how); }
  } finally { SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); Object.assign(FR.snowLookConfig, was.cfg); ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; }); }
  console.log(`\nsnowglow-check: ${checks - fails}/${checks} pass${BREAK ? ' (SNOWGLOW_BREAK=1: the switch never raised, the shaders read with their guards cut out — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await snowGlowCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
