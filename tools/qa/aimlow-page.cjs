// A MAN WHO IS LOW IS AIMED AT WHERE HE IS, ON THE REAL PAGE (player.ts manAim, AIM.player.low; the headless card is tools/qa/aimlow-check.ts): boot the page in
// headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), start the plain night, draw the rifle on the open strip south of the office,
// stand one man six metres in front of Sam with his head down (the animator's crouch held at 1, as guards.ts writes it), put the cursor on his chest as the
// page's own camera projects it and click once. The page as it opens: the reticle has him, the gun is pitched down onto him, he is down. Under ?noaimlow: the
// reticle has him, the gun is carried as at a standing man, three clicks and he lives — the build as it was.
//   PORT=5231 node tools/qa/aimlow-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = both hold with no page error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['low', ''], ['off', 'noaimlow']]) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const R = await page.evaluate(async () => {
      await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
      const g = window.__game, cam = window.__cam, view = document.getElementById('view'), P0 = [12, 0, 2], EAST = Math.PI / 2;
      g.godMode = true; g.infiniteAmmo = true;
      g.guards.forEach((gd, i) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; });
      g.teleportPlayer(P0); g.player.char.bodyYaw = g.player.char.aimYaw = EAST; cam.yaw = Math.PI; cam.rebuild(); await window.__runFrames(1);
      window.__input.pressed.add('Digit2'); await window.__runFrames(80);
      const gd = g.guards[0]; Object.defineProperty(gd.char.anim, 'crouchTarget', { get: () => 1, set() { }, configurable: true });
      const keep = () => { gd.char.pos = [P0[0] + 6, 0, P0[2]]; gd.char.bodyYaw = gd.char.aimYaw = -EAST; };
      const on = async () => { keep(); const [sx, sy] = cam.project(gd.char.bones.chest, view.clientWidth, view.clientHeight); window.__mouse(sx, sy); await window.__runFrames(1); };
      for (let i = 0; i < 130; i++) await on();
      const out = { fatal: document.getElementById('fatal')?.textContent || '', knob: window.__knobs.registry().AIM.player.low, rifle: !!g.player.rifleUp, crown: gd.char.bones.headTop[1],
        taken: g.aimGuard === gd, pitch: g.player.char.aimPitch * 180 / Math.PI, clicks: 0, dead: false };
      for (let k = 0; k < 3 && gd.state !== 'dead'; k++) { keep(); window.__click(0); window.__input.buttons |= 1; await window.__runFrames(1); window.__input.buttons = 0; out.clicks++; for (let i = 0; i < 25 && gd.state !== 'dead'; i++) await on(); }
      out.dead = gd.state === 'dead'; return out;
    });
    const want = name === 'low';
    const ok = !R.fatal && !errors.length && R.rifle && R.knob === (want ? 1 : 0) && R.taken && R.crown < 1.2 && (want ? R.dead && R.clicks === 1 && R.pitch < -4 : !R.dead && R.clicks === 3 && R.pitch > -3);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: knob ${R.knob} · rifle up ${R.rifle} · his crown at ${R.crown.toFixed(2)} m · reticle ${R.taken ? 'has him' : 'NOT on him'} · gun ${R.pitch.toFixed(1)}° · ${R.clicks} click${R.clicks === 1 ? '' : 's'} · ${R.dead ? 'down' : 'ALIVE'}${R.fatal ? ` · FATAL ${R.fatal.slice(0, 200)}` : ''}${errors.length ? ` · ${errors.length} page error(s): ${errors[0]}` : ' · no page error'}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== aimlow-page: FAILED ===' : '=== aimlow-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
