// THE NEW GLASS IN THE REAL PAGE (rebuild/glass/build.md): boot the page in headless Chromium on the software WebGPU adapter (SwiftShader, as page-look.cjs
// does — no GPU needed) and ask it what the visitor gets: is the one glass switch on, were the shaders compiled with the fracture's boot constant, are the three
// models live — then break a pane through the page's own hook, play two seconds, DRAW frames with the broken pane and the shards in them, and count the console's
// errors. What this shows: the defaults really reach the page (and `?glassfx=0` really takes them out), and every shader the glass touches compiles in Chrome's
// own WGSL compiler and runs with the fracture on. What it cannot show: how any of it LOOKS (the software adapter is not the Mac's GPU).
// Exit 1 on any console / page error that is not the smoke solver's known noise on this adapter, AND when the page's state is not what the job expects:
// a plain query expects the switch on, the constant compiled, all three live and the struck pane holding a fracture record; a query with glassfx=0 expects the
// switch off, nothing live, no record and six plain stars; EXPECT=none (a build without the new glass, e.g. the base) checks errors only. Exit 2 = the driver died.
//   node tools/qa/glass-page.cjs <outDir> [name=query ...]      env PORT (5199) · QUALITY (verylow) · SIZE (640x360) · FRAMES (2) · EXPECT (auto | none) · REST (0: seconds played on with the particle step running, then a third still — the glass at rest)
//   A plain (glass on) job also takes THE RESTING VIEW: REST_SECS (6) more settled the same way, daylight on (REST_DAY=0: not), the camera REST_DIST (2.6) m over the floor REST_OFF
//   (0.7) m beyond the struck pane, REST_WARM (10) frames to settle, then the view with SHARDS.restFrost on, on again and off — <job>-floor-look-on.png / -off.png
//   and a count of bright grains (on ≥ 1.5 × off is a verdict for the plain job, REST_STRICT=0: not; reported for the others). Glass asleep in the pool with the look on is a verdict too.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'glass-page';
const jobs = process.argv.slice(3).map(a => { const i = a.indexOf('='); return i < 0 ? { name: a || 'plain', query: '' } : { name: a.slice(0, i), query: a.slice(i + 1) }; });
if (!jobs.length) jobs.push({ name: 'plain', query: '' });
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', FRAMES = Number(process.env.FRAMES || 2);
const [W, H] = (process.env.SIZE || '640x360').split('x').map(Number), EXPECT = process.env.EXPECT || 'auto';
const REST_SECS = Number(process.env.REST_SECS || 6), REST_DIST = Number(process.env.REST_DIST || 2.6), REST_DAY = process.env.REST_DAY !== '0', REST_FRAMES = Number(process.env.REST_FRAMES || 4), REST_WARM = Number(process.env.REST_WARM || 10), REST_OFF = Number(process.env.REST_OFF || 0.7);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;   // (page-look.cjs: the smoke solver's 15 pipelines never compile on this adapter)
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0, nz = 0; for (let i = 0; i < fr.data.length; i += 4) { const l = fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; sum += l; if (l > 12) nz++; fr.data[i + 3] = 255; }
  (window.__gpFrames = window.__gpFrames || []).push(new Uint8Array(fr.data.buffer.slice(0)));   // (kept for REST's comparison)
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h * 3)).toFixed(2), litPct: +(100 * nz / (fr.w * fr.h)).toFixed(1), url: c2.toDataURL('image/png') };
};
const PLAY = (secs) => {
  const e = window.__engine, real = e.render; let threw = null;
  e.render = () => {};
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw;
};
// the same, but the GPU PARTICLE step still runs each frame (emit + update: shards fall, bounce and go to sleep). PLAY's stub freezes every particle where it
// is — a drawn frame on the software adapter costs seconds, an undrawn particle step milliseconds — so this is how glass is brought to REST before a still.
const SETTLE = async (secs) => {
  const E = window.__engine, dev = E.device, P = E.particles; let threw = null, steps = 0;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  const own = Object.prototype.hasOwnProperty.call(E, 'render'), real = E.render;
  E.render = (cam, t, dt) => { if (!P) return; const on = E.particlesOn; P.prepare(dt || 0, on, E.settings.particleBirths);
    if (on && P.hasWork && E.sceneBG) { dev.queue.writeBuffer(E.frameBuf, 204, new Float32Array([t])); dev.queue.writeBuffer(E.frameBuf, 220, new Float32Array([dt || 0]));   // (frame.time / frame.dt: the update kernel steps by them)
      const enc = dev.createCommandEncoder(); P.encodeUpdate(enc, E.sceneBG, E.rc.diceView); dev.queue.submit([enc.finish()]); steps++; }
    P.afterSubmit(); };
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } if (i % 10 === 9) { await dev.queue.onSubmittedWorkDone(); await yieldMacro(); } } }
  finally { if (own) E.render = real; else delete E.render; }
  await dev.queue.onSubmittedWorkDone(); await yieldMacro();
  return { threw, steps };
};
// what the visitor's page says about its glass
// (written to run on the base build's page too, which has no master switch and no falling-glass hook: those read undefined there)
const STATE = () => { const g = window.__game, gb = window.__glassbreak || {}, sh = window.__shards || {}; const errs = (window.__boot && window.__boot.gpuInitErrors) || [];
  return { fx: window.__glass.fx, shaderConst: gb.gpu, glassBreak: gb.on, fractureLive: gb.live, shardsOn: sh.on, shardsLive: sh.live, engineFracture: window.__engine.glassFracture, chaos: g.tune.chaos, touring: g.touring,
    panes: window.__glass.panes.length, types: window.__glass.panes.reduce((m, bi) => { const t = (g.glassBreak.typeOfPane ? g.glassBreak.typeOfPane(bi) : null) || 'untyped'; m[t] = (m[t] || 0) + 1; return m; }, {}),
    gpuErrors: errs.length, gpuErrorsNotSmoke: errs.filter(e => !/smoke/i.test(e) && !/number of storage textures \(5\)/.test(e)).map(e => e.slice(0, 300)), pipelines: window.__boot && window.__boot.pipelines }; };
// six blows on a float sheet if the level has one (else on the first toughened sheet), a hand's breadth apart, off the sheet's middle (a mullion may stand there)
const BREAK = () => { const g = window.__game, gb = window.__glassbreak; if (!g.glassBreak.typeOfPane) return { pane: null, why: 'this build has no fracture model' }; const all = window.__glass.panes.map(bi => ({ bi, t: g.glassBreak.typeOfPane(bi) })).filter(x => x.t);
  const X = all.find(x => x.t === 'annealed') || all.find(x => x.t === 'tempered') || all[0]; if (!X) return { pane: null };
  const b = g.level.boxes[X.bi], wide = b.h[0] >= b.h[2], hu = wide ? b.h[0] : b.h[2], cs = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0), tan = wide ? [cs, 0, -sn] : [sn, 0, cs], nrm = wide ? [sn, 0, cs] : [cs, 0, -sn];
  const cracks0 = window.__glass.cracks;
  for (let k = 0; k < 6; k++) { const u = 0.45 * hu + (k - 2.5) * 0.04, v = (k % 3 - 1) * 0.06; gb.hit(X.bi, [b.c[0] + tan[0] * u, b.c[1] + v, b.c[2] + tan[2] * u], [-nrm[0], 0, -nrm[2]], 1); }
  window.__stage({ look: [b.c[0], b.c[1], b.c[2]], yaw: (b.yaw || 0) + (wide ? 0 : Math.PI / 2), pitch: 1.0, dist: 4.5 }, {});
  return { pane: X.bi, type: X.t, cracksAdded: window.__glass.cracks - cracks0 }; };
const AFTER = (bi) => { const gb = window.__glassbreak, sh = window.__shards, P = gb.panes().find(p => p.bi === bi) || null;
  return { record: P && { type: P.type, sites: P.sites, hits: P.hits, open: +P.open.toFixed(2), gone: P.gone, walkable: P.walkable }, recordsHeld: gb.panes().length,
    fracture: { impacts: gb.stats.impacts, dropped: gb.stats.dropped, diced: gb.stats.diced }, shards: { fragments: sh.stats.fragments, plates: sh.stats.plates, born: sh.stats.born, sounds: sh.stats.sounds }, cracks: window.__glass.cracks,
    particles: window.__particles && window.__particles.stats ? { live: window.__particles.stats.live, born: window.__particles.stats.born, alive: window.__particles.stats.alive, asleep: window.__particles.stats.asleep, restFrost: window.__engine.particles ? window.__engine.particles.shardRestFrost : undefined } : null }; };   // (alive / asleep: the pool's own header read back — asleep > 0 with restFrost on = glass AT REST was in the last frames drawn, the resting look's shader paths with it)

// THE RESTING LOOK (tuning round five: fallen glass shows at rest — particles_common.wgsl SHARD_REST_*, the particle block's flag 8 ← SHARDS.restFrost): the camera
// goes down onto the floor under the struck pane once the glass has settled, and the same view is drawn with the look on, on again (the noise floor of two takes of
// one thing: a fresh TAA history each) and off. The look "draws" when on-vs-off moves the picture far more than on-vs-on does.
const RESTVIEW = ({ bi, dist, dayOn, REST_OFF }) => { const g = window.__game, b = g.level.boxes[bi], wide = b.h[0] >= b.h[2], hu = wide ? b.h[0] : b.h[2], cs = Math.cos(b.yaw || 0), sn = Math.sin(b.yaw || 0), tan = wide ? [cs, 0, -sn] : [sn, 0, cs], nrm = wide ? [sn, 0, cs] : [cs, 0, -sn];
  const k = window.__shards && window.__shards.knobs; if (!k || typeof k.restFrost !== 'boolean') return { has: false };
  const day = !!(dayOn && window.__daylight && window.__daylight(true));   // (the office at night leaves that floor near black: the breach's daylight, so there is light for a frost to send back)
  window.__stage({ look: [b.c[0] + tan[0] * 0.45 * hu - nrm[0] * REST_OFF, 0, b.c[2] + tan[2] * 0.45 * hu - nrm[2] * REST_OFF],   // (BREAK's blows went in along −normal: most of the glass lies on that side)
    yaw: (b.yaw || 0) + (wide ? 0 : Math.PI / 2), pitch: 1.35, dist }, {});
  const st = window.__particles && window.__particles.stats; return { has: true, day, frost: window.__engine.particles ? window.__engine.particles.shardRestFrost : undefined, live: st ? st.live : null, plates: window.__shards.plates }; };
const RESTSET = (on) => { window.__shards.knobs.restFrost = on; if (window.__taa && window.__taa.reset) window.__taa.reset(); window.__gpFrames = []; };
const RESTDIFF = () => { const F = window.__gpFrames || []; if (F.length < 3) return { err: `frames kept ${F.length}` };
  const d = (A, B) => { let sum = 0, big = 0; for (let i = 0; i < A.length; i += 4) { const x = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); sum += x; if (x > 24) big++; } return { mean: +(sum / (A.length / 4) / 3).toFixed(3), big }; };
  // (a frame's own noise on this adapter is as big as the look per pixel, so the verdict is a count instead: the frost's grains are the brightest things on that
  //  floor — pixels whose darkest channel is over twice the first take's mean level)
  let m = 0; for (let i = 0; i < F[0].length; i += 4) m += F[0][i] + F[0][i + 1] + F[0][i + 2]; const T = 2 * m / (F[0].length / 4) / 3;
  const bright = (A) => { let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.min(A[i], A[i + 1], A[i + 2]) > T) n++; return n; };
  return { noise: d(F[0], F[1]), look: d(F[1], F[2]), px: F[0].length / 4, brightOver: +T.toFixed(0), bright: { on: bright(F[0]), onAgain: bright(F[1]), off: bright(F[2]) } }; };

// (a verdict for the plain job — the office's float partition, REST_STRICT=0 takes it out; reported for the others, whose glass may lie where the view is not aimed.
//  With the glass really at rest (SETTLE) the count is decisive: 1873 and 1855 bright pixels with the look on against 40 with it off, two takes of one setting
//  128 pixels apart and on / off 25 863. Under PLAY alone the shards hung in the air where they were born and the same count said nothing.)
const REST_STRICT = (job) => process.env.REST_STRICT !== '0' && !job.query;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const report = [];
  for (const job of jobs) {
    const R = { name: job.name, query: job.query, errors: [], noise: 0 }; report.push(R);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return;
      if (/Failed to load resource/.test(x)) return;
      if (NOISE.test(x) && R.noise < NOISE_MAX) R.noise++; else R.errors.push(`${t}: ${x.slice(0, 600)}`); });
    page.on('requestfailed', r => R.errors.push(`request failed: ${r.url()} — ${r.failure()?.errorText ?? '?'}`));
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) R.errors.push(`http ${r.status()}: ${r.url()}`); });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
    try {
      const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${job.query ? '&' + job.query : ''}`;
      log(job.name, 'goto', url); await page.goto(url);
      const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; }); if (fatal) R.errors.push('fatal: ' + fatal);
      await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; });
      let threw = await page.evaluate(PLAY, 1); if (threw) R.errors.push('play threw: ' + threw);
      const cap0 = await page.evaluate(DRAW, 1); if (cap0 && cap0.err) R.errors.push('draw: ' + cap0.err);   // (one drawn frame first: the world's glass list is packed by the upload a render makes)
      const want0 = EXPECT === 'none' ? null : /(^|&)glassfx=(0|off|false|no)(&|$)/i.test(job.query) ? 'off' : 'on';
      R.state = await page.evaluate(STATE); log(job.name, 'state', JSON.stringify(R.state));
      R.broke = await page.evaluate(BREAK); log(job.name, 'broke', JSON.stringify(R.broke));
      threw = await page.evaluate(PLAY, 0.25); if (threw) R.errors.push('play threw: ' + threw);
      const cap1 = await page.evaluate(DRAW, FRAMES);   // (pieces in the air: the shard kernels and the crack network are in these frames)
      if (cap1 && cap1.url) fs.writeFileSync(path.join(outDir, `${job.name}-falling.png`), Buffer.from(cap1.url.split(',')[1], 'base64'));
      threw = await page.evaluate(PLAY, 2); if (threw) R.errors.push('play threw: ' + threw);
      const cap2 = await page.evaluate(DRAW, FRAMES);
      if (cap2 && cap2.url) fs.writeFileSync(path.join(outDir, `${job.name}-rest.png`), Buffer.from(cap2.url.split(',')[1], 'base64'));
      for (const c of [cap1, cap2]) if (!c || c.err) R.errors.push('draw: ' + (c ? c.err : 'nothing came back'));
      R.frames = [cap1, cap2].map(c => c && (c.err ? c : { w: c.w, h: c.h, mean: c.mean, litPct: c.litPct }));
      if (Number(process.env.REST || 0) > 0) {   // REST=secs: play on until the glass has come to rest, then one more still — the resting heap, drawn
        const set = await page.evaluate(SETTLE, Number(process.env.REST)); if (set.threw) R.errors.push('settle threw: ' + set.threw); R.settle = { secs: Number(process.env.REST), particleSteps: set.steps };
        const cap3 = await page.evaluate(DRAW, FRAMES + 4); if (cap3 && cap3.url) fs.writeFileSync(path.join(outDir, `${job.name}-heap.png`), Buffer.from(cap3.url.split(',')[1], 'base64')); if (!cap3 || cap3.err) R.errors.push('draw: ' + (cap3 ? cap3.err : 'nothing came back'));
      }
      if (R.broke.pane !== null && want0 === 'on') {
        const set = await page.evaluate(SETTLE, REST_SECS); if (set.threw) R.errors.push('settle threw: ' + set.threw);   // (SETTLE, not PLAY: the particle step must run for the glass to fall and go to sleep)
        const rv = await page.evaluate(RESTVIEW, { bi: R.broke.pane, dist: REST_DIST, dayOn: REST_DAY, REST_OFF }).catch(x => ({ has: false, err: String(x) }));
        if (rv.has) {
          await page.evaluate(DRAW, REST_WARM);   // (the light just changed and the camera just cut: let exposure, the bounce and the histories settle before anything is compared)
          await page.evaluate(RESTSET, true); const r1 = await page.evaluate(DRAW, REST_FRAMES); await page.evaluate(() => { const F = window.__gpFrames; window.__gpFrames = [F[F.length - 1]]; if (window.__taa && window.__taa.reset) window.__taa.reset(); });
          const r2 = await page.evaluate(DRAW, REST_FRAMES); await page.evaluate(() => { const F = window.__gpFrames; window.__gpFrames = [F[0], F[F.length - 1]]; window.__shards.knobs.restFrost = false; if (window.__taa && window.__taa.reset) window.__taa.reset(); });
          const r3 = await page.evaluate(DRAW, REST_FRAMES); await page.evaluate(() => { const F = window.__gpFrames; window.__gpFrames = [F[0], F[1], F[F.length - 1]]; window.__shards.knobs.restFrost = true; });
          if (r2 && r2.url) fs.writeFileSync(path.join(outDir, `${job.name}-floor-look-on.png`), Buffer.from(r2.url.split(',')[1], 'base64'));
          if (r3 && r3.url) fs.writeFileSync(path.join(outDir, `${job.name}-floor-look-off.png`), Buffer.from(r3.url.split(',')[1], 'base64'));
          R.rest = { ...rv, settle: { secs: REST_SECS, particleSteps: set.steps }, ...(await page.evaluate(RESTDIFF)), lit: [r1, r2, r3].map(c => c && c.mean) }; log(job.name, 'rest', JSON.stringify(R.rest));
        } else R.rest = rv;
      }
      R.after = R.broke.pane === null ? null : await page.evaluate(AFTER, R.broke.pane); log(job.name, 'after', JSON.stringify(R.after));
      R.gpuErrorsAfter = await page.evaluate(() => (window.__boot && window.__boot.gpuInitErrors || []).length);
      // what this job should have found
      const want = want0, st = R.state, rec = R.after && R.after.record, miss = [];
      if (st.gpuErrorsNotSmoke.length) miss.push(`a pipeline other than the smoke solver's failed: ${st.gpuErrorsNotSmoke[0]}`);
      if (want === 'on') {
        if (!(st.fx === true && st.shaderConst === true && st.engineFracture === true)) miss.push(`switch on and the fracture constant compiled (fx ${st.fx}, const ${st.shaderConst}, engine ${st.engineFracture})`);
        if (!(st.fractureLive === true && st.shardsLive === true)) miss.push(`fracture and falling glass live (fracture ${st.fractureLive}, shards ${st.shardsLive}, chaos ${st.chaos}, touring ${st.touring})`);
        if (R.broke.pane === null) miss.push('a sheet of glass to strike');
        else if (!(rec && (rec.sites > 0 || rec.gone))) miss.push(`the struck pane holds a fracture record (${JSON.stringify(rec)})`);
      } else if (want === 'off') {
        if (!(st.fx === false && st.shaderConst === false && !st.fractureLive && !st.shardsLive)) miss.push(`switch off, the constant not compiled, nothing live (fx ${st.fx}, const ${st.shaderConst}, fracture ${st.fractureLive}, shards ${st.shardsLive})`);
        if (R.broke.pane !== null && !(R.after.recordsHeld === 0 && R.broke.cracksAdded === 6)) miss.push(`six plain stars and no fracture record (stars ${R.broke.cracksAdded}, records ${R.after.recordsHeld})`);
      }
      if (want === 'on' && R.rest && R.rest.has) {
        // glass asleep in the pool while the resting look was on = the look's shader paths were in the frames drawn (alive 0 = the pool's header was never read back: no verdict)
        const P = R.after && R.after.particles;
        if (P && typeof P.asleep === 'number' && P.alive > 0 && !(P.asleep > 0 && R.rest.frost === true)) miss.push(`glass at rest in the frames drawn with the resting look on (asleep ${P.asleep}, restFrost ${R.rest.frost})`);
        const B = R.rest.bright;
        if (REST_STRICT(job)) {
          if (!B) miss.push(`the resting look compared (${JSON.stringify(R.rest).slice(0, 200)})`);
          else if (!(Math.min(B.on, B.onAgain) >= 50 && Math.min(B.on, B.onAgain) >= 1.5 * B.off)) miss.push(`fallen glass drawn at rest: bright grains with the look on (${B.on}, ${B.onAgain}) well over the same view with it off (${B.off})`);
        }
      }
      R.expect = want; for (const m of miss) R.errors.push('expected: ' + m);
    } catch (x) { R.errors.push('driver: ' + String(x && x.stack || x).slice(0, 600)); }
    log(job.name, `errors ${R.errors.length} · smoke noise ${R.noise}`); for (const e of R.errors.slice(0, 8)) log('   ', e.slice(0, 300));
    await page.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  process.exit(report.some(r => r.errors.length) ? 1 : 0);
})().catch(x => { console.error('glass-page: the driver died —', x && x.stack || x); process.exit(2); });
