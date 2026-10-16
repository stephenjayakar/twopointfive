// THE SCENE TWEAK PANEL TOUCHES NOTHING UNTIL A HAND DOES, AND THEN ONLY THE PICTURE (src/ui/sceneTweak.ts, src/ui/sceneLayers.ts, src/render/shaderTune.ts; `?tweak`).
//
// The maintainer, 10-15, on a night clip of the snow pass: "could you make a one off UI for tweaking a scene like this? i'm curious what all the "layers" are for the
// effects and what variables we can configure". A one off tool: it changes no default and is not a switch of the game's.
//
//   bun run tools/qa/scenetweak-check.ts [--verbose]      exit 0 = all pass, 1 = a FAIL line
//   SCENETWEAK_BREAK=1 …   = a shader override is left standing before the list is made (what a careless boot would do): must fail
//   bun run tools/qa/probes.ts scenetweak
//   Run it on BOTH stands (TPS_PROFILE=shipped in front for the page's).
//
// The harness has no GPU and no DOM: not one slider is drawn here. What is proven is the bookkeeping the panel stands on.
//   list      on the pass in snow the list holds the scene's layers; every number has one name, a shipped value inside its slider's reach, and every number of the
//             snow's and the air's tables is on it (a number added to a table shows up by itself)
//   untouched making the list writes nothing: the tables as they were, no shader override, every shader text the bundled text itself
//   round     every number put where it stands is where it stood; moved and put back, the tables are as they were and no override is left
//   mute      a layer switched off holds its weight at zero while its row and the copied text keep the hand's value; on again, the value is back
//   text      what `copy` hands back: the changed numbers by the code's names with what they were, under the file each lives in; nothing else
//   shader    a constant moved rebuilds its one program, with only that line of the text changed; put back, the text is the bundled text again
//   kept      the kept copy puts the changes back on a fresh list, and passes over names it does not know
//   notes     the hover text is the tables' own comments as they stand (tools/gen-scene-notes.ts --check)
//   digest    the game does not know: 300 stepped frames of the pass with every picture-only number moved and every hand switch off — one game digest
import { standUp, ROOT } from './headless.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DT = 1 / 60;

export async function sceneTweakCheck(o: { verbose?: boolean } = {}): Promise<boolean> {
  const { SNOW, SNOW_LOOK } = await import(`${ROOT}/src/game/weatherKinds.ts`);
  const { AIR_SIM } = await import(`${ROOT}/src/game/airSim.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const FX = await import(`${ROOT}/src/game/snowFx.ts`);
  const { SNOWTRACKS } = await import(`${ROOT}/src/game/snowTracks.ts`);
  const { SNOWBREATH } = await import(`${ROOT}/src/game/snowBreath.ts`);
  const { SNOWBLAST, snowBlastStats } = await import(`${ROOT}/src/game/snowBlast.ts`);
  const { SNOWMARKS } = await import(`${ROOT}/src/game/snowMarks.ts`);
  const { SNOW_SURF } = await import(`${ROOT}/src/render/snowField.ts`);
  const { AIR } = await import(`${ROOT}/src/render/airField.ts`);
  const ST = await import(`${ROOT}/src/render/shaderTune.ts`);
  const T = await import(`${ROOT}/src/ui/sceneTweak.ts`);
  const { sceneLayers } = await import(`${ROOT}/src/ui/sceneLayers.ts`);
  const BREAK = process.env.SCENETWEAK_BREAK === '1';
  const quiet = async <R>(fn: () => R | Promise<R>): Promise<R> => { if (o.verbose) return await fn(); const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
  let fails = 0, checks = 0;
  const verdict = (ok: boolean, label: string, detail: string) => { checks++; if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ENV = ['TPS_SNOW', 'TPS_SNOWLOOK', 'TPS_SNOWWISPS', 'TPS_SNOWTRACKS', 'TPS_SNOWGLOW', 'TPS_SNOWSPARKLE', 'TPS_SNOWBREATH', 'TPS_SNOWGRAINS', 'TPS_SNOWBLAST', 'TPS_SNOWAIR', 'TPS_SNOWMARKS', 'TPS_AIR'] as const;
  const was = { snow: SNOW.on, look: { ...SNOW_LOOK }, air: AIR_SIM.on, env: ENV.map(k => process.env[k]) };
  const TABLES: Record<string, Record<string, unknown>> = { SNOWFX: FX.SNOWFX, SNOWWISPS: FX.SNOWWISPS, SNOWGRAINS: FX.SNOWGRAINS, SNOWTRACKS, SNOWBLAST, SNOWMARKS, SNOWBREATH, SNOW_SURF, AIR };
  const snap = () => JSON.stringify(TABLES);
  const shader = (f: string) => readFileSync(resolve(ROOT, 'src/render/shaders', f), 'utf8');

  /** a game stood up on the pass in snow with every snow piece raised, and the engine the page would hand the list: the stand-in plus the few members the rows write */
  async function rig(seed = 7) {
    for (const k of ENV) process.env[k] = '1';
    const lvl = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', 'pass.json'), 'utf8')));
    const W: any = await quiet(() => standUp({ level: lvl, seed }));
    const g = W.game; const calls = { relook: 0, comp: 0, part: 0 };
    const eng: any = Object.assign(Object.create(g.engine), { passes: { bloom: 0.06, saturation: 1.15, grain: 0.022, retuneComposite: async () => { calls.comp++; return { ok: true, messages: [] }; } },
      gbuffer: { setSnowCfg: () => { calls.relook++; } }, particles: { retune: async () => { calls.part++; return { ok: true, messages: [] }; } }, timer: { results: new Map() } });
    return { W, g, eng, calls, step: (n = 1) => { for (let i = 0; i < n; i++) W.step(DT); } };
  }

  try {
    if (BREAK) ST.SHADER_TUNE.set('SNOW_SPARKLE_GAIN', [3]);
    const before = snap();
    const R = await rig(); const layers = sceneLayers(R.eng, R.g) as any[];
    const vars = layers.flatMap(L => L.vars) as any[];

    // ---- list
    { const ids = vars.map(v => v.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      const bad = vars.filter(v => !Number.isFinite(v.def) || !(v.min <= v.def + 1e-9 && v.def <= v.max + 1e-9) || !(v.step > 0)).map(v => `${v.id} ${v.min}‥${v.max} def ${v.def}`);
      const want = ['sky', 'torch', 'beams', 'surface', 'sparkle', 'glow', 'prints', 'marks', 'blast', 'flakes', 'oneair', 'wisps', 'grains', 'breath', 'air', 'storm', 'bloom', 'tone'];
      const missing = want.filter(id => !layers.some(L => L.id === id));
      const absent: string[] = [];
      for (const [name, t] of Object.entries(TABLES)) for (const [k, x] of Object.entries(t)) {
        if (typeof x === 'number' ? !ids.includes(`${name}.${k}`) : Array.isArray(x) && x.every(n => typeof n === 'number') && !ids.includes(`${name}.${k}[0]`)) absent.push(`${name}.${k}`); }
      verdict(!dup.length && !bad.length && !missing.length && !absent.length, 'list — the scene\'s layers, every number named once, inside its reach, every table number on it',
        `${layers.length} layers, ${vars.length} numbers${dup.length ? ` · twice: ${dup.join(', ')}` : ''}${bad.length ? ` · out of reach: ${bad.join('; ')}` : ''}${missing.length ? ` · no layer: ${missing.join(', ')}` : ''}${absent.length ? ` · not on the list: ${absent.join(', ')}` : ''}`); }

    // ---- untouched
    { const texts = ['composite.wgsl', 'particles.wgsl', 'particles_common.wgsl', 'particles_draw.wgsl'].map(shader);
      const same = texts.every(t => ST.tuned(t) === t);
      verdict(snap() === before && ST.SHADER_TUNE.size === 0 && same && !R.calls.comp && !R.calls.part && !R.calls.relook, 'untouched — making the list writes nothing',
        `tables ${snap() === before ? 'as they were' : 'CHANGED'} · ${ST.SHADER_TUNE.size} shader overrides · shader texts ${same ? 'the bundled texts' : 'CHANGED'} · rebuilds ${R.calls.comp + R.calls.part} · relooks ${R.calls.relook}`); }
    ST.SHADER_TUNE.clear();

    // ---- round
    { let drift = 0; for (const v of vars) { const x = v.get(); v.set(x); if (Math.abs(v.get() - x) > 1e-12) drift++; }
      const mid = snap() === before;
      let stuck = 0; for (const v of vars) { const to = v.def === v.max ? v.min : v.max; T.moveVar(v, to); if (Math.abs(v.get() - to) > 1e-9 && !/tune\.flash/.test(v.id)) stuck++; }   // (the cone's two angles hold each other apart: theirs is a clamp, not a fault)
      const moved = T.changedVars(layers).length;
      for (const v of vars) v.set(v.def); for (const v of vars) v.set(v.def);
      const back = snap() === before && ST.SHADER_TUNE.size === 0 && !T.changedVars(layers).length;
      // a number the GAME moves (the hour's exposure, a quality step: a write no hand made) is not a tweak; a typed value past the slider's reach is held to it
      T.resetAll(layers); const e = vars.find(v => v.id === 'settings.exposure'); e.set(e.def + 1); const own = T.changedVars(layers).length; e.set(e.def);
      T.moveVar(e, 1e9); const held = e.get() === e.max; T.resetAll(layers);
      verdict(!drift && mid && !stuck && moved >= vars.length - 2 && back && own === 0 && held && snap() === before, 'round — put where it stands nothing moves; moved and put back, all is as it was; only a hand\'s move is a change',
        `${drift} drifted · ${stuck} would not move · ${moved}/${vars.length} read as changed while moved · moved by the game itself: ${own} changed · past its reach: ${held ? 'held' : 'NOT HELD'} · after: tables ${snap() === before ? 'as they were' : 'CHANGED'}, ${ST.SHADER_TUNE.size} overrides, ${T.changedVars(layers).length} changed`); }

    // ---- one air (the snow thread's switch, read every frame: live here) and the blast's button
    { const O = layers.find(x => x.id === 'oneair'), G = layers.find(x => x.id === 'grains'), B = layers.find(x => x.id === 'blast');
      const row = (id: string) => vars.find(v => v.id === id);
      // (the grains and the blast's throw of them stand down on the SWITCH; what the wind sim's snow reads is read only while one air is IN FORCE)
      const reads = () => { const oa = FX.oneAirActive(R.g), sw = SNOW_LOOK.oneAir; const dim = (id: string) => !!row(id)?.idle?.();
        return !!G.idle?.() === sw && dim('SNOWBLAST.out') === sw && dim('SNOWBLAST.throwShare') === sw && dim('SNOWWISPS.speedK') === oa && dim('SNOWWISPS.gustPow') === oa && dim('SNOWWISPS.liftLo') === !oa && dim('SNOWFX.airLow') === !oa && dim('SNOWBLAST.flakes') === !oa && !dim('SNOWFX.perM2') && !dim('SNOWBLAST.sizeK'); };
      R.step(3); const on0 = SNOW_LOOK.oneAir, act0 = FX.oneAirActive(R.g), r0 = reads();
      O.on.set(false); R.step(2); const off = !SNOW_LOOK.oneAir && !FX.oneAirActive(R.g), r1 = reads(), txt = T.tweakText(layers, 'pass');
      const mode = O.on.mode === true && !O.on.reloads && !O.on.play && layers.find(x => x.id === 'air').on.mode === true;
      T.resetAll(layers); R.step(2); const back = SNOW_LOOK.oneAir === on0 && FX.oneAirActive(R.g) === act0;
      const b0 = snowBlastStats(R.g).blasts; B.act.run(); const b1 = snowBlastStats(R.g).blasts, why1 = snowBlastStats(R.g).why;
      B.on.set(false); B.act.run(); const b2 = snowBlastStats(R.g).blasts; T.resetAll(layers);
      verdict(on0 && r0 && off && r1 && mode && back && /switched off: .*Snow in one air/.test(txt) && b1 === b0 + 1 && b2 === b1 && SNOW_LOOK.blast && snap() === before, 'oneair — the switch is live and no layer of `none`; the rows nothing reads are the dimmed ones, either way; the button sets one blast off',
        `opened ${on0 ? 'on' : 'OFF'} (in force: ${act0}) · rows ${r0 ? 'agree' : 'DISAGREE'} · off: ${off ? 'not in force' : 'STILL IN FORCE'}, rows ${r1 ? 'agree' : 'DISAGREE'} · reset: ${back ? 'as it opened' : 'NOT BACK'} · blasts told ${b0} → ${b1} (${why1}), with its switch off ${b2}`); }

    // ---- mute
    { const L = layers.find(x => x.id === 'grains'); const v = L.vars.find((x: any) => x.id === 'SNOWGRAINS.opacity'); const d = FX.SNOWGRAINS.opacity;
      L.on.set(false); const off = FX.SNOWGRAINS.opacity, shown = v.get(), txt = T.tweakText(layers, 'pass');
      T.moveVar(v, 0.8); const held = FX.SNOWGRAINS.opacity; L.on.set(true); const back = FX.SNOWGRAINS.opacity; T.resetAll(layers);
      verdict(off === 0 && shown === d && /nothing changed/.test(txt) === false && /switched off: Blown grains/.test(txt) && !/SNOWGRAINS\.opacity/.test(txt) && held === 0 && back === 0.8 && FX.SNOWGRAINS.opacity === d, 'mute — off holds the weight at zero, the row and the text keep the hand\'s value',
        `off: table ${off}, row ${shown} · moved to 0.8 while off: table ${held} · on again: table ${back}`); }

    // ---- text + shader
    { const g = vars.find(v => v.id === 'SNOWGRAINS.opacity'), s = vars.find(v => v.id === 'SNOW_SPARKLE_GAIN'); const L = layers.find(x => x.id === 'sparkle');
      T.moveVar(g, 0.8); T.moveVar(s, 3); const txt: string = T.tweakText(layers, 'pass');
      const lines = txt.split('\n');
      const okText = lines[0] === 'scene tweak · pass' && lines.includes('SNOWGRAINS.opacity = 0.8   (was 0.5)') && lines.includes('SNOW_SPARKLE_GAIN = 3   (was 2)')
        && lines.includes('# src/game/snowFx.ts') && lines.includes('# src/render/shaders/composite.wgsl') && lines.filter(l => / = /.test(l)).length === 2;
      verdict(okText, 'text — the changed numbers by the code\'s names, with what they were, under their files', txt.trim().split('\n').join(' ⏎ '));
      const src = shader('composite.wgsl'), t = ST.tuned(src); const a = src.split('\n'), b = t.split('\n'); const diff = a.map((l, i) => l === b[i] ? -1 : i).filter(i => i >= 0);
      const relooks = R.calls.relook; L.apply(); await L.build(); const builds = R.calls.comp;   // (the owner skips a text it already runs: render/passes.ts retuneCompositeNow — the page check's to see, scenetweak-page.cjs)
      T.resetAll(layers); await L.build();
      verdict(a.length === b.length && diff.length === 1 && /^const SNOW_SPARKLE_GAIN: f32 = 3\.0;/.test(b[diff[0]]) && builds === 1 && R.calls.comp === 2 && R.calls.relook === relooks + 1 && ST.tuned(src) === src && ST.SHADER_TUNE.size === 0 && R.calls.part === 0,
        'shader — one line of one program\'s text, its owner asked to build it; put back, the bundled text again', `${diff.length} line(s) differ: ${diff.length ? b[diff[0]].slice(0, 44) : '-'} · composite asked ${builds} time(s), ${R.calls.comp} after the return · particles built ${R.calls.part} · back: ${ST.tuned(src) === src ? 'the bundled text' : 'CHANGED'}`); }

    // ---- kept
    { const g = vars.find(v => v.id === 'SNOWFX.gain'); T.moveVar(g, 12); layers.find(x => x.id === 'breath').on.set(false);
      const saved = JSON.parse(JSON.stringify(T.savedOf(layers, { v: { 'OTHER_PAGE.number': 2 }, sw: { 'other-page': false } })));
      const carried = saved.v['OTHER_PAGE.number'] === 2 && saved.sw['other-page'] === false && Object.keys(saved.v).length === 2 && Object.keys(saved.sw).length === 2; saved.v['NO_SUCH.number'] = 4; saved.v['SNOWFX.fallV'] = 'fast'; saved.sw['no-such-layer'] = false;
      const n = T.resetAll(layers).length; const clean = snap() === before;
      const hit = T.applySaved(layers, saved).map((L: any) => L.id).sort().join(',');
      const ok = FX.SNOWFX.gain === 12 && SNOWBREATH.opacity === 0 && !layers.find(x => x.id === 'breath').on.get() && T.changedVars(layers).length === 1;
      T.resetAll(layers);
      verdict(n === 2 && clean && ok && carried && hit === 'breath,flakes' && snap() === before, 'kept — the kept copy puts the changes back, passes over what it does not know, and carries what another page kept', `kept ${carried ? 'with' : 'WITHOUT'} the other page\'s two · reset touched ${n} layers (tables ${clean ? 'as they were' : 'CHANGED'}) · put back on: ${hit} · gain ${ok ? 12 : FX.SNOWFX.gain}`); }

    // ---- notes
    { const r = spawnSync(process.execPath, ['run', resolve(ROOT, 'tools/gen-scene-notes.ts'), '--check'], { encoding: 'utf8' });
      const { SCENE_NOTES } = await import(`${ROOT}/src/ui/sceneNotes.ts`); const noted = vars.filter(v => v.note).length;
      const bare = layers.filter(L => !L.note).map(L => L.id);
      verdict(r.status === 0 && !!SCENE_NOTES['SNOWFX.perM2'] && noted > vars.length * 0.8 && !bare.length, 'notes — the hover text is the tables\' own comments as they stand, and every layer says what it is', `gen-scene-notes --check exit ${r.status}${r.status ? ': ' + (r.stdout + r.stderr).trim().slice(0, 160) : ''} · ${noted}/${vars.length} numbers carry one · layers with no line: ${bare.join(', ') || 'none'}`); }

    // ---- digest
    { let pressed = true; const run = async (tweak: boolean, seed: number) => {
        const X = await rig(seed); const Ls = sceneLayers(X.eng, X.g) as any[]; let n = 0;
        // (the numbers first, and a blast told off the panel's button while its switch still stands; then every hand switch)
        if (tweak) for (const L of Ls) for (const v of L.vars) if (!v.play) { T.moveVar(v, v.def === v.max ? v.min : v.max); n++; }
        X.step(60); if (tweak) { const b0 = snowBlastStats(X.g).blasts; Ls.find(L => L.id === 'blast').act.run(); if (snowBlastStats(X.g).blasts !== b0 + 1) pressed = false; }
        X.step(40); if (tweak) for (const L of Ls) if (L.on && !L.on.reloads && !L.on.play) L.on.set(!L.on.get());
        X.step(200); const d = hashDigest(digestGame(X.g));
        T.resetAll(Ls); ST.SHADER_TUNE.clear();
        return { d, n }; };
      const out: string[] = []; let ok = true;
      for (const seed of [7, 11]) { const a = await run(false, seed), b = await run(true, seed); if (a.d !== b.d) ok = false; out.push(`seed ${seed}: ${a.d} ${a.d === b.d ? '=' : '≠'} ${b.d} (${b.n} numbers moved)`); }
      verdict(ok && pressed && snap() === before, 'digest — every picture-only number moved, a blast told off the button, every hand switch off: the game does not know', out.join(' · ') + ` · the button's blast told: ${pressed}`); }
  } finally { ST.SHADER_TUNE.clear(); SNOW.on = was.snow; Object.assign(SNOW_LOOK, was.look); AIR_SIM.on = was.air; ENV.forEach((k, i) => { if (was.env[i] === undefined) delete process.env[k]; else process.env[k] = was.env[i]; }); }
  console.log(`\nscenetweak-check: ${checks - fails}/${checks} pass${BREAK ? ' (SCENETWEAK_BREAK=1: a shader override left standing before the list was made — this run must fail)' : ''}`);
  return fails === 0;
}

if (import.meta.main) { const ok = await sceneTweakCheck({ verbose: process.argv.includes('--verbose') }); process.exit(ok ? 0 : 1); }
