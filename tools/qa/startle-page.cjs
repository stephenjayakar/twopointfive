// A CALM MAN SEES YOU, ON THE REAL PAGE (src/game/startle.ts STARTLE, character.ts startleFrom): boot the page in headless Chromium on the software WebGPU
// adapter (tools/qa/page-look.cjs's recipe), start the plain night with every guard but one parked blind and deaf, and put Sam, lit, four metres in front of
// that one. As the page opens: the switch is on, the frame he knows it is a man he starts — the animator's jolt shows (the page runs the motion pass, which
// the frozen headless stand does not), nothing is raised and nothing is shouted for the beat, and the gun comes up and the shout goes up at its end. Then the
// same page under ?startle=0: the switch off, no jolt, the gun coming up and the shout on the frame he knows, as it was.
//   PORT=5231 node tools/qa/startle-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)        ONLY=on | off: that page alone
// exit 0 = both hold with no page error · 1 = otherwise.   The renderer is stubbed and the light meter is the script's (rules, not pixels): what this cannot
// say is how any of it LOOKS.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['on', ''], ['off', 'startle=0']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const r = await page.evaluate(async () => {
      await window.__ready; window.__testVisible = true; window.__menu.close(); window.__smoke.params.enabled = false; window.__engine.render = () => {}; await window.__runFrames(5);
      const g = window.__game, pl = g.player, T = window.__knobs.registry().STARTLE, A = g.guards[0], c = A.char;
      g.godMode = true; g.guards.forEach((o, i) => { if (i) { o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; } }); A.hold = true;
      const step = async (n, vis, each) => { for (let i = 0; i < n; i++) { pl.visibility = vis; await window.__runFrames(1); if (each) each(); } };
      g.teleportPlayer([1, 0, 1]); await step(30, 0.02);
      const calm = A.state === 'patrol', f = c.forward(); g.teleportPlayer([c.pos[0] + f[0] * 4, 0, c.pos[2] + f[2] * 4]);
      const t0 = g.time; let alertAt = NaN, upAt = NaN, saidAt = NaN, shown = 0, shownUntil = NaN;
      await step(240, 0.9, () => { const t = g.time - t0, s = c.anim.startleShown;
        if (isNaN(alertAt) && A.state === 'alert') alertAt = t;
        if (isNaN(upAt) && !isNaN(alertAt) && c.anim.upper === 'aim') upAt = t;
        if (isNaN(saidAt) && A.bubble && A.bubble.text === 'CONTACT!') saidAt = t;
        if (s > shown) shown = s; if (s > 0.02) shownUntil = t; });
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!(T && T.on), beat: T ? T.beat : 0, calm, alertAt, upAt, saidAt, shown, shownFor: shownUntil - alertAt };
    });
    const want = name === 'on', f = x => Number.isFinite(x) ? x.toFixed(2) : '—';
    const late = r.upAt - r.alertAt, said = r.saidAt - r.alertAt;
    const ok = !r.fatal && !errors.length && r.on === want && r.calm && Number.isFinite(r.alertAt)
      && (want ? r.shown > 0.5 && Math.abs(late - r.beat) < 0.1 && Math.abs(said - r.beat) < 0.1 : r.shown === 0 && late < 0.05 && said < 0.05);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${r.on ? 'on' : 'off'} · a calm man (${r.calm}), Sam lit four metres in front of him: he knows at ${f(r.alertAt)} s — ${r.shown > 0 ? `the jolt shows (${f(r.shown)} of it at most, ${f(r.shownFor)} s long)` : 'no jolt'}, the gun comes up ${f(late)} s after that and 'CONTACT!' ${f(said)} s after (the beat: ${f(r.beat)})${r.fatal ? ` · FATAL ${r.fatal.slice(0, 200)}` : ''}${errors.length ? ` · ${errors.length} page error(s): ${errors[0]}` : ' · no page error'}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== startle-page: FAILED ===' : '=== startle-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
