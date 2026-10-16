// SMOKE LOOK BATTERY (docs/internal/smoke-look2.md): four reproducible plumes under a gently ORBITING pinned camera, recorded off the canvas as webm clips per
// (scene × variant) for the blind pairwise-preference page (tools/qa/smoke-pref.html). Fresh boot per take is the rule for anything compared across builds;
// within one boot, `stage()` reseeds and restarts the encounter so a scene replays the same throw (the solver's own emitter jitter draws sysRandom — the
// plume is statistically, not bitwise, the same run to run: judge looks, not pixels).
//
//   await import('/qa/smoke-battery.js'); await __sb.boot();
//   await __sb.stage('S1')                      stage scene S1 (seed, restart, park, pin, throw the can), grow it to the clip's start → { cam, t }
//   await __sb.still('S1', 'framing')           stage + one JPEG to the sink (docs/shots/sb_<scene>_<tag>.jpg) — the framing check
//   await __sb.record('S1', 'base', v => {})    stage, apply the variant, record CLIP_SECS of live plume under the orbit → docs/shots/clips/sb_<scene>__<variant>.webm
//   await __sb.battery(['S1','S2'], VARIANTS)   every scene × variant in this boot (variants that need a reload say so and are skipped here)
//   __sb.VARIANTS                               the live-switchable variant table {name: {apply, teardown, note}}
//
// Scenes (the maintainer, 08-12: 'a few settings so we're not overfitting to the vending machine one … gently orbiting'):
//   S1 vending   a thrown can 1.5 m in front of the two backlit vending fronts (emissive pixel art BEHIND smoke)
//   S2 doorway   the tour's Smoke stop: a can on the break room's west sill, two parked torches through the plume (beams, shafts, self-shadow)
//   S3 lamp      a can under the east sodium lamp on the lot at night in the rain (one strong overhead light, silhouettes on wet asphalt)
//   S4 corridor  a can in the west corridor under the exit sign, camera along the corridor (thin smoke over a small bright emitter, a long view path)
(function () {
  const DEG = Math.PI / 180;
  const G = () => window.__game, E = () => window.__engine, S = () => window.__engine.settings;
  const PORT = () => window.__shotPort ?? 5174;
  const CLIP_SECS = 3, GROW_SECS = 3.5, FPS = 30;   // (3-s clips since 08-13: the page loops the middle 2.5 s anyway and shorter clips record / load in half the time)
  const yieldTask = () => new Promise(r => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // ---- determinism: one seeded Math.random for the staging (the game's dice), restored after
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  let sysRandom = null;
  function seed(n) { if (!sysRandom) sysRandom = Math.random; Math.random = mulberry32(n >>> 0); }

  const SCENES = {
    S1: { title: 'vending', look: [29.1, 0.9, 13.9], yaw: 20, pitch: 50, dist: 6.5, orbit: 14,
          can: { pos: [29.6, 1.0, 15.6], vel: [-0.8, 0.5, -2.2] },
          pre: g => {} },   // the level as it boots: break-room panels dark, the two fronts lit — what the maintainer plays it in (the 'breakroom' group would take the machines down with the panels)
    S2: { title: 'doorway + torches', look: [28.4, 0.7, 17.5], yaw: -18, pitch: 50, dist: 9.5, orbit: 14,
          can: { pos: [28.75, 0.45, 17.65], vel: [-1.7, 0.1, -0.05] },   // comes to rest about the sill of breakroom_w (hinge (28, 17.02), the tour's spot)
          guards: [{ i: 0, pos: [30.6, 0, 17.1], yaw: -Math.PI / 2, torch: true, aimPitch: -0.16 }, { i: 1, pos: [31.9, 0, 18.4], yaw: -1.75, torch: true, aimPitch: -0.14 }],   // two torches into the doorway from the break room side
          pre: g => { g.setGroup?.('breakroom', false); g.setGroup?.('cubicles', false); const dw = g.doors.byName('breakroom_w'); if (dw) { dw.angle = 1.35; dw.vel = 0; dw.latched = false; dw.closing = false; } } },   // both rooms DARK: the beams and the plume they cut through are the picture
    S3: { title: 'sodium lamp, rain', look: [36.7, 0.6, 23.1], yaw: 146, pitch: 44, dist: 8.5, orbit: 14,
          can: { pos: [35.8, 0.6, 23.7], vel: [1.4, 0.2, -1.0] },   // rests ~1.5 m off the lamp's pole (head at (38.25, 5, 22)): the pole beside the plume, not through it
          pre: g => { g.setGroup?.('exterior', true); const W = window.__weather; if (W) { W.setEnabled?.(true); W.storm = 0.6; W.rainRate = 0.5; W.seed?.(7); } } },
    S4: { title: 'corridor exit sign', look: [6.6, 0.9, 11.1], yaw: 92, pitch: 32, dist: 8.5, orbit: 12,
          can: { pos: [8.6, 0.6, 11.4], vel: [-1.6, 0.2, -0.3] },
          pre: g => { g.setGroup?.('corridor', true); } },
    // ---- the GLASS deck (glassbreak on vs off): a burst walked across ONE conference-partition pane, seen from the corridor; boot with ?glassbreak for the 'breaks' side
    G1: { title: 'glass: a burst across a conference pane', look: [10.6, 1.0, 10.4], yaw: 200, pitch: 28, dist: 6.0, orbit: 10, grow: 0.4,
          pre: g => { g.setGroup?.('conference', true); g.setGroup?.('corridor', true); },
          act: async (g, e) => {   // six hits walked left to right at chest height through glass.ts glassHit (→ glassBreak.hit when live: the third holes an annealed pane, tongues follow)
            const gl = window.__glass; const W = e.world; const panes = ((gl && gl.panes) || []).map(i => typeof i === 'number' ? { i, c: W.statics[i] && W.statics[i].c, h: W.statics[i] && W.statics[i].h } : i);   // (__glass.panes = static indices)
            let best = null, bd = 1e9;
            for (const pn of panes) { const c = pn.c; if (!c) continue; const d = Math.hypot(c[0] - 10.6, c[2] - 10.05); if (d < bd) { bd = d; best = pn; } }
            const bi = best && best.i; window.__g1pane = { bi, bd, c: best && Array.from(best.c), h: best && Array.from(best.h) };
            if (bi == null) return;
            const c = best.c;
            for (let k = 0; k < 6; k++) { const p = [c[0] - 0.5 + k * 0.2, 1.05 + (k % 2) * 0.25, c[2] + 0.02]; gl.hit(bi, p, [0, -0.05, -1]); window.__runFrames(6); }
          } },
  };

  function pinFor(sc, u) {   // u ∈ [0, 1] across the clip: the gentle orbit, eased at both ends
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    return { look: sc.look, yaw: (sc.yaw + sc.orbit * (e - 0.5)) * DEG, pitch: sc.pitch * DEG, dist: sc.dist };
  }
  let booted = false;
  async function boot() {
    if (booted) return 'already';
    window.__testVisible = true; await window.__ready;
    for (let i = 0; i < 100 && !(document.getElementById('view').clientWidth > 0); i++) await sleep(50);
    window.__menu?.close(); if (typeof window.__pauseLoop === 'function') window.__pauseLoop(); else window.__pauseLoop = true;   // (a flag main.ts's rAF loop reads; ?paused boots already hold it)
    window.__runFrames(300);   // the fixtures restrike
    booted = true; return 'ok';
  }
  /** stage a scene from a clean encounter: seed → restart → park / torches → pre() → pin → throw → grow to the clip's start (GROW_SECS of plume) */
  async function stage(name, opts = {}) {
    const sc = SCENES[name]; if (!sc) throw new Error('no scene ' + name);
    const g = G();
    seed(opts.seed ?? 20260812); g.smoke.params.frozen = false; g.smoke.clearAll(); if (g.tune) g.tune.civilians = false; g.restartEncounter(); window.__runFrames(2);   // (no civilians: a cleaner walking into a doorway shot is not the variable)
    g.aiEnabled = false; E().passes.grain = 0;
    window.__stage(pinFor(sc, 0), { park: true, guards: sc.guards ?? [], player: { pos: [8, 0, 20], yaw: 1.57, holstered: true, invisible: true } });
    for (const s of sc.guards ?? []) { const gd = g.guards[s.i]; if (gd) { gd.hold = true; gd.pinned = true; gd.lightDeadUntil = 0; } }
    sc.pre?.(g);
    window.__resetClock?.(); seed((opts.seed ?? 20260812) + 1);
    window.__runFrames(30);
    let it = null;
    if (sc.act) await sc.act(g, E());                                  // (a scene may stage its own event instead of the can — the glass deck fires a burst at a pane)
    else it = g.items.spawn('smoke', [...sc.can.pos], [...sc.can.vel], { who: 1 });
    const grow = Math.round((opts.grow ?? sc.grow ?? GROW_SECS) * 60); window.__runFrames(grow);
    return { scene: name, item: it && it.pos.map(v => +v.toFixed(2)), bricks: g.smoke.stats.pool, t: g.time };
  }
  async function post(path, name, blob) { const r = await fetch(`http://localhost:${PORT()}/${path}?name=${encodeURIComponent(name)}`, { method: 'POST', body: blob }); return r.text(); }
  /** one JPEG of the staged scene at orbit position u (default the middle) → docs/shots/sb_<scene>_<tag>.jpg */
  async function still(name, tag = 'still', opts = {}) {
    await stage(name, opts);
    const sc = SCENES[name]; window.__stage(pinFor(sc, opts.u ?? 0.5), {}); window.__runFrames(20);
    if (!window.__perf) await import('/qa/perf-harness.js');
    const fr = await window.__perf.render(1).then(() => window.__perf.readback());
    return window.__perf.crop(`sb_${name}_${tag}`, 0, 0, fr.w, fr.h, 1, 0.85, fr);
  }
  /** record CLIP_SECS of the live plume under the orbit as a FLIPBOOK: one sim step of 1/FPS per frame, each frame read back off the GPU, JPEG'd on an
   *  OffscreenCanvas and posted (docs/shots/clips/<clip>/f0000.jpg…) + meta.json — deterministic frame for frame whatever the render speed, works with the pane
   *  hidden (MediaRecorder needs the canvas composited: it recorded nothing off a hidden pane), and two flipbooks step in exact sync on the preference page */
  async function record(name, variant = 'base', apply = null, opts = {}) {
    if (!window.__perf) await import('/qa/perf-harness.js');
    const st = await stage(name, opts);
    let teardown = null; if (apply) teardown = apply(S(), G(), E()) || null;
    window.__runFrames(4);
    const sc = SCENES[name]; const N = Math.round((opts.secs ?? CLIP_SECS) * FPS); const q = opts.quality ?? 0.9;
    const clip = `sb_${name}__${variant}`;
    let oc = null, octx = null; const t0 = performance.now(); let postMs = 0;
    for (let i = 0; i < N; i++) {
      window.__stage(pinFor(sc, i / (N - 1)), {});
      window.__runFrames(1, 1 / FPS);                                 // the game + an on-screen render at the clip's rate …
      E().render(window.__cam, G().time, 1 / FPS, false); await E().device.queue.onSubmittedWorkDone(); await yieldTask();   // … and the same state rendered OFFSCREEN for the readback (engine.readbackFrame reads only that target; every variant pays the same two renders a frame)
      const fr = await window.__perf.readback();
      if (!oc || oc.width !== fr.w || oc.height !== fr.h) { oc = new OffscreenCanvas(fr.w, fr.h); octx = oc.getContext('2d'); }
      octx.putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer, fr.data.byteOffset, fr.w * fr.h * 4), fr.w, fr.h), 0, 0);
      const blob = await oc.convertToBlob({ type: 'image/jpeg', quality: q });
      const p0 = performance.now(); await fetch(`http://localhost:${PORT()}/clipframe?clip=${encodeURIComponent(clip)}&i=${i}`, { method: 'POST', body: blob }); postMs += performance.now() - p0;
      if ((i & 15) === 15) await yieldTask();
    }
    if (typeof teardown === 'function') teardown(S(), G(), E());
    const meta = { clip, scene: name, title: sc.title, variant, note: (VARIANTS[variant] && VARIANTS[variant].note) || opts.note || '', frames: N, fps: FPS, w: oc?.width, h: oc?.height, quality: q, build: opts.build ?? 'main', at: new Date().toISOString(), staged: st };
    await post('clip', `${clip}/meta.json`, new Blob([JSON.stringify(meta, null, 1)], { type: 'application/json' }));
    return { clip, frames: N, secs: +((performance.now() - t0) / 1000).toFixed(1), postSecs: +(postMs / 1000).toFixed(1), staged: st };
  }
  // ---- the live-switchable variants (each returns its teardown). Reload-level variants (vol full-res, composite-side diffusion) are separate builds/flags.
  const VARIANTS = {
    base:      { note: 'as shipped: density 1.6 · MS 1.0 · diffusion 1.0 (post, τ-linear, bilinear weight, Gaussian levels) · classic march K4/every2 · vol ÷2', apply: () => () => {} },
    dens10:    { note: 'render density 1.0 (Aug-9 value)', apply: (s, g) => { const d = g.smoke.params.densityScale; g.smoke.params.densityScale = 1.0; g.smoke.refreshDomains(); return () => { g.smoke.params.densityScale = d; g.smoke.refreshDomains(); }; } },
    dens13:    { note: 'render density 1.3', apply: (s, g) => { const d = g.smoke.params.densityScale; g.smoke.params.densityScale = 1.3; g.smoke.refreshDomains(); return () => { g.smoke.params.densityScale = d; g.smoke.refreshDomains(); }; } },
    ms0:       { note: 'multiple scattering off (single scattering)', apply: s => { const v = s.smokeMultiScatter; s.smokeMultiScatter = 0; return () => { s.smokeMultiScatter = v; }; } },
    ms15:      { note: 'multiple scattering 1.5', apply: s => { const v = s.smokeMultiScatter; s.smokeMultiScatter = 1.5; return () => { s.smokeMultiScatter = v; }; } },
    nodiff:    { note: 'diffusion off (attenuation only)', apply: (s, g, e) => { const v = e.passes.smokeDiffuse; e.passes.smokeDiffuse = 0; return () => { e.passes.smokeDiffuse = v; }; } },
    diff05:    { note: 'diffusion 0.5', apply: (s, g, e) => { const v = e.passes.smokeDiffuse; e.passes.smokeDiffuse = 0.5; return () => { e.passes.smokeDiffuse = v; }; } },
    froxel:    { note: 'the froxel path at high (K-lit march + froxel haze)', apply: s => { const v = s.froxelVol; s.froxelVol = true; return () => { s.froxelVol = v; }; } },
    every1:    { note: 'shadow refresh every step, K 6', apply: s => { const a = s.volShadowEvery, b = s.volLightCap; s.volShadowEvery = 1; s.volLightCap = 6; return () => { s.volShadowEvery = a; s.volLightCap = b; }; } },
    wmax:      { note: 'diffusion weight = the MOST transparent of the four half-res texels (no rim on nearer things; piecewise-constant) instead of the default bilinear', apply: s => { const v = s.smokeDiffuseWeight; s.smokeDiffuseWeight = 'max'; return () => { s.smokeDiffuseWeight = v; }; } },
    relax:     { note: "composite's vol upsample drops its depth guide where the texel is mostly smoke", apply: s => { const v = s.smokeUpsampleRelax; s.smokeUpsampleRelax = true; return () => { s.smokeUpsampleRelax = v; }; } },
    taareact:  { note: 'TAAU treats smoke pixels as reactive × 0.6 (fresh march over a stale clamped plume)', apply: s => { const v = s.smokeTaaReact; s.smokeTaaReact = 0.6; return () => { s.smokeTaaReact = v; }; } },
    volfull:   { note: 'the volumetric pass at FULL internal resolution (÷1 instead of ÷2)', apply: (s, g, e) => { const gd = e.passes.gatherDiv, vd = e.passes.volDiv; e.passes.setDivisors(gd, 1); return () => { e.passes.setDivisors(gd, vd); }; } },
    fixpack:   { note: 'upsample relax + TAAU smoke-reactive 0.6 + vol at full res together', apply: (s, g, e) => { const b = s.smokeUpsampleRelax, c = s.smokeTaaReact, gd = e.passes.gatherDiv, vd = e.passes.volDiv; s.smokeUpsampleRelax = true; s.smokeTaaReact = 0.6; e.passes.setDivisors(gd, 1); return () => { s.smokeUpsampleRelax = b; s.smokeTaaReact = c; e.passes.setDivisors(gd, vd); }; } },
    d13ms12nd: { note: 'density 1.3 · MS 1.2 · diffusion off', apply: (s, g, e) => { const d = g.smoke.params.densityScale, m = s.smokeMultiScatter, f = e.passes.smokeDiffuse; g.smoke.params.densityScale = 1.3; g.smoke.refreshDomains(); s.smokeMultiScatter = 1.2; e.passes.smokeDiffuse = 0; return () => { g.smoke.params.densityScale = d; g.smoke.refreshDomains(); s.smokeMultiScatter = m; e.passes.smokeDiffuse = f; }; } },
  };
  async function battery(scenes = Object.keys(SCENES), variants = Object.keys(VARIANTS), opts = {}) {
    const out = []; I.busy = { at: 'start' };
    for (const sc of scenes) for (const v of variants) {
      const V = VARIANTS[v]; if (!V) { out.push({ sc, v, err: 'unknown variant' }); continue; }
      I.busy.at = `${sc} ${v}`;
      try { out.push(await record(sc, v, V.apply, opts)); } catch (e) { out.push({ sc, v, err: String(e?.message || e) }); }
      I.log.push(out[out.length - 1]);
    }
    I.busy = null;
    // manifest for the preference page
    const manifest = { at: new Date().toISOString(), commit: await (await fetch('/qa/commit').catch(() => null))?.text?.().catch(() => null) ?? null, fps: FPS, secs: CLIP_SECS, scenes: Object.fromEntries(Object.entries(SCENES).map(([k, s]) => [k, s.title])), variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.note])), clips: out.filter(r => r.clip).map(r => ({ clip: r.clip, scene: r.staged.scene, variant: r.clip.replace(/^sb_[^_]+__/, ''), frames: r.frames })) };
    await post('clip', opts.manifest ?? 'sb_manifest.json', new Blob([JSON.stringify(manifest, null, 1)], { type: 'application/json' }));
    return out;
  }
  const I = { SCENES, VARIANTS, boot, stage, still, record, battery, pinFor, busy: null, log: [] };
  window.__sb = I;
  return 'smoke battery ready: await __sb.boot(); await __sb.still("S1") / __sb.record("S1", "base", __sb.VARIANTS.base.apply)';
})();
