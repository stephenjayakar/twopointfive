// TWO GEARS, NOT A DIAL, ON THE REAL PAGE (src/game/player.ts TWOGEARS): boot the page in headless Chromium on the software WebGPU adapter (tools/qa/doorsolid-page.cjs's
// recipe), start the plain night with the guards frozen, and with real events — ten wheel notches on the canvas, the crouch key, the walk key held through
// `__runFrames` — read his pace and the crouch-walk he settles at. A plain address: the switch on, the pace whole after the wheel, no pace ticks in the kit
// column, the crouch-walk at the sneak's own pace. Then the same page under ?twogears=0&handslow=0: the switch off, the wheel takes his pace to its slowest notch,
// the ticks show, and the crouch-walk is the tune's. Each page then reads THE HAND (close.ts CLOSE.handsLow): crouched behind a standing man, the tell his body takes.
//   PORT=5231 node tools/qa/twogears-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)        ONLY=on | off: that page alone
// exit 0 = all hold with no page error · 1 = otherwise.   What this cannot say: how any of it LOOKS or FEELS (the software adapter draws it; nobody plays it here).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['on', ''], ['off', 'twogears=0&handslow=0']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
      const g = window.__game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = false;
      const G = window.__knobs.registry().TWOGEARS;
      return { fatal: document.getElementById('fatal')?.textContent || '', on: !!G.on, sneak: G.crouch, tune: g.tune.playerCrouch, walk: g.tune.playerWalk }; });
    const R = await page.evaluate(async () => {
      const g = window.__game, pl = g.player, c = pl.char, view = document.getElementById('view');
      const pace0 = pl.pace;
      for (let i = 0; i < 10; i++) { view.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })); await window.__runFrames(2); }
      const paced = pl.pace, ticks = !!document.querySelector('.pace');
      const speedOver = async keys => { let best = 0; for (let i = 0; i < 150; i++) { await window.__runFrames(1, 1 / 60, keys); best = Math.max(best, Math.hypot(c.vel[0], c.vel[2])); } return best; };
      pl.pace = 1; const walk = await speedOver(['KeyW']); await window.__runFrames(20);
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC', key: 'c', bubbles: true })); await window.__runFrames(2); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC', key: 'c', bubbles: true })); await window.__runFrames(20);
      const low = !!pl.crouch, sneak = await speedOver(['KeyS']);
      return { pace0, paced, ticks, walk, low, sneak };
    });
    // THE HAND (src/game/close.ts CLOSE.handsLow, tools/qa/handslow-check.ts's staging): one man stood on the lobby's open floor, Sam crouched 0.85 m behind him with
    // empty hands — which tell his body takes, and where his left hand is against his own head
    const H = await page.evaluate(async () => {
      const g = window.__game, pl = g.player, c = pl.char, EAST = Math.PI / 2, LOBBY_AT = [10.2, 0, 19.5], [A, ...rest] = g.guards, key = window.__knobs.registry().CLOSE.handsLow;
      const place = (gd, p) => { gd.char.pos = [...p]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = EAST; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.hold = true; gd.pinned = true; };
      rest.forEach((gd, i) => place(gd, [37.5, 0, 6 + i * 1.5])); place(A, LOBBY_AT);
      pl.slot = 'pistol'; pl.holstered = true; g.teleportPlayer([LOBBY_AT[0] - 0.85, 0, LOBBY_AT[2]]); pl.crouch = true; c.bodyYaw = c.aimYaw = EAST;
      for (let i = 0; i < 90; i++) { pl.visibility = 0.02; await window.__runFrames(1); }
      const at = node => { const p = c.skel.nodePos(c.anim.nodes[node]), w = c.world; return w[1] * p[0] + w[5] * p[1] + w[9] * p[2] + w[13]; };
      return { key: !!key, ready: c.anim.ready, hand: at('handL'), head: at('head'), crouched: !!pl.crouch };
    }).catch(e => ({ error: String(e && e.message || e).slice(0, 200) }));
    const want = name === 'on', f = x => Number.isFinite(x) ? x.toFixed(2) : '—', near = (a, b) => Math.abs(a - b) < 0.03;
    const ok = !boot.fatal && !errors.length && boot.on === want && R.pace0 === 1 && R.low && near(R.walk, boot.walk)
      && (want ? R.paced === 1 && !R.ticks && near(R.sneak, boot.sneak) && boot.sneak > boot.tune : near(R.paced, 0.35) && R.ticks && near(R.sneak, boot.tune));
    const handOk = !H.error && H.key === want && H.crouched && (want ? H.ready === 'strike' && H.hand < H.head - 0.05 : H.ready === 'grab' && H.hand > H.head);
    if (!ok || !handOk) failed = true;
    console.log(`- ${handOk ? 'PASS' : 'FAIL'} — ${name}, the hand: ${H.error ? H.error : `hands-low ${H.key ? 'on' : 'off'} · crouched 0.85 m behind a standing man the tell is '${H.ready}', his left hand ${f(H.hand)} m up, his head ${f(H.head)}`}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${boot.on ? 'on' : 'off'} · his pace ${f(R.pace0)}, after ten wheel notches ${f(R.paced)}, the pace ticks ${R.ticks ? 'shown' : 'not shown'} · the walk key held: ${f(R.walk)} m/s (the tune's ${f(boot.walk)}) · the crouch key: crouched ${R.low}, then walking ${f(R.sneak)} m/s (the sneak's ${f(boot.sneak)}, the tune's ${f(boot.tune)})${boot.fatal ? ' · FATAL ' + boot.fatal.slice(0, 200) : ''}${errors.length ? ' · page errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== twogears-page: FAILED ===' : '=== twogears-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
