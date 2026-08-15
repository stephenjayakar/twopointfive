import { Menu, loadSandbox, bootCard, SHOWCASE_BUTTONS } from './ui/menu';
import { initGpu, showFatal, pipelineProgress } from './gpu/device';
import * as boot from './ui/boot';
import { rigTable } from './render/sdfrig';
import { rigDebugTrace } from './render/rigDebug';
import { Engine } from './engine';
import { buildLevel, buildBundledLevel, bootedLocalLevel, withOfficeScript } from './scene/level';
import { loadLevel } from './scene/levelLoad';
import { parseLevelData } from './scene/levelData';
import { lightFromDef } from './render/lights';
import { FollowCamera } from './game/camera';
import { Input } from './game/input';
import { v3, Vec3 } from './math/vec';
import { loadGltfCharacter } from './anim/gltf';
import { scenePrelude, traceConfig, commonSource, glassBreakConfig } from './render/frame';
import { GLASSBREAK, GB_STATS, glassBreakPersisted, glassBreakLive, saveGlassBreak } from './game/glassbreak';
import lightingCommonSrc from './render/shaders/lighting_common.wgsl' with { type: 'text' };
import { setDaylight, isDaylight } from './game/lighting';
import { Game } from './game/game';
import { LIFE, FEET } from './game/character';
import { killGuard, fireWeapon } from './game/combat';
import { WEAPONS } from './game/weapons';
import { Overlay } from './ui/overlay';
import { Bubbles } from './ui/bubbles';
import { SmokeSystem } from './smoke/smoke';
import { Panel } from './ui/panel';
import { AudioEngine } from './audio/audio';
import { Demo } from './game/demo';
import { Breach } from './game/breach';
import { PerfRecorder } from './ui/perfrec';
import { SessionRec } from './ui/sessionrec';
import { checkSessionFile } from './game/journal';
import { requestQrf, callPerimeter, qrfStandDown } from './game/qrf';
import { needsSend, needsTrip, NEEDS, NEEDS_STATS, NEEDS_LOG, type NeedKind } from './game/needs';
import { civPanic, setCivilians, CIV, CIV_STATS, CIV_LOG, CIV_SPOTS, checkCivSpots } from './game/civilians';
import { Attract } from './game/attract';
import { Quality, QUALITY_NAMES, QualityName, rtVeto, p5Veto, sharpForce, gbaaForce, iqForce, gimVeto, froxelVeto, froxelForce } from './ui/quality';
import { buildPanel } from './ui/bindings';
import { frameCanvas, postShot } from './ui/capture';
import { reachBinding } from './render/frame';
import { decalDebug } from './render/decals';
import { sprayTestPattern, sprayRandom, bangScorch, kickScuff } from './game/marks';
import { testBurst } from './game/particleFx';
import type { PKind, EmitOpts, ImpulseOpts } from './render/particles';
import * as glassMod from './game/glass';
import * as wetMod from './game/wet';
import * as rainMod from './game/rainFx';
import * as destrMod from './game/destruction';
import * as windMod from './game/wind';
import * as mothsMod from './game/moths';
import * as saveMod from './game/savestate';

/** The top-left GPU / pass / guard read-out: opt-in in play (persisted), always off during the tour. */
const readout = { on: localStorage.getItem('twopointsix.readout') === '1', set(v: boolean) { this.on = v; try { localStorage.setItem('twopointsix.readout', v ? '1' : '0'); } catch { /* */ } } };
(window as any).__readout = readout;

// THE READINESS CONTRACT for scripts: `await window.__ready` — a Promise that exists from this module's first tick and resolves once the boot has finished (every kernel compiled,
// the Game built, EVERY automation hook below assigned, the start card live); it rejects if the boot dies. The hooks themselves (__engine, __game, __runFrames …) are only put
// on window at that point, so the older wait loops that poll for them + #view.clientWidth stay correct. window.__boot has the boot's timeline (ui/boot.ts).
let readyResolve!: () => void, readyReject!: (e: unknown) => void;
(window as any).__ready = new Promise<void>((res, rej) => { readyResolve = res; readyReject = rej; });
(window as any).__ready.catch(() => { /* surfaced by main().catch → the fatal card */ });
boot.expose();

async function main() {
  const q = new URLSearchParams(location.search);
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const loading = document.getElementById('loading')!;
  // The start card's look-alike goes up FIRST (menu.ts bootCard: the real layout with Start / Tour / Breach disabled and a status line), so the visitor reads the controls while the
  // GPU process compiles the renderer's ~100 kernels on its worker threads (engine.init below — gpu/device.ts has why they must never be compiled synchronously); the real Menu
  // re-renders over it, buttons live, when everything is ready. `tick()` yields to the event loop between the CPU-heavy phases so the card and its status line actually paint.
  const card = bootCard(); loading.textContent = '';
  const tick = () => document.hidden ? Promise.resolve() : new Promise<void>(r => setTimeout(r, 0));   // (a hidden pane / background tab services timers about once a second and paints nothing anyway: no yield there)
  await tick();
  const tGpu = performance.now();
  const gpu = await initGpu(canvas);
  boot.span('gpu', tGpu); boot.mark('gpu');
  // GPU errors during the boot: every uncaptured error still prints its own console line (gpu/device.ts); this only COLLECTS them until the pipelines are in, so the boot line
  // and __boot.gpuInitErrors can say 'clean' or name them (an error scope would fold N distinct errors into its first and hide them from the console)
  const gpuErr = (ev: Event) => { bootGpuErrors.push((ev as GPUUncapturedErrorEvent).error.message); };
  gpu.device.addEventListener('uncapturederror', gpuErr);
  if (q.has('reachUniform')) reachBinding.storage = false;   // A/B only: force the reach rows' uniform binding (the adapter fallback itself is the Engine's decision — render/frame.ts, engine.ts)
  { const tv = Number(q.get('trace')); if (q.has('trace') && Number.isFinite(tv) && tv >= 0) traceConfig.variant = tv | 0; }
  if (q.has('glassbreak') ? q.get('glassbreak') !== '0' : glassBreakPersisted()) glassBreakConfig.on = true;   // GLASS BREAKING (game/glassbreak.ts): the renderer's half is the scene prelude's compile-time const — raised here, before the Engine builds a pipeline, from the switch kept on this machine (Tab ▸ Destruction ▸ Glass; ?glassbreak / ?glassbreak=0 force it for one boot without touching the stored switch); off = every shader is main's program   // ?trace=N: the ray-traversal lab's compile-time variant const in every scene shader (render/frame.ts traceConfig, docs/internal/trace-perf.md; only 0 = today's walk exists on main) — must be set before the Engine builds any pipeline
  { const ds = Number(q.get('decalStress')); if (ds > 1) decalDebug.repeat = Math.min(64, ds | 0); }   // measurement only (?decalStress=N): the decal lookup N× per g-buffer fragment (render/decals.ts decalDebug), so its cost can be read above the timer's noise; must be set before the Engine builds the g-buffer shader
  const engine = new Engine(gpu);
  boot.mark('engine');
  // every boot pipeline, in flight from here (createComputePipelineAsync — resolved when READY, compiled off the thread that composites the browser): the level, the glTF and the Game
  // are built meanwhile and the lot is awaited before the first frame. The sharp-direct trio + GBAA kernel are prepared too unless the URL vetoes them (a preset switches them on at
  // any tier; otherwise they would compile synchronously inside the first frame that wants them).
  const tPipe = performance.now();
  const noSharp = q.has('nosharp') || q.has('noiq') || q.has('notaau');
  const status = () => card.status(pipelineProgress.total ? `compiling shaders ${pipelineProgress.done} / ${pipelineProgress.total} …` : 'compiling shaders …');
  pipelineProgress.onChange = status; status();
  const group = (name: string) => boot.span('pipelines_' + name, tPipe);   // per-group marks: when each module's last pipeline resolved, from the moment the first was requested
  const timed = <T,>(name: string, p: Promise<T> | undefined) => p?.then(v => { group(name); return v; });
  const engineInit = engine.init({ sharp: !noSharp, gbaa: !noSharp || q.has('gbaa'), onGroup: group });
  engineInit.catch(() => { /* awaited below */ });
  const tGl = performance.now();   // the mannequin's glTF: fetched + parsed alongside the compiles and the level (it used to wait for both)
  const chP = loadGltfCharacter(new URL('assets/ual/AnimationLibrary_Godot_Standard.gltf', document.baseURI).href).then(c => { boot.span('gltf', tGl); boot.mark('gltf'); return c; });
  chP.catch(() => { /* awaited below */ });
  if (new URLSearchParams(location.search).has('legacydenoise')) engine.settings.denoiser = 'legacy';   // ?legacydenoise: renderer v3 phase 3 off from boot — dtemporal + softblur, temporal + giblur, the gloss chain: the three old denoisers byte for byte
  if (new URLSearchParams(location.search).has('notaau')) engine.settings.taau = false;   // ?notaau: renderer v3 phase 1 off from boot — no jitter, output = internal, FXAA + the browser's bilinear: the old chain byte for byte (decided before the presets apply: they start at their TAAU scale only with it on)
  if (new URLSearchParams(location.search).has('nosharp')) { sharpForce.v = false; engine.settings.sharpDirect = false; }   // ?nosharp: sharp direct (decoupled resolution — engine.ts RenderSettings.sharpDirect) off from boot AND for every preset applied: main's frame under TAAU, for A/B and the identity hashes
  else if (new URLSearchParams(location.search).has('sharp')) { sharpForce.v = true; engine.settings.sharpDirect = true; }
  if (new URLSearchParams(location.search).has('gbaa')) { gbaaForce.on = true; engine.settings.gbaa = true; engine.settings.taauPhases = 0; }
  if (new URLSearchParams(location.search).has('noiq')) { iqForce.off = true; engine.settings.sharpDirect = false; engine.settings.sharpDecouple = false; engine.settings.gbaa = false; engine.settings.taauHistSharp = 0; }   // ?noiq: the image-quality program's resolve configuration all off = the resolve as it was (the identity A/B against main)   // ?gbaa: geometric edge AA on + the TAA's jitter off (the image-quality program's C3 by hand; the presets' own placement otherwise)
  if (new URLSearchParams(location.search).has('nomv')) engine.settings.motionIds = false;   // ?nomv: motion identity off — the g-buffer index-matches dynamic boxes as before (identity A/B)   // ?sharp: forced ON at every tier for the visit (the presets' own placement: ui/quality.ts Preset.iq)
  (window as any).__sharp = {   // sharp direct from the console: on / off, what it runs at, its memory
    get on() { return engine.settings.sharpDirect; }, set on(v: boolean) { engine.settings.sharpDirect = !!v; },
    get live() { return engine.sharpOn; },
    get edgeRays() { return engine.settings.sharpEdgeRays; }, set edgeRays(v: boolean) { engine.settings.sharpEdgeRays = !!v; },
    knobs: () => { const S = engine.settings; return { edgeRays: S.sharpEdgeRays, edgeSpread: S.sharpEdgeSpread, edgeHintPx: S.sharpEdgeHintPx, planeK: S.sharpPlaneK, sliver: S.sharpSliver, sliverCap: S.sharpSliverCap, diag: S.sharpDiag, gbaaClamp: S.gbaaClamp, heldRays: S.heldRays, hueSplit: S.restirHueSplit }; },
    set: (k: Partial<{ edgeRays: boolean; edgeSpread: number; edgeHintPx: number; planeK: number; sliver: number; sliverCap: number; diag: number; gbaaClamp: boolean; heldRays: number; hueSplit: boolean }>) => { const S = engine.settings; if (k.edgeRays !== undefined) S.sharpEdgeRays = !!k.edgeRays; if (k.edgeSpread !== undefined) S.sharpEdgeSpread = k.edgeSpread; if (k.edgeHintPx !== undefined) S.sharpEdgeHintPx = k.edgeHintPx; if (k.planeK !== undefined) S.sharpPlaneK = k.planeK;
      if (k.sliver !== undefined) S.sharpSliver = k.sliver; if (k.sliverCap !== undefined) S.sharpSliverCap = k.sliverCap; if (k.diag !== undefined) S.sharpDiag = k.diag; if (k.gbaaClamp !== undefined) S.gbaaClamp = !!k.gbaaClamp; if (k.heldRays !== undefined) S.heldRays = k.heldRays; if (k.hueSplit !== undefined) S.restirHueSplit = !!k.hueSplit; return (window as any).__sharp.knobs(); },   // (+ the direct-quality lane's knobs: the sliver rule / cap / paint, GBAA's clamp, the hybrid estimator's K — docs/internal/direct-quality.md)
    /** the sliver census of the LAST frame: sharpE[0]'s alpha carries the fallback code per output pixel (sharp_direct.wgsl SLIVERS) → counts {px, live, ring, sliver, traced, unshadowedDefault} + the per-row mask if asked (harness: tools/qa/dq-scenes.js) */
    census: async (mask = false) => { const t = engine.passes.sharpE[0]; if (!engine.sharpOn || !t) return null; const dev = engine.device; const w = t.width, h = t.height; const bpr = Math.ceil(w * 8 / 256) * 256; const buf = dev.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const enc = dev.createCommandEncoder(); enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: bpr }, [w, h]); dev.queue.submit([enc.finish()]); await buf.mapAsync(GPUMapMode.READ); const u16 = new Uint16Array(buf.getMappedRange().slice(0)); buf.unmap(); buf.destroy();
      const f16 = (x: number) => { const e = (x >> 10) & 31, m = x & 1023; return e === 0 ? m * 5.960464477539063e-8 : (1 + m / 1024) * Math.pow(2, e - 15); }; let ring = 0, sliver = 0, traced = 0, unsh = 0; const m8 = mask ? new Uint8Array(w * h) : null;
      for (let y = 0; y < h; y++) { const row = y * bpr / 2; for (let x = 0; x < w; x++) { const c = Math.round(f16(u16[row + x * 4 + 3])); const k = c & 3; if (k === 1) ring++; else if (k === 2) sliver++; if (c & 4) traced++; if (c & 8) unsh++; if (m8) m8[y * w + x] = c; } }
      return { w, h, px: w * h, ring, sliver, traced, unshadowedDefault: unsh, sliverPct: +(100 * sliver / (w * h)).toFixed(3), tracedPct: +(100 * traced / (w * h)).toFixed(3), mask: m8 }; },
    summary: () => `sharp direct ${engine.settings.sharpDirect ? 'ON' : 'off'}${engine.sharpOn ? ` — live: g-buffer / U / composite / TAA at ${engine.outWidth}×${engine.outHeight}, stochastic terms at ${engine.width}×${engine.height} (+${((engine.passes.sharpBytes + engine.gbuffer.sharpBytes) / 1048576).toFixed(0)} MB: the output-size raster, the direct pair, the larger HDR target, the edge mask)` : engine.settings.sharpDirect ? ` — idle (${!engine.settings.taau ? 'TAAU off' : engine.settings.debugView ? 'debug view' : 'render scale 1.0: nothing to decouple'})` : ''}`,
  };
  if (new URLSearchParams(location.search).has('nortreflect')) { rtVeto.on = true; engine.settings.rtReflect = false; }
  if (new URLSearchParams(location.search).has('nogim')) { gimVeto.on = true; engine.settings.giFullRes = false; engine.settings.giYoungRays = 1; engine.settings.ladderClimb = false; engine.settings.capClimb = false; }   // ?nogim: GI-in-motion's switches off from boot AND its two renderer switches vetoed for the presets — the frame as it was before the lane (the identity hashes, A/B); the Tab rows still flip them by hand
  if (new URLSearchParams(location.search).has('nop5')) { p5Veto.on = true; engine.settings.giResample = 'off'; engine.settings.rtMeshHits = false; engine.settings.rtHitReuse = false; }   // ?nop5: renderer v3 phase 5's ultra extras off from boot AND vetoed for the presets — ultra's frame as it was before the phase (the identity hashes, A/B); the Tab rows still flip them by hand   // ?nortreflect: renderer v3 phase 4's reflection pass off from boot AND vetoed for the presets (auto's ladder re-applies them) — with ?detail=0 the untouched frame for A/B; the Tab row still flips it by hand
  { const dv = new URLSearchParams(location.search).get('detail'); if (dv !== null && isFinite(parseFloat(dv))) engine.settings.detail = Math.max(0, Math.min(1, parseFloat(dv))); }
  if (new URLSearchParams(location.search).has('nomarkings')) engine.settings.markings = false;   // ?nomarkings: the markings lane's pixel-art signifiers off from boot — nothing evaluated, no marking lights registered (with ?level=relief the frame main draws)
  // ?levelFile=office-t20.json: boot on a level file fetched from the dev server's /levels/ (tools/levels-api.ts) instead of the bundled office — the review page's world-resolution
  // variants (tools/level-export.ts --texel) live there and nowhere in the bundle; a bad name falls back to the bundled office with a console error   // ?detail=0‥1: the g-buffer's detail layer amount from boot (0 = off: fsBox as it was)
  await tick();
  const tLv = performance.now();   // the level: parse + validate + load (the bundled office, or ?levelFile= off the dev server)
  let level = null as ReturnType<typeof buildLevel> | null;
  { const lf = q.get('levelFile');
    if (lf && /^[\w.-]+\.json$/.test(lf)) { try { const r = await fetch(`/levels/${lf}`, { cache: 'no-store' }); if (!r.ok) throw new Error(`HTTP ${r.status}`); level = withOfficeScript(loadLevel(parseLevelData(await r.text()))); } catch (e) { console.error(`?levelFile=${lf}: falling back to the bundled office —`, e); } } }
  if (!level) level = buildLevel();
  if (level.markTexel) engine.settings.markingTexel = level.markTexel;   // the base texel the level's marking bitmaps were generated for (absent = 2.5 cm)
  for (const b of level.boxes) engine.world.addStatic(b);
  for (const ld of level.lights) engine.lights.add(lightFromDef(ld));
  engine.settings.skyZenith = level.sky.zenith; engine.settings.skyHorizon = level.sky.horizon;
  boot.span('level', tLv); boot.mark('level');

  await tick();
  const ch = await chP;
  const smoke = new SmokeSystem(engine);
  engine.setSmoke(smoke.binding);
  const smokeInit = timed('smoke', smoke.init())!; smokeInit.catch(() => { /* awaited below */ });   // (its sixteen kernels join the ones in flight)
  await tick();
  const tGame = performance.now();   // the Game: collision / nav grid / reach masks / the wear map / characters / mesh-shadow trees / props … (main-thread work; the compiles carry on underneath)
  let game: Game;
  try { game = new Game(engine, level, ch, smoke); }
  catch (e) {   // ?level=local: an editor stash the file validator passed but the game cannot stand on (level.ts bootedLocalLevel) — say so, and boot the bundled office instead of dying on every reload
    if (!bootedLocalLevel) throw e;
    console.error('?level=local: the game could not be built on the editor level — falling back to the bundled office —', e);
    level = buildBundledLevel(); engine.world.statics.length = 0; engine.lights.lights.length = 0;
    for (const b of level.boxes) engine.world.addStatic(b); for (const ld of level.lights) engine.lights.add(lightFromDef(ld)); engine.settings.skyZenith = level.sky.zenith; engine.settings.skyHorizon = level.sky.horizon;
    game = new Game(engine, level, ch, smoke);
  }
  boot.span('gameCtor', tGame); boot.mark('game');
  if (q.has('noweather')) game.weather.setEnabled(false);   // ?noweather: the storm experiment off from boot (weather.ts) — the plain night, byte for byte
  engine.extraPasses.push((enc, sceneBG, diceView, ts) => { if (game.probe.hasPending) game.probe.encode(enc, sceneBG, diceView, ts('probe')); });
  engine.afterSubmit.push(() => game.probe.afterSubmit());
  engine.afterSubmit.push(() => smoke.afterSubmit());
  // ---- everything the first frame dispatches must exist: the engine's kernels, the smoke solver's, the Game's own three GPU modules (mesh-shadow skin / refit, the particles, the light
  // probe) and the skinned-mesh raster for this glTF's joint format — all compiled off the browser's compositing thread, counted in on the card meanwhile
  await tick(); status();
  await Promise.all([engineInit, smokeInit, timed('meshShadows', game.meshShadows.init()), timed('particles', engine.particles?.init()), timed('probe', game.probe.init()), timed('skin', engine.gbuffer.prepareSkin(game.chars.jointsFormat))]);
  boot.span('pipelines', tPipe); boot.mark('pipelines');
  pipelineProgress.onChange = null; boot.freezePipelines();
  card.status(`${pipelineProgress.done} shaders ready — setting up`);
  gpu.device.queue.onSubmittedWorkDone().then(() => gpu.device.removeEventListener('uncapturederror', gpuErr)).catch(() => { /* device lost: its own card */ });   // (errors from work queued so far still arrive; later ones are the frame's, not the boot's)
  (window as any).__weather = game.weather;
  window.__smoke = smoke;

  const audio = new AudioEngine(game.col); game.audio = audio;   // col includes the door leaves as dynamic occluders
  // test-rig mute: '?mute' or localStorage twopointsix.testMute=1 (set once in the automation browser's profile) keeps this page silent —
  // master pinned at 0 and the context never started — so scripted / headless runs stay silent
  const testMute = new URLSearchParams(location.search).has('mute') || (() => { try { return localStorage.getItem('twopointsix.testMute') === '1'; } catch { return false; } })();
  if (testMute) { audio.volume.master = 0; const sv = audio.setVolumes.bind(audio); audio.setVolumes = () => { audio.volume.master = 0; sv(); }; audio.start = () => {}; }
  // audio needs a user gesture: any click / key starts it (the start card's button is usually the first)
  window.addEventListener('pointerdown', () => audio.start(), { once: false }); window.addEventListener('keydown', () => audio.start(), { capture: true });   // (capture: Input claims game keys at window-capture and stops them there)
  window.__engine = engine; window.__game = game; window.__audio = audio;
  (window as any).__anim = { LIFE, FEET };   // the animation's life layer / foot lock constants (character.ts): renderer noise measurements zero LIFE.on / FEET.on so a still man's silhouette holds still to the pixel (tools/qa/perf-harness.js)
  (window as any).__killGuard = (i: number, how: 'shot' | 'struck' = 'shot') => { const gd = game.guards[i]; if (!gd || gd.state === 'dead') return false; killGuard(game, gd, [1, 0, 0], how !== 'shot', how); return true; };   // staging: drop guard i where he stands (a body on the floor for renderer captures — the torch-shadow boil scene)
  // __glass: the glass panes' console handles — on/off (the renderer's pane list), the knobs, a crack on the pane under the cursor or on a named pane, the numbers
  (window as any).__glass = {
    get on() { return engine.settings.glass; }, set on(v: boolean) { engine.settings.glass = !!v; },
    get reflect() { return engine.settings.glassReflect; }, set reflect(v: number) { engine.settings.glassReflect = v; },
    get tintDepth() { return engine.settings.glassTintDepth; }, set tintDepth(v: number) { engine.settings.glassTintDepth = v; },
    get dust() { return engine.settings.glassDust; }, set dust(v: number) { engine.settings.glassDust = v; },
    get refract() { return engine.settings.glassRefract; }, set refract(v: boolean) { engine.settings.glassRefract = !!v; },   // refraction through the glass boxes on / off (composite.wgsl glassRefractPath) and its index
    get ior() { return engine.settings.glassIor; }, set ior(v: number) { engine.settings.glassIor = v; },
    crack: () => game.crackTest(), summary: () => game.glassSummary(),
    hit: (bi: number, p: Vec3, dir: Vec3 | null = null) => glassMod.glassHit(game, bi, p, dir, 0, 'hand'),   // star pane bi at world point p as a round from `dir`'s side would (deterministic: the pattern is seeded off bi + p)
    get cracks() { return glassMod.crackCount(game); }, get listed() { return [...engine.world.glassList]; }, get panes() { return [...engine.world.glassStatics]; },
    state: () => glassMod.glassState(game), knobs: glassMod.GLASS,
  };
  // __glassbreak: glass that comes apart into rigid shards (game/glassbreak.ts) — the switch (persisted; the GPU half follows at the next boot: `gpu`), the knobs, the counters, the pane
  // records, the same open-cell test the CPU raycast takes, the panel's break test, reset
  (window as any).__glassbreak = {
    get on() { return !!(game.tune as { glassBreak?: boolean }).glassBreak; }, set on(v: boolean) { (game.tune as { glassBreak?: boolean }).glassBreak = !!v; saveGlassBreak(game); },
    get gpu() { return glassBreakConfig.on; }, get live() { return glassBreakLive(game); },
    knobs: GLASSBREAK, stats: GB_STATS, get log() { return game.glassBreak.log; },
    panes: () => [...game.glassBreak.panes.values()].map(st => ({ bi: st.bi, type: st.type, exterior: st.exterior, impacts: st.impacts.length, hits: st.hits, dropped: st.dropped, open: game.glassBreak.openFraction(st.bi), walkable: st.walkable, log: st.log.slice(-6) })),
    openAt: (p: Vec3, bi?: number) => { if (bi !== undefined) return game.glassBreak.openAt(bi, p); for (const i of engine.world.glassStatics) if (game.glassBreak.openAt(i, p)) return true; return false; },   // (no pane given: any pane whose fallen cell holds p — the CPU rule raycast / segmentBlocked use)
    hit: (bi: number, p: Vec3, dir: Vec3 = [0, 0, -1], n = 1) => { for (let k = 0; k < n; k++) glassMod.glassHit(game, bi, p, dir, 0, 'hand'); return game.glassBreak.panes.get(bi) ?? null; },   // n rounds' worth at p through glass.ts (star + noise + the impact)
    blast: (p: Vec3) => game.glassBreak.blast(p, 0), test: () => game.glassBreak.breakTest(), reset: () => game.glassBreak.reset(), summary: () => game.glassBreak.summary(),
  };
  const input = new Input(canvas);
  const cam = new FollowCamera();
  cam.target = v3.copy(level.playerSpawn);
  window.__cam = cam;
  const overlay = new Overlay();
  const bubbles = new Bubbles(document.getElementById('overlay')!);
  const demo = new Demo(game, cam, smoke, input); window.__demo = demo;
  // the second showcase: the daytime breach — the office's level script, program 'breach', run by the Director (game/director.ts; levels/office.script.ts); game/breach.ts keeps
  // the drill and `Breach` as the facade the card, the P key and __breach always drove (?breach boots straight into it, __breach.start() / .stop() by hand). Constructing it hands
  // the Director the camera and the input; __director is the Director itself (log, run, manifest, problems, start(name), stop(), summary()).
  const breach = new Breach(game, cam, smoke, input); (window as any).__breach = breach; (window as any).__director = game.director;
  // THE NIGHT SHOWCASE (levels/office.script.ts program 'night', docs/internal/night-showcase.md): the start card's first button, ?demo and the P key run it — the office after dark as one
  // continuous infiltration told in chapters (the lot in the storm, the fire exit's wedge, Kowalski's coffee run into the hold and the side door's code, the corridor camera's pool put out,
  // smoke across Novak's aisle, the keypad and the drive, the breaker, out through the restrike), then the tour's own hand-over: a fresh encounter and the controls. game/demo.ts (the old
  // 13-stop tour) stays in the tree for tools/qa/tour.ts's regression lap but is reachable from no button any more.
  const NIGHT = 'night';
  const nightActive = () => { const R = game.director.run; return !!R && !R.ended && R.name === NIGHT; };
  const startNight = (): string | null => {
    if (demo.active || game.director.showing) return 'a show is running';
    const fromCard = menu.mode === 'start';
    attract.poke(); if (menu.isOpen) menu.close();
    const why = game.director.start(NIGHT);
    if (why) { console.warn('night showcase: ' + why); game.msg?.(`night showcase can't start: ${why}`); if (fromCard && !menu.isOpen) menu.open('start'); }   // (a refusal is said, not swallowed — a unit on the floor, an unarmed script — and the start card comes back if it was the caller; wave-5 review)
    syncShowClass(); return why;
  };
  /** QUIT a running showcase back to the start card (Esc / P during either show; the designer, 08-13: no 'Your turn' hand-over any more — both shows simply return to the card). */
  const quitShow = () => { if (demo.active) demo.stop(); if (game.director.showing || game.director.handedOver) game.director.stop(true); syncShowClass(); if (menu.mode !== 'start') menu.open('start'); };
  /** SEEK a running showcase to chapter k (← / → and the timeline along the bottom, both shows). A show is one continuous story — the body behind the counter, the code in Sam's head, the
   *  mains — so a chapter is reached the honest way: the program restarted and the simulation run forward WITHOUT drawing or sound until its own camera enters that chapter (about a second
   *  of wall clock for the far end of the night on this machine), then the picture carries on from there. */
  let seeking = false;
  const seekShow = (k: number) => {
    const R0 = game.director.run; if (!R0 || R0.ended || !R0.show || seeking) return;
    const name = R0.name; const ch = game.director.chapters(); if (!ch || k < 0 || k >= ch.list.length || k === ch.i) return;
    const t0 = performance.now(); seeking = true; const audioWas = audio.enabled; audio.enabled = false;
    try {
      if (k < ch.i) {   // BACK: the story cannot be un-told — restart it and run forward; AHEAD: just run forward from here
        game.director.stop(true);
        if (name === NIGHT) { if (startNight()) return; } else if (name === 'breach') breach.start(); else if (game.director.start(name)) return;
      }
      const DTS = 1 / 30; let n = 0;
      while (n < 30 * 400) {   // (cap: 400 s of show)
        const R = game.director.run; if (!R || R.ended) break;
        const c = game.director.chapters(); if (c && c.i >= k) break;
        timeAcc += DTS; game.update(DTS, input, cam, canvas); smoke.update(DTS); engine.lights.update(DTS, timeAcc); input.endFrame(); n++;   // (lights.update: muzzle / impact flashes age and retire as they would have — else a firefight's few hundred transients all sit at age 0 and flash at once on the first drawn frame; wave-5 review)
      }
      smoke.emitters = smoke.emitters.filter(e => e.kind === 'canister');   // presentation queues built up unseen: muzzle jets / dust puffs would all deposit on the first drawn frame (a can's plume is state — kept)
      engine.particles?.clear();                                             // … and the GPU emit queue would drain as stale chips and paper over the next seconds
      engine.resetTaa?.('seek'); console.log(`showcase seek → chapter ${k}: ${n} steps in ${(performance.now() - t0).toFixed(0)} ms`);
    } finally { audio.enabled = audioWas; seeking = false; syncShowClass(); }
  };
  { const prev = game.director.onProgramEnd;
    game.director.onProgramEnd = (name, finished) => { prev?.(name, finished); if (name !== NIGHT) return; syncShowClass(); if (!seeking && menu.mode !== 'start') menu.open('start'); void finished; unattended = false; };   // (run by the attract loop with nobody here and left to its end: back to the start card rather than a live floor nobody plays — a visitor's poke mid-show keeps the live hand-over, as the tour always did)
  }
  (window as any).__night = {   // automation / console: start / stop / where it has got to / its rows of the Director's log
    start: () => startNight(), stop: () => { if (nightActive()) game.director.stop(); },
    get active() { return nightActive(); }, get t() { const D = game.director; return nightActive() ? D.run!.t : D.lastRun?.name === NIGHT ? D.lastRun.t : 0; },
    get handedOver() { return game.director.handedOver; },
    get log() { const D = game.director; const serial = nightActive() ? D.run!.serial : D.lastRun?.name === NIGHT ? D.lastRun.serial : -1; return D.rowsOf(serial); },
    chapters: () => game.director.chapters(), summary: () => game.director.summary(),
  };
  /** the level script's SHOWCASE frame this step, if a showcase program has the frame (its pinned look-at, caption, veil, lower third) — read after game.update below */
  const directorShow = () => game.director.showing ? game.director.frame : null;
  /** index.html body.breaching = a showcase program that asked for the one-line lower third and no HUD (director.frame.lowerThird): kept in step every frame and the moment a show starts / stops */
  let showClassOn = false;   // what the HUD's class was last set to — synced idempotently every frame, so a showcase begun or ended ANYWHERE (the card, P, __director.start between frames, a beat throwing) is followed
  const syncShowClass = () => { const on = game.director.lowerThird; if (on !== showClassOn) { showClassOn = on; document.body.classList.toggle('breaching', on); } };
  (window as any).__qrf = { request: (why = 'panel') => requestQrf(game, why as never), perimeter: (why = 'panel') => callPerimeter(game, why), standDown: () => qrfStandDown(game), get state() { return game.qrf; } };   // automation / console: force the response team without going loud (qrf.ts)
  (window as any).__civ = { get list() { return game.civilians; }, panic: (i = 0, what: 'panic' | 'phone' = 'panic') => civPanic(game, game.civilians[i], what), set: (on: boolean) => setCivilians(game, on), knobs: CIV, stats: CIV_STATS, log: CIV_LOG, spots: CIV_SPOTS, check: () => checkCivSpots(game), summary: () => game.civiliansSummary() };   // automation / console: the civilians (civilians.ts) — __civ.panic(0) frightens the cleaner where she stands, .panic(0, 'phone') sends her to ring it in, .set(false) clears them off the floor, .log the last things that happened, .check() the marks / spots against the nav grid
  (window as any).__needs = { send: (i = 0, kind: NeedKind = 'coffee') => needsSend(game, game.guards.filter(x => x.team === 'guard' && !x.unit)[i], kind), trip: (i = 0) => needsTrip(game.guards.filter(x => x.team === 'guard' && !x.unit)[i]), knobs: NEEDS, stats: NEEDS_STATS, log: NEEDS_LOG, summary: () => game.needsSummary() };   // automation / console: the needs (needs.ts) — __needs.send(0) = 'send Kowalski for a coffee' with the whole telegraph, .trip(0) his trip record, .log the last things that happened
  /** whichever hands-off programme is running (the tour, or a showcase program of the level script — the breach), for the veil / captions / timeline / hotkeys below — never both:
   *  each refuses to start over the other */
  const show = (): { caption: string; sub: string; fade: number } | null => demo.active ? demo : game.director.showing ? (game.director.frame ?? { caption: '', sub: '', fade: 0 }) : null;
  // WGSL compile check against the live device (Chrome/Tint is the compiler we ship to; naga is not available on this machine):
  // __wgsl(source, { prelude: 'scene' | 'lighting' }) prepends what the scene passes get (world consts + common.wgsl [+ lighting_common.wgsl]),
  // so a worktree's edited pass shader can be checked in seconds without booting its build. Resolves to the compiler messages.
  window.__wgsl = async (code: string, opts: { prelude?: boolean | 'scene' | 'lighting'; label?: string } = {}) => {
    const pre = opts.prelude === 'scene' ? scenePrelude() : opts.prelude ? scenePrelude() + lightingCommonSrc : '';   // 'scene' = what direct/softblur/temporal get; true|'lighting' = + lighting_common (gather, rc, probe, volumetrics)
    const full = pre + code;
    const mod = gpu.device.createShaderModule({ code: full, label: opts.label ?? 'lint' }); const info = await mod.getCompilationInfo();
    const off = pre ? pre.split('\n').length - 1 : 0;
    return info.messages.map(x => ({ type: x.type, line: x.lineNum - off, col: x.linePos, msg: x.message, src: (full.split('\n')[x.lineNum - 1] ?? '').trim() }));
  };
  // __hotVol(src?): recompile the volumetric pass from a volumetrics.wgsl variant against the live device and swap it in (passes.hotSwapVol) — no src = refetch
  // the file as it is on disk from the dev server (/qa/shader/volumetrics.wgsl), so an edit can be timed against a staged stress scene without rebooting it
  (window as any).__hotVol = async (src?: string) => engine.passes.hotSwapVol(src ?? await (await fetch('/qa/shader/volumetrics.wgsl', { cache: 'no-store' })).text());
  const hotCommon = async () => (await fetch('/qa/shader/direct_common.wgsl', { cache: 'no-store' })).text();   // both direct-light estimators get direct_common.wgsl prepended, as passes.ts builds them
  (window as any).__hotDirect = async (src?: string) => engine.passes.hotSwapDirect(src ?? await (await fetch('/qa/shader/direct.wgsl', { cache: 'no-store' })).text(), 'direct', await hotCommon());   // the same for the direct-light pass (direct.wgsl variants — the settings.restir OFF path)
  (window as any).__hotRestir = async (src?: string) => engine.passes.hotSwapDirect(src ?? await (await fetch('/qa/shader/restir.wgsl', { cache: 'no-store' })).text(), 'restir', await hotCommon());   // … and for restir.wgsl (the ON path)
  (window as any).__hotSharp = async (src?: string) => engine.passes.hotSwapSharp(src ?? await (await fetch('/qa/shader/sharp_direct.wgsl', { cache: 'no-store' })).text(), await hotCommon());   // … sharp_direct.wgsl (both variants; direct-quality lane)
  (window as any).__hotGbaa = async (src?: string) => engine.passes.hotSwapGbaa(src ?? await (await fetch('/qa/shader/gbaa.wgsl', { cache: 'no-store' })).text());   // … gbaa.wgsl
  if (new URLSearchParams(location.search).has('norestir')) engine.settings.restir = false;   // ?norestir: the leader / tail direct-light estimator (direct.wgsl) from boot — renderer v3 Phase 2a's untouched path, for A/B
  { const q = new URLSearchParams(location.search); if (q.has('norestirmotion')) engine.settings.restirMotion = 0; const rm = q.get('restirmotion'); if (rm !== null && rm !== '') engine.settings.restirMotion = Math.max(0, Math.min(7, parseInt(rm, 10) || 0)); }   // ?norestirmotion / ?restirmotion=N: the direct-motion lane's reservoir-reprojection levers from boot (docs/internal/direct-motion.md; 0 = the estimator's program byte for byte)
  // __hotFroxel(src?): the same for the froxel kernels (froxel.wgsl → render/froxels.ts hotSwap; the cull / inject / temporal / integrate pipelines swapped together)
  (window as any).__hotFroxel = async (src?: string) => engine.passes.froxels.hotSwap(src ?? await (await fetch('/qa/shader/froxel.wgsl', { cache: 'no-store' })).text());
  if (new URLSearchParams(location.search).has('nofroxel')) { froxelVeto.on = true; engine.settings.froxelVol = false; }
  if (new URLSearchParams(location.search).has('nosmokediffuse')) engine.passes.smokeDiffuse = 0;   // ?nosmokediffuse: smoke attenuates only, nothing behind it blurred (the final blit as it was)
  if (new URLSearchParams(location.search).has('froxel')) { froxelForce.on = true; engine.settings.froxelVol = true; }   // ?froxel: the froxel path forced even at ultra / high (their presets ship the classic per-pixel march since 08-12) — the A/B   // ?nofroxel: froxel volumetrics off from boot — the per-pixel volumetric march exactly as it was (Tab ▸ Volumetrics — froxels flips it live)
  // __froxel: the froxel volume for the console / automation — the grid, memory, history state, the knobs by name, a history restart
  (window as any).__froxel = {
    get on() { return engine.settings.froxelVol; }, set on(v: boolean) { engine.settings.froxelVol = !!v; },
    get grid() { return { ...engine.passes.froxels.grid, clusters: engine.passes.froxels.clusterDims(), k: engine.settings.froxelK, mb: +(engine.passes.froxels.bytes / 1048576).toFixed(1) }; },
    get state() { const f = engine.passes.froxels; return { allocated: f.allocated, histValid: f.histValid, age: f.age, idle: f.idle, remakes: f.remakes, last: f.lastRemake, split: engine.passes.froxelSplitTiming }; },
    set(k: string, v: number | boolean) { const S = engine.settings as unknown as Record<string, unknown>; const key = k.startsWith('froxel') ? k : 'froxel' + k[0].toUpperCase() + k.slice(1); if (!(key in S)) return false; S[key] = v; return true; },
    split(on = true) { engine.passes.froxelSplitTiming = !!on; return engine.passes.froxelSplitTiming; },
    restart() { engine.passes.froxels.restartHistory(); return true; },
    summary() { const f = engine.passes.froxels, S = engine.settings; return `froxels ${S.froxelVol ? 'on' : 'OFF'} · ${f.grid.w}×${f.grid.h}×${f.grid.d} k ${S.froxelK} strata ${S.froxelTopRays} hist ${S.froxelHistory} · ${f.allocated ? (f.bytes / 1048576).toFixed(1) + ' MB' : 'no grid'} · near ${S.froxelNear} far ${S.froxelFar} curve ${S.froxelCurve} bias ${S.froxelBias}${f.lastRemake ? ' · last: ' + f.lastRemake : ''}`; },
  };
  // __hotDenoise(src?): the same for the v3 denoiser core (render/denoise.ts hotSwap ← /qa/shader/denoise.wgsl)
  (window as any).__hotDenoise = async (src?: string) => engine.passes.den.hotSwap(src ?? await (await fetch('/qa/shader/denoise.wgsl', { cache: 'no-store' })).text());
  // __hotReflect(src?): … and for the reflection pass (passes.hotSwapReflect ← /qa/shader/reflect_p5.wgsl while the phase-5 variant is the one dispatched, else reflect.wgsl; a given src goes to whichever its bindings say)
  (window as any).__hotReflect = async (src?: string) => engine.passes.hotSwapReflect(src ?? await (await fetch(engine.passes.rtP5 ? '/qa/shader/reflect_p5.wgsl' : '/qa/shader/reflect.wgsl', { cache: 'no-store' })).text());
  // __rt: materials + reflections (renderer v3 phase 4) for the console / automation (+ phase 5's mesh / reuse switches)
  (window as any).__rt = {
    get on() { return engine.settings.rtReflect; }, set on(v: boolean) { engine.settings.rtReflect = !!v; },
    get detail() { return engine.settings.detail; }, set detail(v: number) { engine.settings.detail = Math.max(0, Math.min(1, v)); },
    get mesh() { return engine.settings.rtMeshHits; }, set mesh(v: boolean) { engine.settings.rtMeshHits = !!v; },
    get reuse() { return engine.settings.rtHitReuse; }, set reuse(v: boolean) { engine.settings.rtHitReuse = !!v; },
    knobs: () => { const S = engine.settings; return { on: S.rtReflect, div: S.rtReflectDiv, rays: S.rtRays, maxRough: S.rtMaxRough, atrous: S.rtAtrous, aniso: S.rtAniso, strength: S.rtStrength, glints: S.rtGlints, detail: S.detail, history: S.rtHistory, specClampK: S.dnSpecClampK, mesh: S.rtMeshHits, reuse: S.rtHitReuse }; },
    set: (k: Partial<{ on: boolean; div: number; rays: number; maxRough: number; atrous: number; aniso: number; strength: number; glints: number; detail: number; history: number; specClampK: number; mesh: boolean; reuse: boolean }>) => { const S = engine.settings; if (k.on !== undefined) S.rtReflect = k.on; if (k.div !== undefined) S.rtReflectDiv = k.div; if (k.rays !== undefined) S.rtRays = k.rays; if (k.maxRough !== undefined) S.rtMaxRough = k.maxRough; if (k.atrous !== undefined) S.rtAtrous = k.atrous; if (k.aniso !== undefined) S.rtAniso = k.aniso; if (k.strength !== undefined) S.rtStrength = k.strength; if (k.glints !== undefined) S.rtGlints = k.glints; if (k.detail !== undefined) S.detail = k.detail; if (k.history !== undefined) S.rtHistory = k.history; if (k.specClampK !== undefined) S.dnSpecClampK = k.specClampK; if (k.mesh !== undefined) S.rtMeshHits = k.mesh; if (k.reuse !== undefined) S.rtHitReuse = k.reuse; return (window as any).__rt.knobs(); },
    summary: () => { const S = engine.settings, P = engine.passes; return `rt ${S.rtReflect ? `on ÷${P.rtDiv} ${P.rw}×${P.rh} · ${S.rtRays} ray/px · rough ≤ ${S.rtMaxRough} · ${S.rtAtrous} à-trous` : 'off'} · detail ${S.detail.toFixed(2)} · gloss row ${S.gloss ? (S.rtReflect ? 'set, superseded' : 'on') : 'off'} · mesh hits ${S.rtMeshHits ? (engine.meshShadowsOn ? 'on' : 'wanted (mesh shadows off)') : 'off'} · hit reuse ${S.rtHitReuse ? 'on' : 'off'}`; },
  };
  // __hotGather(src?): recompile both gather pipeline pairs (fgather.wgsl main + mainGi, × GATHER_STRATA ← /qa/shader/fgather.wgsl) against the staged scene
  (window as any).__hotGather = async (src?: string) => engine.passes.hotSwapGather(src ?? await (await fetch('/qa/shader/fgather.wgsl', { cache: 'no-store' })).text(), await (await fetch('/qa/shader/gather_common.wgsl', { cache: 'no-store' })).text());   // (gather_common.wgsl from disk too: the two move together)
  // ?gatherStrata / __gs: the gather's tile-coherent STRATIFIED directions (settings.gatherStrata, ported from exp/trace-perf E8 — unbiased, −13‥16 % gather, not hash-identical: default off; flips live)
  { const q = new URLSearchParams(location.search); if (q.has('gatherStrata')) engine.settings.gatherStrata = true; if (q.has('nogatherstrata')) engine.settings.gatherStrata = false; }   // (default ON since 08-12; ?nogatherstrata = the iid gather, hash-identical to the pre-port frame)
  (window as any).__gs = {
    get on() { return engine.settings.gatherStrata; }, set on(v: boolean) { engine.settings.gatherStrata = !!v; },
    summary: () => `gather strata ${engine.settings.gatherStrata ? 'ON (stratified, tile-coherent directions: pFGs / pFGRs)' : 'off (iid cosine directions, the gather as it was)'} · gather ${engine.passes.gw}×${engine.passes.gh}${engine.settings.giResample !== 'off' ? ' · resampling ' + engine.settings.giResample : ''}`,
  };
  // ---- RAY-TRAVERSAL LAB (ported from exp/trace-perf; tools/qa/trace-lab.js drives these — docs/internal/trace-perf.md §0): __scenePrelude(lighting?) = the prelude every scene shader is
  // compiled behind RIGHT NOW (world consts + TRACE_VARIANT + common.wgsl [+ lighting_common]); __traceConfig = render/frame.ts traceConfig; __commonSource() = the common.wgsl text in
  // use; __hotCommon(src?, variant?) installs an edited common.wgsl text (no arg / null = refetch the file from disk; '' = back to the bundled text) and/or a TRACE_VARIANT, then rebuilds
  // EVERY pipeline that traces rays — direct + restir, the four gathers, the live reflection kernel, the volumetric march, the froxel kernels, the three cascade kernels, the particles'
  // sim — against the staged scene, so a traversal change is timed and pixel-compared without a reboot (composite's wet-coat side ray, the light probe and the bounce cards keep the boot
  // prelude: reboot with ?trace=N for whole-frame identity). __daylight(on?) = the breach's daylight swap by hand (lighting.ts setDaylight, bit for bit) for the lab's sun-shadow scene B5.
  (window as any).__daylight = (on?: boolean) => { if (on !== undefined && !!on !== isDaylight(game)) setDaylight(game, !!on); return isDaylight(game); };
  (window as any).__scenePrelude = (lighting = false) => scenePrelude() + (lighting ? lightingCommonSrc : '');
  (window as any).__traceConfig = traceConfig;
  (window as any).__commonSource = commonSource;
  (window as any).__hotCommon = async (src?: string | null, variant?: number) => {
    const shader = async (n: string) => (await fetch(`/qa/shader/${n}.wgsl`, { cache: 'no-store' })).text();
    if (src === undefined || src === null) traceConfig.common = await shader('common'); else traceConfig.common = src === '' ? null : src;
    if (variant !== undefined && Number.isFinite(variant)) traceConfig.variant = variant | 0;
    const t0 = performance.now(); const P = engine.passes; const out: Record<string, { ok: boolean; messages: string[] }> = {};
    const dc = await shader('direct_common');
    const jobs: [string, Promise<{ ok: boolean; messages: string[] }>][] = [
      ['direct', P.hotSwapDirect(await shader('direct'), 'direct', dc)],
      ['restir', P.hotSwapDirect(await shader('restir'), 'restir', dc)],
      ['gather', P.hotSwapGather(await shader('fgather'), await shader('gather_common'))],
      ['reflect', P.hotSwapReflect(await shader(P.rtP5 ? 'reflect_p5' : 'reflect'))],
      ['vol', P.hotSwapVol(await shader('volumetrics'))],
      ['froxel', P.froxels.hotSwap(await shader('froxel'))],
      ['rc', engine.rc.hotSwap()],
    ];
    if (engine.particles) jobs.push(['particles', engine.particles.hotSwapSim()]);
    const rs = await Promise.all(jobs.map(j => j[1].catch(e => ({ ok: false, messages: [String((e as Error)?.message ?? e)] }))));
    jobs.forEach((j, i) => { out[j[0]] = rs[i]; });
    const bad = Object.entries(out).filter(([, r]) => !r.ok);
    return { ok: bad.length === 0, variant: traceConfig.variant, commonChars: (traceConfig.common ?? '').length, ms: Math.round(performance.now() - t0), failed: Object.fromEntries(bad.map(([k, r]) => [k, r.messages.slice(0, 6)])), warnings: Object.fromEntries(Object.entries(out).filter(([, r]) => r.ok && r.messages.length).map(([k, r]) => [k, r.messages.slice(0, 4)])) };
  };
  // __gi: the gather's reservoir resampling (renderer v3 phase 5, ultra) for the console / automation — mode + knobs in one object
  (window as any).__gi = {
    get mode() { return engine.settings.giResample; }, set mode(v: 'off' | 'temporal' | 'full') { engine.settings.giResample = v === 'full' ? 'full' : v === 'temporal' ? 'temporal' : 'off'; },
    knobs: () => { const S = engine.settings; return { mode: S.giResample, rays: S.giResampleRays, cap: S.giResampleCap, taps: S.giResampleTaps, radius: S.giResampleRadius, revalidate: S.giResampleRevalidate }; },
    set: (k: Partial<{ mode: 'off' | 'temporal' | 'full'; rays: number; cap: number; taps: number; radius: number; revalidate: boolean }>) => { const S = engine.settings; if (k.mode !== undefined) S.giResample = k.mode; if (k.rays !== undefined) S.giResampleRays = k.rays; if (k.cap !== undefined) S.giResampleCap = k.cap; if (k.taps !== undefined) S.giResampleTaps = k.taps; if (k.radius !== undefined) S.giResampleRadius = k.radius; if (k.revalidate !== undefined) S.giResampleRevalidate = k.revalidate; return (window as any).__gi.knobs(); },
    summary: () => { const S = engine.settings, P = engine.passes; return `gi resampling ${S.giResample}${S.giResample !== 'off' ? ` · ${S.giResampleRays} fresh · M ≤ ${S.giResampleCap}${S.giResampleRevalidate ? ' · revalidate' : ''}${S.giResample === 'full' ? ` · ${S.giResampleTaps} taps r ${S.giResampleRadius}` : ''} · ${P.gw}×${P.gh} · ${(P.p5Bytes / 1048576).toFixed(0)} MB` : ''}`; },
  };
  // __gimo: GI IN MOTION (docs/internal/gi-motion.md) — the internal-res diffuse chain, the young-history gather rays, the ladder's climb, in one object for the console / automation
  (window as any).__gimo = {
    knobs: () => { const S = engine.settings; return { fullRes: S.giFullRes, fullIters: S.giFullIters, youngRays: S.giYoungRays, youngCap: S.giYoungCap, youngLen: S.giYoungLen, ladderClimb: S.ladderClimb, capClimb: S.capClimb }; },
    set: (k: Partial<{ fullRes: boolean; fullIters: number; youngRays: number; youngCap: number; youngLen: number; ladderClimb: boolean; capClimb: boolean }>) => { const S = engine.settings; if (k.fullRes !== undefined) S.giFullRes = !!k.fullRes; if (k.fullIters !== undefined) S.giFullIters = k.fullIters; if (k.youngRays !== undefined) S.giYoungRays = k.youngRays; if (k.youngCap !== undefined) S.giYoungCap = k.youngCap; if (k.youngLen !== undefined) S.giYoungLen = k.youngLen; if (k.ladderClimb !== undefined) S.ladderClimb = !!k.ladderClimb; if (k.capClimb !== undefined) S.capClimb = !!k.capClimb; return (window as any).__gimo.knobs(); },
    get live() { return engine.passes.giFullLive; },
    young: () => engine.passes.readYoungCount(),
    calm: (on?: boolean) => { if (on !== undefined) (window.__quality as any)?.applyMotionCalm(!!on); return !!(window.__quality as any)?.motionCalm; },   // the motion-calm rows on / off (quality.ts MOTION_CALM)
    summary: () => { const S = engine.settings, P = engine.passes; return `gi in motion: full-res ${S.giFullRes ? (P.giFullLive ? `LIVE ${P.width}×${P.height} · ${S.giFullIters} à-trous · ${(P.giFullBytes / 1048576).toFixed(0)} MB` : 'wanted (not live)') : 'off'} · young rays ${S.giYoungRays > 1 ? `×${S.giYoungRays} (cap ${(S.giYoungCap * 100).toFixed(0)} % · len < ${S.giYoungLen})` : 'off'} · climb ${S.ladderClimb ? 'on' : 'off'}${S.capClimb ? ' + cap' : ''} · motion-calm rows ${(window.__quality as any)?.motionCalm ? 'ON' : 'off'}`; },
  };
  // __dmo: DIRECT LIGHT IN MOTION (docs/internal/direct-motion.md) — ReSTIR's temporal reuse under a moving camera: settings.restirMotion (bitmask 1 = stochastic-bilinear reprojection, 2 = motion-scaled
  // confidence, 4 = spatial reuse under motion; 0 = the estimator as it was) and its three knobs, for the console / the harnesses (`__gim.run(tag, {extra: {restirMotion: 3}})` measures it)
  (window as any).__dmo = {
    knobs: () => { const S = engine.settings; return { motion: S.restirMotion, v: S.restirMotionV, min: S.restirMotionMin, px: S.restirMotionPx, dither: S.restirMotionDither, taps: S.restirMotionTaps, static: S.restirMotionStatic, live: engine.passes.restirMotionLive }; },
    set: (k: Partial<{ motion: number; v: number; min: number; px: number; dither: boolean; taps: number; static: boolean }>) => { const S = engine.settings; if (k.motion !== undefined) S.restirMotion = Math.max(0, Math.min(7, k.motion | 0)); if (k.v !== undefined) S.restirMotionV = k.v; if (k.min !== undefined) S.restirMotionMin = k.min; if (k.px !== undefined) S.restirMotionPx = k.px; if (k.dither !== undefined) S.restirMotionDither = !!k.dither; if (k.taps !== undefined) S.restirMotionTaps = k.taps; if (k.static !== undefined) S.restirMotionStatic = !!k.static; return (window as any).__dmo.knobs(); },
    get on() { return engine.settings.restirMotion; }, set on(v: number) { engine.settings.restirMotion = Math.max(0, Math.min(7, v | 0)); },
    summary: () => { const S = engine.settings; const m = S.restirMotion; return m ? `restir motion ${m} = ${[m & 1 ? 'stochastic-bilinear reprojection' : '', m & 2 ? `confidence whole under ${S.restirMotionV} px @1000 rows, × ${S.restirMotionMin} past ${(S.restirMotionV * 1.6).toFixed(2)}` : '', m & 4 ? `spatial past ${S.restirMotionPx} px${S.restirMotionTaps ? ` × ≥ ${S.restirMotionTaps} taps` : ''}` : ''].filter(Boolean).join(' + ')} · ${engine.passes.restirMotionLive ? 'LIVE this frame' : S.restirMotionStatic ? 'live' : 'the camera is still: main\'s program'}${S.restir ? '' : ' (restir itself is OFF)'}` : 'restir motion off — the reservoir reprojection as it was (nearest texel, full confidence)'; },
  };
  { let lastHint = -10; input.onLockedInput = () => { const now = performance.now() / 1000; if (show() && now - lastHint > 3) { lastHint = now; game.msg(demo.active ? 'hands-off tour — P to stop · Esc to pause' : 'hands-off showcase — P to stop · Esc to pause'); } }; }
  const quality = new Quality(engine, smoke); window.__quality = quality;
  { const qp = new URLSearchParams(location.search).get('quality'); if (qp && (QUALITY_NAMES as string[]).includes(qp)) { quality.auto = false; quality.climbAllowed = false; quality.apply(qp as QualityName); } }   // ?quality= pins for this visit without touching the remembered choice
  { // the SDF CHARACTER RIG's two extras from the URL (the fitted round cones themselves are every ray's character test, no switch): ?sdfsmooth = the smooth-union closest hit in reflections ·
    // ?charsoft = the analytic soft-shadow character visibility in the direct estimators (?charsoftmarch = its sphere-marched form). No preset touches either, so they hold for the visit.
    const q = new URLSearchParams(location.search); const S = engine.settings;
    if (q.has('sdfsmooth')) S.sdfRigSmooth = true;
    if (q.has('charsoft') || q.has('charsoftmarch')) { S.charSoftShadow = true; S.charSoftAnalytic = !q.has('charsoftmarch'); }
    if (q.has('noselfshadow')) S.charSelfShadow = false;   // ?noselfshadow: a man's own body never shadows him (the owner skip whole) — the frame as it was before the self-shadow rule, for A/B
  }
  // __sdfrig: the SDF character rig for the console / automation — the extras' switches, the knobs, the fit table
  (window as any).__sdfrig = {
    get smooth() { return engine.settings.sdfRigSmooth; }, set smooth(v: boolean) { engine.settings.sdfRigSmooth = !!v; },
    get soft() { return engine.settings.charSoftShadow; }, set soft(v: boolean) { engine.settings.charSoftShadow = !!v; },
    get analytic() { return engine.settings.charSoftAnalytic; }, set analytic(v: boolean) { engine.settings.charSoftAnalytic = !!v; },
    get self() { return engine.settings.charSelfShadow; }, set self(v: boolean) { engine.settings.charSelfShadow = !!v; },   // character self-shadow (rigCfg bit 64; default on)
    /** are the proxies the FITTED cones? (a fit attached; false = the game's hand capsules traced as untapered cones) */
    get live() { return engine.sdfRigOn; },
    fit: () => engine.rigFit, table: () => engine.rigFit ? rigTable(engine.rigFit) : '(no fit attached)',
    knobs: () => { const S = engine.settings; return { smooth: S.sdfRigSmooth, k: S.sdfRigK, steps: S.sdfRigSteps, soft: S.charSoftShadow, analytic: S.charSoftAnalytic, softSteps: S.charSoftSteps, softK: S.charSoftK, minDeg: S.charSoftMinDeg, softSmooth: S.charSoftSmooth, broad: S.charSoftBroad, self: S.charSelfShadow }; },
    set: (k: Partial<{ smooth: boolean; k: number; steps: number; soft: boolean; analytic: boolean; softSteps: number; softK: number; minDeg: number; softSmooth: boolean; broad: boolean; self: boolean }>) => { const S = engine.settings; if (k.self !== undefined) S.charSelfShadow = !!k.self; if (k.broad !== undefined) S.charSoftBroad = !!k.broad; if (k.smooth !== undefined) S.sdfRigSmooth = !!k.smooth; if (k.k !== undefined) S.sdfRigK = k.k; if (k.steps !== undefined) S.sdfRigSteps = k.steps; if (k.soft !== undefined) S.charSoftShadow = !!k.soft; if (k.analytic !== undefined) S.charSoftAnalytic = !!k.analytic; if (k.softSteps !== undefined) S.charSoftSteps = k.softSteps; if (k.softK !== undefined) S.charSoftK = k.softK; if (k.minDeg !== undefined) S.charSoftMinDeg = k.minDeg; if (k.softSmooth !== undefined) S.charSoftSmooth = !!k.softSmooth; return (window as any).__sdfrig.knobs(); },
    summary: () => { const S = engine.settings; return `sdf rig: round cones ${engine.sdfRigOn ? 'FITTED' : 'unfitted (no fit attached: hand radii, untapered)'} · reflections ${S.sdfRigSmooth ? `smooth union (k ×${S.sdfRigK}, ${S.sdfRigSteps} steps${engine.settings.rtMeshHits && engine.meshShadowsOn ? ' — superseded by mesh hits' : ''})` : engine.settings.rtMeshHits && engine.meshShadowsOn ? 'mesh hits' : 'round cones'} · direct-light character shadows ${S.charSoftShadow ? `SOFT QUERY (${S.charSoftAnalytic ? 'analytic' : `march ${S.charSoftSteps} steps${S.charSoftSmooth ? ', smooth union' : ''}`}, angular ×${S.charSoftK}, ≥ ${S.charSoftMinDeg}°)` : engine.meshShadowsOn ? 'ray-traced (mesh)' : 'ray-traced'}${S.charSelfShadow ? ' + self-shadow' : ''}`; },
  };
  quality.applyMotionCalm(!new URLSearchParams(location.search).has('nomotioncalm'));   // the motion-calm bundle is the DEFAULT since 08-12 (the designer: 'seems to fix a lot of the direct lighting noise issues tbh. looks great'); ?nomotioncalm / Tab ▸ Frame / __gimo.calm(false) = every row as the preset has it (?motioncalm still parses, now a no-op)   // ?motioncalm: the GI-in-motion lane's opt-in bundle of direct-chain / resolve rows that calm the picture under camera motion (quality.ts MOTION_CALM, docs/internal/gi-motion.md §5) — for the designer to judge by eye; re-applied after preset changes   // ?quality= pins for this visit without touching the remembered choice — and holds the ladder's headroom climb off (the rows the harnesses / A/B pages measure stay the preset's; a menu pin keeps the climb)
  if (new URLSearchParams(location.search).has('meshShadows')) engine.settings.meshShadows = true;   // ?meshShadows: on by hand whatever the preset (ultra carries it anyway; auto's ladder re-applies presets and will clear it — pin ?quality= to keep it)
  if (new URLSearchParams(location.search).has('nodecals')) { engine.settings.decals = false; game.decals.enabled = false; }   // ?nodecals: the decal experiment (E1, on by default in its branch) off from boot — nothing recorded, nothing uploaded, the g-buffer as it was
  // __mark: the MARKINGS lane (scene/markings.ts) for the console / automation — on/off, the knobs, a box's packed records, the table's stats, the lights registered for emissive markings
  (window as any).__mark = {
    get on() { return engine.settings.markings; }, set on(v: boolean) { engine.settings.markings = !!v; },
    get texel() { return engine.settings.markingTexel; }, set texel(v: number) { engine.settings.markingTexel = v; },
    knobs: () => { const S = engine.settings; return { on: S.markings, texel: S.markingTexel, contrast: S.markingContrast, emissive: S.markingEmissive, reflect: S.markingReflect, cone: S.markingReflCone, pattern: S.markingReflPattern }; },
    set: (k: Partial<{ on: boolean; texel: number; contrast: number; emissive: number; reflect: boolean; cone: number; pattern: boolean }>) => { const S = engine.settings; if (k.on !== undefined) S.markings = k.on; if (k.texel !== undefined) S.markingTexel = k.texel; if (k.contrast !== undefined) S.markingContrast = k.contrast; if (k.emissive !== undefined) S.markingEmissive = k.emissive; if (k.reflect !== undefined) S.markingReflect = k.reflect; if (k.cone !== undefined) S.markingReflCone = k.cone; if (k.pattern !== undefined) S.markingReflPattern = k.pattern; return (window as any).__mark.knobs(); },
    /** the markings + packed records of static box i (or of the box under the cursor with no argument) */
    list: (i?: number) => { const w = engine.world; let b = i === undefined ? null : w.statics[i] ?? null; if (i === undefined) { const cam = window.__cam; const hit = cam ? w.raycast(cam.pos, v3.normalize(v3.sub(game.aimPoint, cam.pos)), 200) : null; b = hit ? w.all[hit.index] : null; } if (!b) return null; return { name: b.name, c: b.c, h: b.h, marks: b.marks ?? [], records: w.markRecordsOf(b) }; },
    /** every static box index that carries markings, with its kinds */
    marked: () => engine.world.statics.map((b, i) => b.marks?.length ? { i, name: b.name, marks: b.marks.map(m => `${m.size[0]}×${m.size[1]}${m.res ? ' ' + m.res : ''}@${m.face}`) } : null).filter(Boolean),
    /** print a box's markings as ASCII art (static index, or the box under the cursor) */
    art: (i?: number) => { const L = (window as any).__mark.list(i); if (!L) return null; return L.marks.map((m: any) => `${m.face} ${m.res ?? 'base'} at ${m.at} ${m.size[0]}×${m.size[1]}\n${m.cells.join('\n')}`).join('\n\n'); },
    get stats() { return engine.world.markStatsInfo; }, get lights() { return game.markLights; },
    summary: () => { const S = engine.settings, st = engine.world.markStatsInfo; return `markings ${S.markings ? 'on' : 'off'} · texel ${(S.markingTexel * 100).toFixed(1)} cm · contrast ${S.markingContrast} · emissive ×${S.markingEmissive}${S.markingReflect ? ` · in reflections (cone +${S.markingReflCone}·α)` : ''} · ${st.lists} lists / ${st.records} records / ${st.rows} rows / ${st.boxes} marked boxes this frame${st.dropped ? ` · ${st.dropped} DROPPED` : ''} · ${game.markLights.length} marking light(s)`; },
  };
  window.__marks = { test: () => sprayTestPattern(game), random: (n = 100, seed = 1) => sprayRandom(game, n, seed), clear: () => game.decals.clear(),   // automation: the panel's decal buttons by hand (E1) …
    bang: (p: Vec3) => bangScorch(game, p), scuff: (door: string, from?: Vec3) => { const d = game.doors.byName(door); if (d) kickScuff(game, d, from ?? game.player.char.pos); return !!d; } };   // … and the two staged marks a capture script cannot easily cause for real: a stun scorch at p, the kick's scuff on a named leaf from `from`'s side
  if (new URLSearchParams(location.search).has('noparticles')) engine.settings.gpuParticles = false;   // ?noparticles: the E4 experiment off at boot — the CPU box sparks exactly as they were (Tab ▸ 'Renderer — particles (EXP)' flips it live)
  // __particles: the GPU particle system for the console / automation — stats (alive / asleep / windows / rates), the live per-kind numbers, a test burst at a world
  // point (or the cursor's), and the raw emit (kind, pos, dir, count, opts) — see render/particles.ts / game/particleFx.ts
  (window as any).__particles = {
    get sys() { return engine.particles; }, get stats() { return engine.particles?.stats; }, get params() { return engine.particles?.params; },
    get on() { return engine.particlesOn; }, set on(v: boolean) { engine.settings.gpuParticles = !!v; },
    test: (kind: 'sparks' | 'debris' | 'dust' | 'casings' | 'bang' | 'sheets' = 'sparks', at?: Vec3) => testBurst(game, kind, at ?? game.aimPoint),
    emit: (kind: PKind, pos: Vec3, dir: Vec3, count: number, o: EmitOpts) => engine.particles?.emit(kind, pos, dir, count, o) ?? 0,
    /** the raw impulse (render/particles.ts impulse: pos, radius m, strength m/s, { up, bias, kinds, occlude, eye }) — the destruction lane's game events go through __destr.kick */
    impulse: (pos: Vec3, radius: number, strength: number, o?: ImpulseOpts) => engine.particles?.impulse(pos, radius, strength, o) ?? false,
    get impulseResponse() { return engine.particles?.impulseResponse; }, get pendingImpulses() { return engine.particles?.pendingImpulses; },
    clear: () => engine.particles?.clear(),
  };
  // __destr: the destruction lane (game/destruction.ts) for the console / automation — the knob, the counters, the log, the debris pool, the index, a staged bang / burst
  { const dm = destrMod;
    (window as any).__destr = {
      get chaos() { return game.tune.chaos; }, set chaos(v: number) { game.tune.chaos = Math.max(0, Math.min(1, Number(v) || 0)); },   // (NOT persisted: a measurement script's chaos must not become this profile's default — save() does that on purpose)
      save: () => dm.saveChaos(game),
      get stats() { return dm.DESTR_STATS; }, get log() { return dm.DESTR_LOG; }, get knobs() { return dm.CHAOS; },
      get debris() { const D = game.destr.debris; return { n: D.list.length, moving: D.moving, cap: D.cap(), stats: D.stats, kinds: D.list.map(c => c.kind) }; },
      inventory: () => game.destr.inventory(), summary: () => game.destr.summary(),
      heat: (p?: Vec3) => game.destr.heatAt(p ?? game.aimPoint), escalation: (p?: Vec3) => game.destr.escalationAt(p ?? game.aimPoint),
      /** a stun charge's worth of destruction at p (no flash, no dazzle): the desk cleared, papers up, the tile above down */
      bang: (p?: Vec3) => game.destr.bang(p ?? game.aimPoint),
      /** the IMPULSE of an event alone at p (kind 'bang' | 'impact' | 'thud'; dir = the round's travel for 'impact'): only what already lies about moves */
      kick: (p?: Vec3, kind: 'bang' | 'impact' | 'thud' = 'bang', dir?: Vec3) => game.destr.testImpulse(p ?? [...game.aimPoint] as Vec3, kind, dir),
      get impulses() { return game.tune.debrisImpulses !== false; }, set impulses(v: boolean) { game.tune.debrisImpulses = !!v; },
      /** `n` FN2000 rounds from Sam's muzzle at p, one per `every` frames of stepped game time (a scripted burst for captures / cost takes; god mode advised) */
      burst: (p?: Vec3, n = 12, every = 6) => { const tgt = p ?? [...game.aimPoint] as Vec3; for (let k = 0; k < n; k++) { if (k) window.__runFrames!(every, 1 / 60); fireWeapon(game, game.player.char, tgt, true, { weapon: WEAPONS.fn2000 }); } return n; },
      reset: () => game.destr.reset(), defaults: () => dm.resetChaosKnobs(game),
    }; }
  // __wind: the wind (game/wind.ts) for the console / automation — the master, the field at a point, every source's numbers, the knobs, the moths beside it
  (window as any).__wind = {
    get on() { return game.tune.wind; }, set on(v: number | boolean) { game.tune.wind = Math.max(0, Math.min(1, Number(v) || 0)); },   // (NOT persisted: a script's still air must not become the profile's default — save() does that on purpose)
    /** the air's velocity (m/s) at p — the cursor's point 5 cm up by default — summed over every active source (the CPU copy of what both GPU consumers evaluate) */
    at: (p?: Vec3) => game.wind.at(p ?? v3.add(game.aimPoint, [0, 0.05, 0])),
    sources: () => game.wind.all.map(s => ({ name: s.name, why: s.why, kind: s.kind, on: s.on, gust: s.gust, base: s.base, speed: s.speed, pos: [...s.pos], dir: [...s.dir], reach: s.reach, dMax: s.dMax, r0: s.r0, tanSpread: s.tanSpread })),
    active: () => game.wind.active.map(s => s.name), describe: () => game.wind.describe(), byName: (n: string) => game.wind.byName(n),
    get knobs() { return windMod.WIND; }, get field() { return windMod.WIND_FIELD; }, get stats() { return windMod.WIND_STATS; },
    set: (k: Record<string, number | boolean>) => { for (const [key, v] of Object.entries(k)) if (key in windMod.WIND && typeof (windMod.WIND as any)[key] === typeof v) (windMod.WIND as any)[key] = v; return windMod.WIND; },
    save: () => windMod.saveWind(game), defaults: () => windMod.resetWindKnobs(game), summary: () => game.wind.summary(),
    /** the CPU field of ONE jet by hand (pos, dir, speed, reach, tanSpread, r0, dMax, floorY, p) — the probes' cross-check against the WGSL text */
    jet: windMod.jetVel, storm: windMod.stormVel,
    get moths() { return { on: game.tune.moths !== false, knobs: mothsMod.MOTHS, stats: mothsMod.MOTH_STATS, summary: game.moths.summary() }; },
    setMoths: (on: boolean) => { game.tune.moths = !!on; },
  };
  // __wet: the wet characters (game/wet.ts) for the console / automation — everybody's numbers, soak / dry by hand, the knobs, the renderer's switch
  (window as any).__wet = {
    get on() { return engine.settings.wetChars; }, set on(v: boolean) { engine.settings.wetChars = !!v; },
    /** i: −1 / 'sam' = Sam, else Game.guards[i] → { wet, beads, rain, inRain, openSky } */
    get: (i: number | 'sam' = 'sam') => { const c = i === 'sam' || i < 0 ? game.player.char : game.guards[i]?.char; return c ? { wet: c.wet, beads: c.beads, rain: c.wetRain, line: c.wetLine, inRain: wetMod.inRain(game, c), openSky: wetMod.openSky(game, c) } : null; },
    /** soak one man through as if he had just stepped in out of a downpour (wet, beads default = wet); `line` (bind-pose m above the sole) = wet only up to there, as if he had waded — set('sam', 1, 0, 0, 0.55) = to the knee */
    set: (i: number | 'sam' = 'sam', wet = 1, beads = wet, rain = 0.8, line = Infinity) => { const c = i === 'sam' || (i as number) < 0 ? game.player.char : game.guards[i as number]?.char; if (!c) return false; wetMod.soak(game, c, wet, beads, rain, line); return true; },
    soakAll: (wet = 1) => { for (const c of wetMod.everyCharacter(game)) wetMod.soak(game, c, wet); }, dry: () => wetMod.dryAll(game),
    knobs: wetMod.WET, save: () => wetMod.saveWet(), reset: () => wetMod.resetWet(), stats: wetMod.WET_STATS, prints: () => wetMod.wetPrints(game), summary: () => game.wetSummary(),
  };
  // PARTICLE RAIN (game/rainFx.ts + the 'rain' particle kind; Tab ▸ Weather & wind ▸ Rain — particles flips it live) — the near-field layer of real GPU drops over the lattice rain is ON by default:
  // ?norain2 boots without it (the lattice rain alone, the frame as it was before the layer); ?rainv1 boots the layer with its v1 LOOK (grey isotropic scatter, no glint / refraction / spread,
  // plumb fall — for the visit only, nothing saved); ?prain (the prototype's switch) still forces it on
  { const qs = new URLSearchParams(location.search);
    if (qs.has('norain2')) engine.settings.particleRain = false;
    if (qs.has('prain')) engine.settings.particleRain = true;
    rainMod.loadPrain();   // its v2 look / wind knobs kept per machine (the Rain — particles rows)
    if (qs.has('rainv1')) rainMod.setPrain(rainMod.PRAIN_V1_LOOK); }
  // __hotRain(): rebuild the particles' three pipelines from particles_common / particles / particles_draw.wgsl as they are on disk (the rain look's kernels + splat under a staged storm, no reboot)
  (window as any).__hotRain = async () => { const P = engine.particles; if (!P) return { ok: false, messages: ['no particles'] }; const f = (n: string) => fetch('/qa/shader/' + n, { cache: 'no-store' }).then(r => r.text()); const [c, a, d, rf] = await Promise.all([f('particles_common.wgsl'), f('particles.wgsl'), f('particles_draw.wgsl'), f('refract_common.wgsl')]); return P.hotSwapAll(c, a, d, rf); };
  // __rain: particle rain for the console / automation — on/off, the knobs by name, the recycler's numbers, the ring's, the drip lines, a reseed; v2: .look / .setLook({}) / .resetLook() (PRAIN), .wind (the air it rides + the lattice's lean)
  (window as any).__rain = {
    get look() { return rainMod.PRAIN; }, setLook: (k: Record<string, number>) => { const r = rainMod.setPrain(k as any); rainMod.savePrain(); return r; }, resetLook: () => { rainMod.resetPrain(); return rainMod.PRAIN; }, get lookDefaults() { return rainMod.PRAIN_DEFAULTS; },
    get wind() { return rainMod.rainWind(game); }, get sceneCopy() { return engine.particles?.rainSceneCopy ?? 'none'; },
    get on() { return engine.settings.particleRain; }, set on(v: boolean) { engine.settings.particleRain = !!v; },
    knobs: () => { const S = engine.settings; return { on: S.particleRain, count: S.particleRainCount, radius: S.particleRainRadius, density: S.particleRainDensity, bright: S.particleRainBright, drips: S.particleRainDrips, lattice: S.particleRainLattice, react: S.particleRainReact }; },
    set: (k: Partial<{ on: boolean; count: number; radius: number; density: number; bright: number; drips: boolean; lattice: number; react: number }>) => { const S = engine.settings; if (k.on !== undefined) S.particleRain = !!k.on; if (k.count !== undefined) S.particleRainCount = k.count; if (k.radius !== undefined) S.particleRainRadius = k.radius; if (k.density !== undefined) S.particleRainDensity = k.density; if (k.bright !== undefined) S.particleRainBright = k.bright; if (k.drips !== undefined) S.particleRainDrips = !!k.drips; if (k.lattice !== undefined) S.particleRainLattice = k.lattice; if (k.react !== undefined) S.particleRainReact = k.react; return (window as any).__rain.knobs(); },
    get stats() { return rainMod.rainStats(game); }, get ring() { return engine.particles?.rainStats ?? null; }, get fx() { return rainMod.RAIN_FX; },
    drips: () => rainMod.rainDripPoints(game), seed: (n = 1) => rainMod.seedRain(game, n), summary: () => rainMod.rainSummary(game),
  };
  // __taa: the TAAU resolve for the console / automation — on/off, the knobs, this frame's jitter, the reset count and why, the sizes
  (window as any).__taa = {
    get on() { return engine.settings.taau; }, set on(v: boolean) { engine.settings.taau = !!v; },
    get jitter() { return [...engine.jitter]; }, get resets() { return engine.taaResets; }, get lastReset() { return engine.lastTaaReset; }, get stats() { return engine.passes.taaStats; },
    reset: (why = 'by hand') => engine.resetTaa(why), knobs: () => { const S = engine.settings; return { alpha: S.taauAlpha, clipGamma: S.taauClipGamma, phases: S.taauPhases, sharpen: S.taauSharpen, reactive: S.taauReactive, kernel: S.taauKernel, velK: S.taauVelK, lightJump: S.taauLightJump, motionAlpha: S.taauMotionAlpha, motionClip: S.taauMotionClip, sharpenMotion: S.taauSharpenMotion }; },
    set: (k: Partial<{ alpha: number; clipGamma: number; phases: number; sharpen: number; reactive: number; kernel: number; velK: number; lightJump: number; motionAlpha: number; motionClip: number; sharpenMotion: number }>) => { const S = engine.settings; if (k.alpha !== undefined) S.taauAlpha = k.alpha; if (k.clipGamma !== undefined) S.taauClipGamma = k.clipGamma; if (k.phases !== undefined) S.taauPhases = k.phases; if (k.sharpen !== undefined) S.taauSharpen = k.sharpen; if (k.reactive !== undefined) S.taauReactive = k.reactive; if (k.kernel !== undefined) S.taauKernel = k.kernel; if (k.velK !== undefined) S.taauVelK = k.velK; if (k.lightJump !== undefined) S.taauLightJump = k.lightJump; if (k.motionAlpha !== undefined) S.taauMotionAlpha = k.motionAlpha; if (k.motionClip !== undefined) S.taauMotionClip = k.motionClip; if (k.sharpenMotion !== undefined) S.taauSharpenMotion = k.sharpenMotion; return (window as any).__taa.knobs(); },
    summary: () => `taau ${engine.settings.taau ? 'on' : 'off'} · ${engine.width}×${engine.height} → ${engine.outWidth}×${engine.outHeight} · jitter ${engine.jitter.map(v => v.toFixed(3)).join(',')} · ${engine.passes.taaStats.frames} resolves, ${engine.taaResets} resets (last: ${engine.lastTaaReset || '—'})`,
  };
  // __dn: the denoiser (renderer v3 phase 3) for the console / automation — which core, the v3 clients' knobs in one object, the last frame's dispatch counts
  (window as any).__dn = {
    get mode() { return engine.settings.denoiser; }, set mode(v: 'v3' | 'legacy') { engine.settings.denoiser = v === 'legacy' ? 'legacy' : 'v3'; },
    get stats() { return engine.passes.den.stats; },
    knobs: () => { const S = engine.settings; return { shadowIters: S.dnShadowIters, shadowCap: S.dnShadowCap, shadowClampK: S.dnShadowClampK, shadowSigmaL: S.dnShadowSigmaL, shadowPrior: S.dnShadowPrior, shadowLitAlike: S.dnShadowLitAlike, shadowMoveCap: S.dnShadowMoveCap, shadowMoveThresh: S.dnShadowMoveThresh, giIters: S.dnGiIters, giCap: S.dnGiCap, giClampK: S.dnGiClampK, giSigmaL: S.dnGiSigmaL, giFast: S.dnGiFast, giFirefly: S.dnGiFirefly, specIters: S.dnSpecIters, specCap: S.dnSpecCap, specClampK: S.dnSpecClampK, specSigmaL: S.dnSpecSigmaL, specRough: S.dnSpecRough, depthK: S.dnDepthK, normalPow: S.dnNormalPow, motionVectors: S.dnMotionVectors }; },
    set: (k: Record<string, number | boolean>) => { const S = engine.settings as unknown as Record<string, unknown>; for (const [key, v] of Object.entries(k)) { const name = 'dn' + key[0].toUpperCase() + key.slice(1); if (name in S) S[name] = v; } return (window as any).__dn.knobs(); },
    summary: () => { const S = engine.settings, st = engine.passes.den.stats; return `denoiser ${S.denoiser} · shadow ${S.dnShadowIters} it / cap ${S.dnShadowCap} · gi ${S.dnGiIters} it / cap ${S.dnGiCap} (fast ${S.dnGiFast}) · spec ${S.dnSpecIters} it / cap ${S.dnSpecCap} · mv ${S.dnMotionVectors && S.taau ? 'on' : 'off'} · last frame ${st.shadow}+${st.gi}+${st.spec} dispatches`; },
  };
  if (new URLSearchParams(location.search).has('noglass')) engine.settings.glass = false;   // ?noglass: the glass panes off from boot (the panes become the empty openings the level had) — for A/B against a plain boot
  if (new URLSearchParams(location.search).has('norefract')) engine.settings.glassRefract = false;   // ?norefract: the glass boxes' refraction off from boot (the panes' old tint rule, the read under the pixel — the frame byte for byte as it was) for A/B
  // __rigTrace(rays): the SDF character rig's production WGSL over the live scene for a list of rays (render/rigDebug.ts): rays = [[Po.xyz, tmax, L.xyz, tanHalf], …] →
  // per ray { vis (charSoftVis), resA / resM (the analytic / marched raw ratios), occ (occludedCapsules), t / idx (traceCapsules), tRig / ch (rigClosest) } — the CPU twin's check
  (window as any).__rigTrace = async (rays: number[][]) => {
    const flat = new Float32Array(rays.length * 8); rays.forEach((r, i) => flat.set(r.slice(0, 8), i * 8));
    const out = await rigDebugTrace(gpu.device, engine.sceneLayout, engine.sceneBindGroup(), flat);
    return rays.map((_, i) => ({ vis: out[i * 8], resA: out[i * 8 + 1], resM: out[i * 8 + 2], occ: out[i * 8 + 3], t: out[i * 8 + 4], idx: out[i * 8 + 5], tRig: out[i * 8 + 6], ch: out[i * 8 + 7] }));
  };
  // __meshTrace(fixture): replay tools/qa/mesh-shadow-fixture.json on the GPU — poses skin slot 0 with the fixture's joint matrices, refits, runs the PRODUCTION
  // WGSL walk (common.wgsl meshAnyHitChar via a tiny kernel on the scene bind group) over its 64 rays and compares with the CPU reference's answers ray for
  // ray. Use on a ?paused page (it borrows character slot 0's joints until the next stepped frame rewrites them). Resolves to a summary + the mismatching rays.
  window.__meshTrace = async (fixture: { digest: string; joints: number[]; rays: number[][]; expect: number[]; nodes: number }) => {
    const ms = engine.meshShadows; if (!ms) return { error: 'no MeshShadows attached' };
    if (!engine.meshShadowsAvailable) return { error: 'mesh binding unavailable on this adapter (storage-buffer budget)' };
    const out = await ms.debugTrace(engine.sceneLayout, engine.sceneBindGroup(), new Float32Array(fixture.joints), new Float32Array(fixture.rays.flat()));
    const rows = fixture.rays.map((_, i) => ({ i, expect: fixture.expect[i], got: out[i * 4], all: out[i * 4 + 1] }));
    const blockedMismatch = rows.filter(r => (r.expect >= 0) !== (r.got >= 0));
    const tMismatch = rows.filter(r => r.expect >= 0 && r.got >= 0 && Math.abs(r.expect - r.got) > 1e-3);
    return { digestOk: fixture.digest === ms.digest, digest: ms.digest, nodesGpu: out[2], nodesFixture: fixture.nodes, rays: rows.length, blockedExpected: rows.filter(r => r.expect >= 0).length, blockedGot: rows.filter(r => r.got >= 0).length, blockedMismatch, tMismatch, maxAbsDt: Math.max(0, ...rows.filter(r => r.expect >= 0 && r.got >= 0).map(r => Math.abs(r.expect - r.got))) };
  };
  const panel = new Panel();
  buildPanel(panel, engine, game, smoke, cam, overlay, audio, quality, () => ({ fps: fpsSm, union: unionSm }));   // (the status strip reads the frame loop's own smoothed numbers — only ever called from the panel's refresh, long after they exist)
  input.keyVeto = e => panel.onKey(e);   // ← / → and [ / ] over the open panel walk its systems, a typed letter opens its search — before the game reads the key
  (window as any).__panel = panel;
  const hud = document.getElementById('hud')!;
  const tourVeil = document.getElementById('veil')!;   // black fade the tour raises around its cuts
  // start card now, pause menu on Esc (settings + controls); the simulation freezes while it is open, the frame keeps rendering
  let gestured = false;   // a real person has touched the page (audio may start; an autoplay-blocked context would otherwise queue every sound of an unattended tour at t=0 and fire them all on the first key)
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) window.addEventListener(ev, () => { gestured = true; }, { capture: true, passive: true });
  // checkpoints (game/savestate.ts): loading a stored slot from a card / the panel / the console — any show stopped first (its beat must not puppet the loaded
  // encounter), attract put back in its box, then the load, the camera cut onto Sam where the file has him (the follow cam's cut rule drops the TAA history)
  const loadCheckpoint = (key: string): string | null => { attract.poke(); if (demo.active) demo.stop(); if (game.director.showing) game.director.stop(); const why = game.saves.load(game, key); if (!why) { cam.target = v3.copy(game.followPos()); cam.pin = null; input.keys.clear(); input.buttons = 0; } return why; };
  loadSandbox(game);   // the start card's sandbox row (god mode / no AI / unlimited ammo) as this machine last left it
  try { const v = localStorage.getItem('twopointsix.ocpNotice'); if (v === 'glance' || v === 'investigate') game.tune.ocpNotice = v; } catch { /* */ }   // the OCP'd-light rule (Tab ▸ Sandbox ▸ Detection) as this machine last left it
  const menu = new Menu({ engine, game, quality, audio, overlay, startTour: () => { if (breach.active) breach.stop(); if (demo.active) demo.stop(); startNight(); }, stopTour: () => { if (demo.active) demo.stop(); if (game.director.showing) game.director.stop(); }, focusGame: () => input.focusGame(), onStart: () => { attract.poke(); if (gestured) audio.start(); },
    startBreach: breach.available ? () => { if (!demo.active && !game.director.showing) breach.start(); } : undefined, loadCheckpoint });   // (the card's NIGHT SHOWCASE = the level script's program 'night'; DAY SHOWCASE = its 'breach'; each ends whatever else is running first, and neither starts over the other)
  window.__menu = menu;
  // __save: the checkpoints for the console / automation — save now (manual slot; force lets go of Sam's hands in the file), load the newest / a slot key / a
  // parsed state, the slot list, export (the newest slot's JSON text), import (text → the manual slot), clear, autosave on/off, the controller's line and log
  (window as any).__save = {
    save: (label = 'by hand', force = false) => { automated = true; return game.saves.write(game, 'manual', label, force); },
    load: (what?: string | object) => { automated = true; const key = typeof what === 'string' ? what : what ? null : game.saves.newest(false)?.key; if (what && typeof what === 'object') return loadCheckpoint2(what); return key ? loadCheckpoint(key) : 'nothing stored'; },
    slots: () => game.saves.slots(), newest: () => game.saves.newest(false),
    export: (key?: string) => { const k = key ?? game.saves.newest(false)?.key; return k ? game.saves.store.get(k) : null; },
    import: (text: string) => game.saves.importText(game, text), clear: () => game.saves.clear(),
    get auto() { return game.saves.enabled; }, set auto(v: boolean) { game.saves.setEnabled(!!v); },
    get state() { return game.saves; }, get log() { return game.saves.log; }, summary: () => game.saves.summary(game),
    canSave: (force = false) => saveMod.canSave(game, force), snapshot: (force = true) => saveMod.saveState(game, { label: 'console', kind: 'harness', force }),
  };
  const loadCheckpoint2 = (state: object): string | null => { attract.poke(); if (demo.active) demo.stop(); if (game.director.showing) game.director.stop(); const why = game.saves.load(game, state as never); if (!why) { cam.target = v3.copy(game.followPos()); cam.pin = null; } return why; };
  breach.onStop = (finished) => { syncShowClass(); if (!seeking && menu.mode !== 'start') menu.open('start'); void finished; };   // (both showcases end on the start card whether they ran out or were quit — the designer, 08-13; a chapter SEEK restarts the program under the hood and must not flash the card)   // it ran to its end: back to the start card over the fresh night encounter it has just put back (cut off with P, the floor is live like an aborted tour)
  quality.onCalibrated = () => menu.refreshQualityNote();   // 'auto' picked on the pause card calibrates behind it: the card's note follows when it settles
  // attract mode (game/attract.ts): the start card left alone for a few seconds shows the place off by itself — the camera cuts round a loop of the tour's framings
  // while the patrols walk through them — and the first key, click, wheel tick or real mouse movement puts the card's own still view straight back (a fresh
  // encounter, the camera on Sam) and restarts the clock. Start card only: never over the pause / debrief card, never while the tour runs or auto quality is still
  // calibrating behind the card, never on a hidden tab, and never on a page automation is driving (?paused / __testVisible / any scripted hook below).
  let automated = testMute;   // any scripted hook used once (or the automation profile's mute flag): this page is a test rig, not a visitor
  // after ONE full pass of the attract programme (~49 s of nobody touching anything on the start card) hand over to the showcase tour — the old 25 s auto-start's
  // intent, without yanking the card from a reader mid-sentence or cutting a vantage off: attract stops itself, the card closes the way its own button closes it
  const attract = new Attract(game, cam, () => menu.mode === 'start' && !demo.active && !game.director.showing && !quality.calibrating && !automated && !window.__pauseLoop && !window.__testVisible && !document.hidden,
    (loops) => { if (loops >= 1) { if (!SHOWCASE_BUTTONS) return; attract.stop(); menu.close(); if (!demo.active && !game.director.showing) { if (!startNight()) unattended = true; else menu.open('start'); } } },   // (showcases off the menus for now: attract keeps cutting round the level instead of handing over)   // (a refused start — script disarmed, a unit on the floor — puts the card straight back: attract re-arms off it instead of stranding a live floor nobody is at)   // after a full pass of the attract programme with nobody here: the night showcase, and — nobody having touched anything by its end — the start card again
    () => { refreshStill = true; });   // onStop: attract has just put the fresh encounter and the card's own camera back with no fade — the next frozen frame must show THAT, settled (step() below)
  { // console / pane entry points obey the same rules as the start card's buttons: never over the tour or each other, and attract is put back in its box
    // first — __breach.start() with the card's attract live otherwise let Attract.stop() reset the guards over the hired cast and froze the show (review 08-10 #22)
    const rawB = breach.start.bind(breach); breach.start = () => { if (demo.active || game.director.showing) return; attract.poke(); if (menu.isOpen) menu.close(); rawB(); syncShowClass(); };
    const rawD = demo.start.bind(demo) as (...x: unknown[]) => void; (demo as unknown as { start: (...x: unknown[]) => void }).start = (...a: unknown[]) => { if (demo.active || game.director.showing) return; attract.poke(); rawD(...a); };
  }
  let refreshStill = false;
  let unattended = false;   // a show was started by the attract loop with nobody here: when it finishes, back to the start card (→ attract again after 6 s) rather than a live floor nobody plays — a visitor arriving mid-show (any poke) keeps the normal live hand-over
  demo.onStop = (finished) => { if (unattended && finished && menu.mode !== 'start') menu.open('start'); unattended = false; };
  (window as any).__attract = attract;
  for (const ev of ['keydown', 'mousedown', 'pointerdown', 'wheel', 'touchstart']) window.addEventListener(ev, () => { unattended = false; attract.poke(); }, { capture: true, passive: true });   // (someone is here: any unattended tour in progress hands over live as tours always have)
  { let mx: number | null = null, my: number | null = null;   // (a real change of position: a still mouse can still deliver mousemove on focus and layout changes, and movementX is not reliable everywhere; the first event only takes the reading)
    let mAcc = 0, mT = 0;
    window.addEventListener('mousemove', e => { if (mx !== null && my !== null) { const dd = Math.abs(e.clientX - mx) + Math.abs(e.clientY - my); const now = performance.now(); mAcc = now - mT > 300 ? dd : mAcc + dd; mT = now; if (mAcc >= 3) { mAcc = 0; unattended = false; attract.poke(); } } mx = e.clientX; my = e.clientY; }, { capture: true, passive: true }); }   // (3 px inside 0.3 s: a sensor's 1 px jitter is not a person)
  window.addEventListener('keydown', e => { if (e.code === 'Escape' && !e.repeat) { if (!menu.isOpen && panelWantsEsc()) { (document.activeElement as HTMLElement).blur(); return; } if (!menu.isOpen && (demo.active || game.director.showing || game.director.handedOver)) { quitShow(); e.preventDefault(); return; } if (!menu.isOpen && !show() && game.escape()) { e.preventDefault(); return; } menu.toggle(); e.preventDefault(); } }, { capture: true });   // (Esc during either showcase quits it to the start card — the designer, 08-13)   // (Esc first backs out of an open Space selector / stops a running verb — the leaf being eased, the pick, the choke, the drive: game/interact.ts — and only then pauses)
  const panelWantsEsc = () => { const a = document.activeElement; return !!a && (a instanceof HTMLInputElement || a instanceof HTMLSelectElement) && !!a.closest('#panel'); };   // first Esc just releases a focused tweak-panel control; controls inside the menu never block it
  const openStartCard = !q.has('demo') && !q.has('breach');   // (opened below, once every hook is on window: that is the moment the card's buttons come alive and __ready resolves)

  let last = performance.now(); let timeAcc = 0; let fpsSm = 60; let frameCount = 0; let unionSm = 0;
  const debugNames = ['final', 'albedo', 'normals', 'direct', 'indirect', 'volumetrics', 'depth', 'dice', 'lighting', 'denoise hints', 'specular', 'restir history', 'restir rays', 'denoise state', 'rt reflections', 'material', 'gi reservoirs', 'rt raw'];   // (16 = phase 5's gather reservoirs: r M ÷ cap, g temporal taken, b spatial taps; 17 = the reflection pass's output as fetched, before the cutoff fade)   // (specular = the glossy floors' reflection term + what the glass panes add, + the ray-traced reflections, composite debug view 10; rt reflections = the traced term alone, view 14; restir history / rays = views 11 / 12, restir.wgsl's diagnostics; 13 = the v3 shadow client's σ per class + history length)

  // scripted stepping for automated testing: __runFrames(n, dt, keys[]) runs n fixed steps with the given keys held
  let scripted = false;
  window.__runFrames = (n: number, dtFixed = 1 / 60, keys: string[] = []) => { automated = true; attract.poke(); scripted = true; for (const k of keys) input.keys.add(k); for (let i = 0; i < n; i++) step(dtFixed, i === n - 1); for (const k of keys) input.keys.delete(k); scripted = false; };
  // __stage(pin | null, opts?): automation framing + staging in one call — pin = { look:[x,y,z], yaw, pitch, dist } fixes the camera verbatim (FollowCamera.pin:
  // no damping / aim lead), null releases it; opts.park = true parks every guard far away, torches off, held + pinned (the usual capture hygiene);
  // opts.guards = [{ i, pos, yaw?, torch?, aimPitch?, state? }] then places the listed ones; opts.player = { pos, yaw?, crouch?, holstered?, invisible? }.
  // Returns what it did. Pair with ?paused + __runFrames. (Renderer notes and pose checks kept framing walls because the follow cam drifted under scripts.)
  window.__stage = (pin: { look: Vec3; yaw: number; pitch: number; dist: number } | null, opts: { park?: boolean; guards?: { i: number; pos: Vec3; yaw?: number; torch?: boolean; aimPitch?: number }[]; player?: { pos?: Vec3; yaw?: number; crouch?: boolean; holstered?: boolean; invisible?: boolean } } = {}) => {
    automated = true; attract.poke();
    cam.setPin(pin);   // (validated + clamped; a release puts the free camera's yaw / pitch / zoom back — camera.ts setPin)
    if (opts.park) game.guards.forEach((gd, k) => { gd.char.pos = [-40 - k * 3, 0, -40]; gd.flashlight.enabled = false; gd.hold = true; gd.pinned = true; });
    for (const s of opts.guards ?? []) { const gd = game.guards[s.i]; if (!gd) continue; gd.char.pos = v3.copy(s.pos); if (s.yaw !== undefined) { gd.char.bodyYaw = s.yaw; gd.char.aimYaw = s.yaw; } if (s.aimPitch !== undefined) gd.char.aimPitch = s.aimPitch; if (s.torch !== undefined) gd.flashlight.enabled = s.torch; gd.hold = true; gd.pinned = true; }
    const P = opts.player; if (P) { if (P.pos) game.teleportPlayer(v3.copy(P.pos)); if (P.yaw !== undefined) { game.player.char.bodyYaw = P.yaw; game.player.char.aimYaw = P.yaw; } if (P.crouch !== undefined) { game.player.crouch = P.crouch; game.player.char.anim.crouchTarget = P.crouch ? 1 : 0; } if (P.holstered !== undefined) game.player.holstered = P.holstered; if (P.invisible !== undefined) game.playerInvisible = P.invisible; }
    return { pinned: !!cam.pin, pin: cam.pin ? { look: v3.copy(cam.pin.look), yaw: cam.pin.yaw, pitch: cam.pin.pitch, dist: cam.pin.dist } : null, parked: !!opts.park, guards: (opts.guards ?? []).length, player: !!P };   // (pin: the framing AS APPLIED — clamped)
  };
  window.__mouse = (x: number, y: number, buttons?: number) => { automated = true; attract.poke(); input.mouseX = x; input.mouseY = y; if (buttons !== undefined) input.buttons = buttons; };   // buttons: 1 LMB, 4 RMB (held)
  window.__click = (button = 0) => { automated = true; attract.poke(); input.clicked |= 1 << button; };
  window.__input = input;

  // __shot(name): render one offscreen frame, read it back and POST a JPEG to the capture server (tools/shot-server.ts) — for docs/board images
  window.__shot = async (name: string, quality = 0.86, scale = 1) => {
    engine.render(cam, timeAcc, 1 / 60, false);
    const c2 = await frameCanvas(engine); if (!c2) return 'no frame';
    let out: HTMLCanvasElement = c2;
    if (scale !== 1) { out = document.createElement('canvas'); out.width = Math.round(c2.width * scale); out.height = Math.round(c2.height * scale); const cx = out.getContext('2d')!; cx.imageSmoothingQuality = 'high'; cx.drawImage(c2, 0, 0, out.width, out.height); }
    const blob: Blob = await new Promise(res => out.toBlob(b => res(b!), 'image/jpeg', quality));
    return `${c2.width}x${c2.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // __panelShot(name, { frame, quality }): the tweak PANEL is HTML, not part of the frame __shot reads back — rasterise #panel (editor/domshot.ts: computed styles inlined into an SVG
  // foreignObject) and, unless frame:false, lay it at its own place over the rendered frame + whatever the overlay's canvases hold (the wind field's arrows), then post the JPEG
  (window as any).__panelShot = async (name: string, opts: { frame?: boolean; quality?: number; scale?: number } = {}) => {
    const { snapshotElement } = await import('./editor/domshot');
    const root = document.getElementById('panel')!; const scale = opts.scale ?? 2;
    root.classList.add('rastering'); let pc: HTMLCanvasElement; try { pc = await snapshotElement(root, scale); } finally { root.classList.remove('rastering'); }   // (index.html #panel.rastering: native sliders for the raster — their custom track / thumb are pseudo-elements it cannot carry)
    let out: HTMLCanvasElement = pc;
    if (opts.frame !== false) {
      engine.render(cam, timeAcc, 1 / 60, false); const fc = await frameCanvas(engine);
      const W = canvas.clientWidth, H = canvas.clientHeight; out = document.createElement('canvas'); out.width = Math.round(W * scale); out.height = Math.round(H * scale);
      const cx = out.getContext('2d')!; cx.imageSmoothingQuality = 'high'; cx.scale(scale, scale); cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
      if (fc) cx.drawImage(fc, 0, 0, W, H);
      for (const c of Array.from(document.querySelectorAll('#overlay canvas')) as HTMLCanvasElement[]) if (c.style.display !== 'none' && c.width > 0) cx.drawImage(c, 0, 0, W, H);
      if (!root.classList.contains('hidden')) { const r = root.getBoundingClientRect(); cx.drawImage(pc, r.left, r.top, r.width, r.height); }
    }
    const blob: Blob = await new Promise(res => out.toBlob(b => res(b!), 'image/jpeg', opts.quality ?? 0.9));
    return `${out.width}x${out.height} ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // __png(name): like __shot but lossless PNG (for pixel-exact A/B of renderer changes; pair with __pauseLoop for determinism)
  window.__png = async (name: string) => {
    engine.render(cam, timeAcc, 1 / 60, false);
    const c2 = await frameCanvas(engine); if (!c2) return 'no frame';
    const blob: Blob = await new Promise(res => c2.toBlob(b => res(b!), 'image/png'));
    return `${c2.width}x${c2.height} png ${(blob.size / 1024).toFixed(0)} KB → ${await postShot(name, blob)}`;
  };
  // __resetClock(): zero every per-frame counter that feeds jitter / seeds / flicker, snap the camera — so a scripted capture sequence
  // renders the same frames whatever ran during boot (pair with __pauseLoop)
  window.__resetClock = () => { engine.frameIdx = 0; engine.passes.resetClocks(); cam.distance = cam.desiredDistance; cam.target = v3.copy(game.followPos()); };
  if (new URLSearchParams(location.search).has('paused')) { window.__pauseLoop = true; automated = true; }   // ?paused: nothing runs until a script steps it (deterministic captures from frame 0) — and attract mode never, even if the loop is let go later
  window.__timeScale = 1;
  if (new URLSearchParams(location.search).has('demo')) setTimeout(() => { startNight(); }, 1500);   // ?demo: straight into the night showcase (the level script's 'night'; ?breach the day's)
  else if (new URLSearchParams(location.search).has('breach')) setTimeout(() => { breach.start(); }, 1500);
  if (new URLSearchParams(location.search).has('hud')) readout.set(true);
  // F9: the perf recorder (ui/perfrec.ts) — a stress-test dump the designer hands back: per-frame GPU passes + CPU sections + state + events → download + shot server
  const perfrec = new PerfRecorder(engine, game, cam, quality, s => { perfNote = s; perfNoteT = 4; try { game.msg(s); } catch { /* */ } });   // (also on the message line, so REC start / saved shows without the debug read-out)
  let perfNote = '', perfNoteT = 0;
  let lastTimerResolved = -1;   // engine.timer.resolved when the ladder was last fed a GPU union (a sample gets 0 = 'no timings' unless a NEW readback resolved since)
  (window as any).__perfrec = perfrec;
  // F10: the SESSION JOURNAL (game/journal.ts + ui/sessionrec.ts) — a checkpoint of the moment, then every frame's dt / camera / input and every value the game took off the GPU
  // (the sensors), so tools/qa/replay.ts can play the session again headless and hold the deterministic simulation to it; the file downloads (+ the shot server's /session sink)
  const sessionrec = new SessionRec(game, s => { perfNote = s; perfNoteT = 5; try { game.msg(s); } catch { /* */ } });
  (window as any).__journal = {
    start: (opts: { seed?: number; note?: string } = {}) => { automated = true; if (game.journal.state !== 'idle') return game.journal.summary(); game.journal.request({ ...opts, commit: sessionrec.commit, userAgent: navigator.userAgent, hud: true }); return game.journal.why ? `pending — ${game.journal.why}` : 'starts on the next frame'; },
    stop: (immediate = false) => game.journal.stop('stopped (console)', immediate) ?? (game.journal.stopping ? 'stops at the end of the next frame (step one, or F10 / stop(true) forces it now)' : null),   // (deferred by default: the closing digest is taken straight after an update, where a replay compares it)
    toggle: () => sessionrec.toggle(),
    save: () => { const f = game.journal.last; if (!f) return 'nothing recorded'; sessionrec.deliver(f, f.meta.stopped); return sessionrec.lastName; },
    get state() { return game.journal.state; }, get file() { return game.journal.last; }, get stats() { return { ...game.sensors.stats, frame: game.journal.frame, bytes: game.journal.approxBytes(), lastName: sessionrec.lastName, lastBytes: sessionrec.lastBytes }; },
    check: (f?: unknown) => checkSessionFile((f ?? game.journal.last) as never), get sensors() { return game.sensors; },
    summary: () => game.journal.summary(),
  };
  // First-use warm-up behind the start card (renderer v3 P0-B, measured 08-11 on the M4 Max): the smoke solver's first live domain initialises its ~120 MB of 3D textures and runs
  // the sim's JS cold (≈ 10 ms GPU + 35 ms JS the first time, nothing after), the GPU particles' first burst binds their pool and pipelines — paid on the first presented frames
  // under the card (a throwaway canister and one spark 60 m outside the level, cleared a dozen frames on; the calibration skips its first 24 frames anyway) instead of on the
  // first shot of the night. Everything else tried (night vision, a lightning stroke, decals, glass cracks, debug views) costs nothing extra the first time: Metal compiles at
  // pipeline creation, which all happens at boot. Not under ?paused — scripts own every frame there; __prewarm() does it by hand — and never twice.
  let prewarmAt = -3;   // −3 never asked · ≥ 0 the frame it ran · −2 done
  (window as any).__prewarm = () => { if (prewarmAt !== -3) return false; smoke.spawnCanister([-60, 0, -60], 0.05); engine.particles?.emit('spark', [-60, 0.3, -60], [0, 1, 0], 1, { speed: 1, life: 0.25, size: 0.01 }); prewarmAt = frameCount; return true; };
  function frame() {
    try {
      if (window.__pauseLoop) { last = performance.now(); requestAnimationFrame(frame); return; }   // test hook: only scripted __runFrames advance anything (deterministic captures)
      if (prewarmAt === -3 && frameCount >= 1) (window as any).__prewarm();
      const now = performance.now(); const rawDt = (now - last) / 1000; const dt = Math.min(1 / 20, rawDt) * (window.__timeScale ?? 1); last = now;
      if (rawDt > 0) fpsSm = fpsSm * 0.95 + (1 / rawDt) * 0.05;   // HUD frame rate from wall-clock, not the clamped / time-scaled game dt
      if (quality.calibrating) quality.calibrateTick(rawDt);                            // boot calibration reads GPU pass timings behind the start card (the live scene renders there)
      else if (!(document.hidden && !window.__testVisible) && rawDt < 0.5 && (!menu.isOpen || attract.live)) {   // a frozen pause frame says nothing about gameplay load (attract mode's live rooms do: the ladder settles before Start is ever pressed)
        const fresh = engine.timer.resolved !== lastTimerResolved; lastTimerResolved = engine.timer.resolved;   // + the compute passes' GPU UNION of the last resolved frame — what the headroom-aware climb and auto's hop test read: 0 = 'no timings' (no timestamp queries), NaN = 'no verdict' (timings exist but no NEW readback resolved since the last sample — a stalled readback must neither feed the ladder a frozen number nor hand it the blind rule)
        quality.sample(rawDt, !engine.timer.enabled ? 0 : fresh ? engine.timer.unionMs(['composite', 'post', 'fxaa', 'gbuffer', 'pdraw', 'present']) : NaN);
      }
      perfrec.cpuFrameStart = performance.now();
      attract.tick(rawDt);   // idle seconds on the start card → the attract programme (its opening veil on the wall clock, then live; and off again the moment it may not run)
      step(dt);
      perfrec.frame(rawDt, fpsSm); if (perfNoteT > 0) perfNoteT -= rawDt;
      requestAnimationFrame(frame);
    } catch (e) { console.error(e); fatalOnce('The frame loop threw and has been stopped:', e); }   // no re-arm: stepping on with broken state would only bury this message under a cascade (scripted __runFrames still works for poking at it)
  }
  // Attract mode has just stopped under the start card with no fade (a poke): the world is a fresh encounter again and the camera is back on Sam, rooms away from the
  // last vantage — but a frozen frame steps nothing, so nothing of that reaches the GPU (the picture would stay the level as attract left it, patrols frozen
  // mid-stride, until Start), and the passes' temporal history is still the vantage's (the tour hides that frame of wholesale-rejected history under its veil;
  // there is no veil here). So, once, before the frame is drawn: one zero-length game step with the hands off the controls — nothing advances, nothing fires, it
  // only puts the fresh men, Sam, doors and props where they now are — and two unpresented renders from the restored view (as __shot renders), the first of which
  // replaces the vantage's history outright (reprojected from the old view it is rejected everywhere) and the second accumulates on it: the frame presented next
  // is a settled still of exactly what Start will hand over, not one frame of raw estimates over a stale room.
  function refreshFrozenStill() {
    const held = [...input.keys], btn = input.buttons; input.keys.clear(); input.buttons = 0;   // (the key that poked is still down: it must not pose Sam mid-stride or light his rail lamp in the still)
    for (let i = 0; i < 2; i++) {
      cam.update(0, game.followPos(), null);              // 1st: prevViewProj ← the vantage last drawn, the view itself snaps to the card's; 2nd: prev ← that view, so its history is taken up
      if (i === 0) game.update(0, input, cam, canvas);
      engine.render(cam, timeAcc, 0, false);
    }
    for (const k of held) input.keys.add(k); input.buttons = btn;
  }
  function step(dt: number, lastOfBurst = true) {
    timeAcc += dt;
    const frozen = menu.isOpen && !scripted && !attract.live;   // paused / start card: the world holds still, the picture stays live behind the card, hotkeys are off — unless attract mode has let the world go behind the start card (only once its opening veil is fully up): then the patrols walk
    if (frozen) { dt = 0; input.endFrame(); }
    if (refreshStill) { refreshStill = false; if (frozen && canvas.clientWidth > 0 && canvas.clientHeight > 0) refreshFrozenStill(); }   // (set by attract's onStop — refreshFrozenStill above; a stop that closed the card, i.e. the hand-over to the tour, needs none of it: that frame is live and under the tour's own veil)
    if (!frozen && input.wheelCtrl) cam.zoom(input.wheelCtrl);                 // Ctrl + wheel (or a pinch) zooms; the plain wheel is Sam's walking pace (player.ts)
    if (!frozen && input.orbitDX) cam.rotate(input.orbitDX * 0.006);          // hold Ctrl and move the mouse to orbit (Q / E are the wall hold and the holster now)
    if (!frozen && input.hit('Backquote')) { const stepDv = input.down('ShiftLeft') ? debugNames.length - 1 : 1; let dv = engine.settings.debugView; do { dv = (dv + stepDv) % debugNames.length; } while (!debugNames[dv]); engine.settings.debugView = dv; }   // (unnamed slots — another lane's views — are stepped over)
    if (!frozen && input.hit('BracketLeft')) engine.settings.exposure /= 1.25;
    if (!frozen && input.hit('BracketRight')) engine.settings.exposure *= 1.25;
    if (!frozen && input.hit('Tab')) panel.toggle();
    if (input.hit('F9')) perfrec.toggle();   // the perf recorder: works frozen or not (a pause-menu frame is data too)
    if (input.hit('F10')) sessionrec.toggle();   // the session journal: asks now, starts at the top of the next live update it may (a paused card holds it pending), stops at the end of one
    if (!frozen && input.hit('KeyP')) { if (demo.active || game.director.showing || game.director.handedOver) quitShow(); else startNight(); }   // ('P runs the showcase again' on the hand-over card means it: over the held caption P ends that run as finished and starts a fresh one)   // P: the night showcase — or, over any running show (the night, the day's breach, the old tour by console), stops it onto the live night floor
    if (!frozen && demo.active) { if (input.hit('ArrowRight')) demo.jump(+1); if (input.hit('ArrowLeft')) demo.jump(-1); }   // tour: arrows step between stops (the timeline at the bottom is clickable too)
    else if (!frozen && game.director.showing) { const ch = game.director.chapters(); if (ch) { if (input.hit('ArrowRight')) seekShow(Math.min(ch.list.length - 1, ch.i + 1)); if (input.hit('ArrowLeft')) seekShow(Math.max(0, ch.i - 1)); } }   // both showcases: arrows seek chapter to chapter (seekShow), the timeline is clickable

    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      const firstRender = !rendered;
      const demoPos = frozen ? null : demo.update(dt);   // before the game step: the tour's scripted beats press keys / move the puppet's aim for THIS frame's update
      const showingBefore = !frozen && game.director.showing;   // a level-script showcase (the breach) has the frame: its drill, beats and camera run INSIDE the game step (director.tick) — attract stays out of it
      const attractPos = demoPos || showingBefore || frozen ? null : attract.update(dt);   // attract mode's look-at when no scripted programme has the frame (it keys yaw / distance itself, as the tour does)
      { const tU = performance.now(); if (!frozen) game.update(dt, input, cam, canvas); perfrec.cpuUpdate = performance.now() - tU; }
      const dshow = frozen ? null : directorShow(); syncShowClass();   // (a show begun or ended inside the step or between frames: the HUD's class follows this frame)
      const shotPos: Vec3 | null = demoPos ?? (dshow ? dshow.look : null) ?? attractPos;   // a scripted look-at this frame: the tour's / the level script's pinned shot / attract mode's
      if (game.mission.debrief) { game.mission.debrief = false; menu.open('debrief'); }   // out with the drive: the end card (freezes the world like the pause menu; Esc / Keep playing resume, Again restarts)
      engine.settings.nvAmount = game.player.nvAmount; engine.settings.hitFlash = game.player.hitFlash;
      const lp = (attract.active || !!dshow) && shotPos ? shotPos : game.player.char.pos;   // (a showcase parks Sam 30 m away outdoors exactly as attract does: listen from the shot, not from him — review 08-10 #3)
      audio.setListener([lp[0], lp[1] + 1.6, lp[2]], cam.forward); audio.update(dt, timeAcc);   // ← these two MUST stay statements: an 08-09 comment reshuffle swallowed them into the line above for three days (listener stuck at the lot corner, finished voices never released) (attract mode parks Sam far away: the ears go where the eyes are, so a patrol walking through the shot is heard doing it)
      if (audio.music && !window.__forcedTension) audio.music.intensity = game.tension();
      smoke.update(dt);
      { const spect = !shotPos && game.spectate >= 0; if (spect) cam.autoYaw(dt, game.followPos(), (a, b) => game.col.segmentBlocked(a, b)); cam.easeYaw(dt, spect);   // spectating a guard: come round to the side he can be seen from,
        const lowP = 24 * Math.PI / 180, highP = 55 * Math.PI / 180; const want = spect && cam.desiredDistance < 12 ? lowP : highP; if (!dshow || dshow.handedOver) cam.pitch += (want - cam.pitch) * Math.min(1, dt * 3); }   // and drop to a low three-quarter angle up close (from the usual height the ceiling panels sit between the eye and a man six metres off) — a showcase's shots key the pitch themselves (until it hands over: then the follow camera is the player's again)
      cam.update(dt, shotPos ?? game.followPos(), shotPos || game.spectate >= 0 ? null : game.aimPoint);
      { const sh = show(); overlay.setCaption(sh ? sh.caption : '', sh ? sh.sub : ''); }
      overlay.setTimeline(demo.active ? demo.chapters() : dshow ? game.director.chapters() : null, k => { if (demo.active) demo.goto(k); else seekShow(k); });   // (a showcase's chapters: clickable — seekShow re-runs the story to that chapter)
      engine.lights.update(dt, timeAcc);
      { const tR = performance.now(); engine.render(cam, timeAcc, dt, !scripted || (lastOfBurst && !document.hidden)); perfrec.cpuRender = performance.now() - tR;
        if (firstRender) {   // the boot timeline's last two marks: the first frame encoded + submitted (its CPU side, incl. every target's allocation), and the GPU through with it ('GPU ready')
          rendered = true; boot.span('firstFrameCpu', tR); boot.mark('firstSubmit');
          gpu.device.queue.onSubmittedWorkDone().then(() => { boot.span('firstFrameGpu', tR); boot.mark('gpuReady'); bootLine(); }).catch(() => { /* device lost */ });
        } }
      overlay.update(game, cam, canvas); bubbles.update(game, cam, canvas);
    }
    input.endFrame();

    frameCount++;
    if (prewarmAt >= 0 && frameCount >= prewarmAt + 12) { smoke.clearAll(); engine.particles?.clear(); prewarmAt = -2; }   // the warm-up's throwaway domain / spark (above): everything they touch has been touched
    if (frameCount % 10 === 0) {
      const t = engine.timer; const lines: string[] = [];
      // one stat per line (a narrow column down the left edge reads better than three long rows across the picture)
      const row = (k: string, v: string) => k.padEnd(11) + v;
      lines.push(gpu.adapterInfo);
      if (perfrec.recording || perfNoteT > 0) lines.push(perfrec.recording ? '● REC (F9 stops)' : perfNote);
      lines.push(row('res', `${engine.width}×${engine.height} ×${engine.settings.renderScale.toFixed(2)}${engine.capScale < 0.999 ? ` of ${engine.settings.maxInternalHeight}p` : ''}${engine.settings.taau ? ` → ${engine.outWidth}×${engine.outHeight} taau${engine.sharpOn ? ' sharp' : ''}` : ''}`));   // the render scale is relative to the cap: '1368×770 ×0.77 of 1000p → 1777×1000 taau' = 770 rows rendered under the 1000-row cap, resolved to 1000; no 'of' = the window itself is under the cap; no '→' = TAAU off (the canvas IS the internal size)
      lines.push(row('quality', `${quality.label}${quality.adaptive ? ' +adapt' : ''}`));
      lines.push(row('fps', `${fpsSm.toFixed(0)}`));
      lines.push(row('gpu ms', `${t.total(['composite', 'post', 'fxaa', 'gbuffer']).toFixed(2)}`));
      unionSm = unionSm * 0.9 + t.unionMs(['composite', 'post', 'fxaa', 'gbuffer', 'pdraw']) * 0.1;   // the UNION of the compute passes' intervals: what the frame really cost on the GPU — the Σ above double-counts passes Metal ran side by side (direct beside the cascade chain is normal at play cadence: docs/internal/p0a-cascades.md)
      lines.push(row('gpu ∪ ms', `${unionSm.toFixed(2)}`));
      const order = ['smoke', 'mesh', 'rc c4', 'rc c3', 'rc c2', 'rc c1', 'rc c0', 'rc dice', 'direct', 'dtemporal', 'softblur', 'gather', 'temporal', 'reflect', 'rdenoise', 'volFroxel', 'volInject', 'volTemporal', 'volInteg', 'volumetrics', 'particles', 'pdraw', 'sharpEdge', 'sharpU', 'compS', 'gbaa', 'taau', 'bloom', 'probe'];   // compute passes only (+ sharp direct's kernels while it is live: the edge mask (edge rays only), U, the composite) ('volFroxel' = the froxel kernels, or volInject / volTemporal / volInteg with passes.froxelSplitTiming; 'volumetrics' = the 2D pass): render-pass timestamps (gbuffer / composite / post / fxaa) on Metal span the wait for the drawable and read as ~one frame each, so they are left out rather than mislead ('mesh' = the mesh-shadow skin + refit, only while settings.meshShadows is on)
      for (const k of order) if (t.results.has(k) && t.ranThisFrame(k)) lines.push(row('  ' + k, t.results.get(k)!.toFixed(2)));   // (only passes that actually ran this frame: a dormant one — particles with nothing alive — used to sit here at its last busy value)
      lines.push(row('boxes', `${engine.world.all.length} (dyn ${engine.world.dynamics.length})`));
      lines.push(row('lights', `${engine.lights.activeCount}`));
      lines.push(row('smoke', `${smoke.stats.live} dom · ${smoke.stats.emitters} em · ${smoke.stats.steps} disp${smoke.stats.bricksTotal ? ` · ${Math.round(100 * smoke.stats.bricksActive / smoke.stats.bricksTotal)}% bricks` : ''}`));
      lines.push(row('rc rays', `${(engine.rc.stats.intervals / 1e6).toFixed(2)}M`));
      lines.push(row('view', `${debugNames[engine.settings.debugView]} · exp ${engine.settings.exposure.toFixed(2)}`));
      lines.push(row('player', `vis ${(game.player.visibility * 100) | 0}% E=${game.player.irradiance.toFixed(3)}`));
      game.guards.forEach((gd, i) => lines.push(row(`guard ${i}`, `${gd.state} ${(gd.awareness * 100) | 0}`)));
      lines.push(row('AI', game.aiEnabled ? 'on' : 'off'));
      hud.textContent = show() || !readout.on ? '' : lines.join('\n');   // the showcases keep the screen clean; in play the read-out is opt-in (Tab ▸ Frame ▸ debug read-out, or ?hud) now that the kit and the interaction panel live on the left
    }
    tourVeil.style.opacity = String(demo.active ? demo.fade : game.director.showing ? (game.director.frame?.fade ?? 0) : attract.fade); document.body.classList.toggle('touring', !!show()); document.body.classList.toggle('attract', attract.active);   // (attract mode cuts under the same veil — its fade is 0 whenever it is not running — and thins the card's vignette while it runs: index.html body.attract)
  }
  // ---- READY: every hook above is on window. The real start card replaces the boot card (or the boot card goes, for ?demo / ?breach), __ready resolves, the loop starts.
  boot.mark('hooks');
  if (openStartCard) menu.open('start'); else card.off();
  loading.style.display = 'none';   // (the backdrop went before the first frame in the old boot too; the card is over the canvas until Start, and ?paused / a script that only __shot()s must not keep it)
  boot.mark('interactive'); boot.span('toInteractive', 0, performance.now());
  setTimeout(() => bootLine(), 5000);   // (the line prints at 'GPU ready'; a paused / hidden page that renders nothing still gets it, first-frame columns blank)
  readyResolve();
  boot.stopRafProbe();
  requestAnimationFrame(frame);
}
let rendered = false, bootPrinted = false; const bootGpuErrors: string[] = [];
/** the boot's one console line (ui/boot.ts line) + the GPU-error collector's verdict, once */
function bootLine() {
  if (bootPrinted) return; bootPrinted = true;
  console.log(boot.line() + (bootGpuErrors.length ? ` · ${bootGpuErrors.length} GPU ERROR(S) DURING BOOT: ${bootGpuErrors[0]}` : ' · no GPU errors during boot'));
  Object.defineProperty(window, '__boot', { configurable: true, get: () => ({ ...boot.summary(), line: boot.line(), gpuInitErrors: [...bootGpuErrors] }) });
}

// Runtime error surface. Boot failures already land on the #fatal card (main().catch below, device.lost in gpu/device.ts); this catches what
// happens afterwards — a throw inside the frame loop (frame()'s try/catch, which also stops the loop), or an uncaught exception / rejected
// promise from any other callback — and puts the FIRST one on the same card instead of leaving a silently frozen picture. Later ones, and
// anything arriving while a card is already up, only reach the console; the browser's ResizeObserver loop notices are not errors at all.
let crashed = false;
function fatalOnce(head: string, err: unknown) {
  if (crashed) return; crashed = true;
  const card = document.getElementById('fatal'); if (card && card.style.display === 'flex') return;   // showFatal already has something up (device loss…): that is the message that matters
  showFatal(`${head}\n\n${err instanceof Error ? (err.stack || String(err)) : String(err)}`);
}
window.addEventListener('error', ev => { if (/ResizeObserver loop/.test(ev.message)) return; fatalOnce('Uncaught error:', ev.error ?? ev.message); });
window.addEventListener('unhandledrejection', ev => fatalOnce('Unhandled promise rejection:', ev.reason));

main().catch(e => { console.error(e); showFatal(String(e?.stack ?? e)); readyReject(e); });
