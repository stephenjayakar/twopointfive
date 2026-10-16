// WALL SNAP ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (page-look.cjs's way), take the wall with the pistol and
// with the rifle, step out at the conference doorway, and keep a rendered still of each — what the headless harness cannot see: that the page boots with the
// switch as its URL says, that the hold's new fields are there (or not, under ?nowallsnap), the console's errors, and the poses DRAWN.
//   node tools/qa/wallsnap-page.cjs <outDir> [name=query ...]     default jobs: on=''  off='nowallsnap'       env: PORT (dev server, default 5199) · SIZE · QUALITY
// Exit 1 when a state is not what the query should give or the console has an error. Slow: ~2 min to boot a page, 5–15 s a drawn frame.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || 'wallsnap-page';
const jobs = process.argv.slice(3).map(a => { const i = a.indexOf('='); return i < 0 ? { name: a, query: '' } : { name: a.slice(0, i), query: a.slice(i + 1) }; });
if (!jobs.length) jobs.push({ name: 'on', query: '' }, { name: 'off', query: 'nowallsnap' });
const PORT = process.env.PORT || 5199, [W, H] = (process.env.SIZE || '960x540').split('x').map(Number), QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return c2.toDataURL('image/png');
};
// the page's own loop for `secs` with the renderer stubbed out; keys held, and the cursor kept on a WORLD point (projected through the page's camera each frame)
const PLAY = ({ secs, keys, at }) => {
  const e = window.__engine, real = e.render, inp = window.__input, cam = window.__cam; let threw = null;
  e.render = () => {};
  const aim = () => { if (!at) return; const m = cam.viewProj, x = at[0], y = at[1], z = at[2], w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const cv = document.getElementById('view'), r = cv.getBoundingClientRect(); window.__mouse(r.left + (0.5 + 0.5 * (m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * r.width, r.top + (0.5 - 0.5 * (m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * r.height); };
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { aim(); window.__runFrames(1, 1 / 60, keys || []); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  void inp; return threw;
};
const STATE = () => { const g = window.__game, pl = g.player, w = pl.wall, c = pl.char;
  return { on: window.__wallsnap?.on, wall: !!w, kind: w?.kind ?? null, feel: w ? w.takeT !== undefined : null, settle: w ? +w.settle.toFixed(2) : null, lean: w?.lean ?? null, atEdge: w?.atEdge ?? null,
    stance: c.anim.stance, long: c.anim.longStance, slot: pl.slot, holstered: pl.holstered, pos: [+c.pos[0].toFixed(2), +c.pos[2].toFixed(2)] }; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let bad = 0; const report = [];
  for (const job of jobs) {
    const want = !/(^|&)nowallsnap(&|=|$)/.test(job.query), R = { name: job.name, query: job.query, want, errors: [], noise: 0, checks: [] }; report.push(R);
    const check = (ok, what, got) => { R.checks.push(`${ok ? 'PASS' : 'FAIL'} ${what}${got !== undefined ? ' · ' + JSON.stringify(got) : ''}`); if (!ok) bad++; log(job.name, ok ? 'PASS' : 'FAIL', what, got !== undefined ? JSON.stringify(got) : ''); };
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error') return; if (/Failed to load resource/.test(x)) return; if (NOISE.test(x) && R.noise < NOISE_MAX) R.noise++; else R.errors.push(x.slice(0, 400)); });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
    const play = async (secs, keys, at) => { const t = await page.evaluate(PLAY, { secs, keys, at }); if (t) R.errors.push('play threw: ' + t); };
    const still = async (tag, look, yaw = 0, pitch = 0.96, dist = 5.5) => {
      await page.evaluate(({ look, yaw, pitch, dist }) => window.__stage({ look, yaw, pitch, dist }, {}), { look, yaw, pitch, dist });
      const url = await page.evaluate(DRAW, 3); if (url) fs.writeFileSync(path.join(outDir, `${job.name}-${tag}.png`), Buffer.from(url.split(',')[1], 'base64'));
      await page.evaluate(() => window.__stage(null, {}));
    };
    try {
      await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&nocivilians${job.query ? '&' + job.query : ''}`);
      await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });
      await page.evaluate(async () => { const P = window.__cut?.programs, r = P?.swap ? P.ready : null; if (r) await Promise.race([Promise.resolve(r).catch(() => 0), new Promise(d => setTimeout(d, 300000))]); });
      log(job.name, 'ready');
      await page.evaluate(() => { window.__menu.close(); window.__smoke.params.enabled = false; const g = window.__game; g.aiEnabled = false; g.playerInvisible = true; g.godMode = true;
        g.guards.forEach((gd, i) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; }); });
      check((await page.evaluate(STATE)).on === want, `the switch is ${want ? 'on' : 'off'} as the URL says`);
      // QUIET: the pistol, nose to the corridor's north wall
      await page.evaluate(() => { const g = window.__game, pl = g.player; g.teleportPlayer([21, 0, 10.95]); pl.char.bodyYaw = pl.char.aimYaw = Math.PI; pl.slot = 'pistol'; pl.holstered = false; });
      await play(0.6, [], [21, 1.2, 8]);
      await page.evaluate(() => window.__input.pressed.add('KeyQ')); await play(1.0, [], [21, 1.2, 13]);
      let s = await page.evaluate(STATE); check(s.wall && s.stance === 'wall' && s.feel === want && s.settle === 1, 'Q with the pistol: back to the wall' + (want ? ', the feel pass on the hold' : ', the hold as it was'), s);
      await still('quiet', [21, 1.0, 10.9], 0.5);
      await page.evaluate(() => window.__input.pressed.add('KeyQ')); await play(0.6);
      // LOUD: the rifle in his hands
      await page.evaluate(() => { const g = window.__game, pl = g.player; g.teleportPlayer([10.9, 0, 10.85]); pl.char.bodyYaw = pl.char.aimYaw = -Math.PI / 2; pl.slot = 'rifle'; pl.holstered = false; pl.equipT = 0; });
      await play(1.0, [], [7, 1.2, 10.85]);
      await page.evaluate(() => window.__input.pressed.add('KeyQ')); await play(1.0, [], [7, 1.2, 10.85]);
      s = await page.evaluate(STATE);
      if (want) check(s.wall && s.kind === 'stack' && s.stance === 'stack' && s.long === 'lowLong' && !s.holstered, 'Q with the rifle: stacked, low ready, the rifle in his hands', s);
      else check(s.wall && s.kind === null && s.stance === 'wall' && s.holstered, 'Q with the rifle: slung, back to the wall, as it was', s);
      await still('rifle', [10.9, 1.0, 10.9], 0.5);
      if (want) {
        await play(1.2, ['KeyA'], [7, 1.2, 10.85]); await play(0.4, [], [7, 1.2, 10.85]);
        s = await page.evaluate(STATE); check(s.atEdge === 1, 'walked to the open end by the conference doorway', s);
        await play(1.0, [], [9.7, 1.2, 8.4]);
        s = await page.evaluate(STATE); check(s.lean === 1 && s.long === 'shoulder', 'the cursor round the corner: stepped out, rifle in the shoulder', s);
        await still('out', [10.2, 1.0, 10.4], 0.5);
        await play(1.2, [], [6, 1.2, 11.2]);
        s = await page.evaluate(STATE); check(s.lean === 0 && s.wall, 'the cursor back: in again, still on the wall', s);
      }
    } catch (x) { R.errors.push('script: ' + String(x && x.stack || x).slice(0, 600)); }
    check(R.errors.length === 0, `no console error (${R.noise} smoke-pipeline lines passed over)`, R.errors.length ? R.errors.slice(0, 4) : undefined);
    await page.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  await browser.close();
  console.log(bad ? `=== wallsnap-page: ${bad} FAILED ===` : '=== wallsnap-page: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})();
