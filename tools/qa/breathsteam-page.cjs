// A MAN'S BREATH AS GAS IN THE SMOKE SOLVER, LOOKED AT IN THE REAL PAGE (src/game/snowBreath.ts BREATHSTEAM, weatherKinds.ts SNOW_LOOK.steam): the pass's room
// clear with a squad of four, the player stood under the gate's lamp facing across its light, the camera pinned close on his face, his breaths made frequent,
// and stills taken as he breathes — with the steam (the page as it opens) and with ?breathsteam=0 (the puffs), the same frames of the same game. With the steam
// it also MEASURES it: smoke sight lines asked of the game's own sensors (the probe the guards' lines go through) across the breath a hand and a forearm from
// his mouth, down through it, and from his eye to where a man's chest would be three metres ahead — the light each line keeps, at every read.
//   node tools/qa/breathsteam-page.cjs [steam] [puffs]      default: steam alone (two pages at once halve each other's pace)
//   env: PORT (the dev server's, default 5199 — `PORT=5199 bun run tools/serve.ts` from this checkout) · OUT (the folder the stills go to) · STEPS (default 32,
//        each 1/30 s, a read and a still every 8) · EVERY (s between breaths, default 0.7) · DIST / PITCH (the pin, default 2.4 m / 18°) · QUALITY (default
//        verylow) · AT (where he stands, default 19.2,22 — in the gateway, in lamp_gate's cone) · YAW (which way he faces, degrees, default 90: into the lamp,
//        the camera then looking in through the open gate past his shoulder line) · REST (default 0: that many
//        more steps at the game's own rhythm and from the game's own camera, the solver's fine-lattice bricks read every 30 — what the breath of the men
//        in view holds of the pool once the frequent breaths have gone)
// Headless Chromium on the SOFTWARE adapter: about three minutes to boot and ten seconds a frame. What it can say: the page boots with the switch either way
// and no pipeline fails, the solver takes the sources (its own counts, read back), what a line through a breath loses, and what a breath looks like at this
// adapter's quality. What it cannot: a GPU's picture, anything moving, a frame's cost.
// Exit 0 = the pages booted clean and, with the steam, the solver held fine-lattice bricks while he breathed, no puff was filed and no line through his breath
// a man could look along (across it, down through it, eye to chest) lost a fifth of its light (where the game starts to read smoke); 1 otherwise. The line
// down the breath's own length from his lips is printed and not judged: nothing in the game looks along it.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'breathsteam-page-'));
const STEPS = +(process.env.STEPS || 32), REST = +(process.env.REST || 0), EVERY = +(process.env.EVERY || 0.7), DIST = +(process.env.DIST || 2.4), PITCH = +(process.env.PITCH || 18), QUALITY = process.env.QUALITY || 'verylow';
const AT = (process.env.AT || '19.2,22').split(',').map(Number), YAW = +(process.env.YAW || 90) * Math.PI / 180;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const want = process.argv.slice(2).filter(a => a === 'steam' || a === 'puffs'); const jobs = want.length ? want : ['steam'];
fs.mkdirSync(OUT, { recursive: true });

async function one(browser, name) {
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage();
  page.on('response', r => { if (r.status() >= 400) log(`  (${r.status()} ${r.url()})`); });
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || /error:|Invalid/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?levelFile=pass.json&roomclear&squad4&nofow&paused&quality=${QUALITY}&mute${name === 'puffs' ? '&breathsteam=0' : ''}`;
  log(`${name}: ${url}`); await page.goto(url);
  const boot = await page.evaluate(async ({ every, dist, pitch, at, yaw }) => {
    await window.__ready; window.__testVisible = true; const g = window.__game;
    window.__everyWas = window.__snow.breath.every; window.__snow.breath.every = every;   // (frequent breaths: a still wants one in the air)
    // the camera is pinned close on his face from whichever side has clear air between it and him (the first of the bearings below with nothing in the way: square
    // to where he faces first, so the breath crosses the picture), and everything of the page but the game's view is hidden
    const look = [at[0] + Math.sin(yaw) * 0.25, 1.45, at[1] + Math.cos(yaw) * 0.25], p = pitch * Math.PI / 180;
    const eyeOf = b => [look[0] + Math.sin(b) * Math.cos(p) * dist, look[1] + Math.sin(p) * dist, look[2] + Math.cos(b) * Math.cos(p) * dist];
    const clear = b => { const e = eyeOf(b), d = [look[0] - e[0], look[1] - e[1], look[2] - e[2]], L = Math.hypot(d[0], d[1], d[2]); const u = [d[0] / L, d[1] / L, d[2] / L]; return !window.__engine.world.raycast(e, u, L - 0.4) && !window.__engine.world.raycast([look[0] - u[0] * 0.4, look[1] - u[1] * 0.4, look[2] - u[2] * 0.4], [-u[0], -u[1], -u[2]], L + 0.6); };   // (both ways: an eye inside a box sees no wall from within)
    const bearings = [yaw - Math.PI / 2, yaw + Math.PI / 2, yaw + Math.PI * 0.75, yaw - Math.PI * 0.75, yaw + Math.PI / 4, yaw - Math.PI / 4, yaw + Math.PI], camYaw = bearings.find(clear);
    const r = window.__stage({ look, yaw: camYaw ?? bearings[0], pitch: p, dist }, { player: { pos: [at[0], 0, at[1]], yaw, holstered: true } });
    const css = document.createElement('style'); css.textContent = 'body *:not(#view):not(:has(#view)) { visibility: hidden !important; }'; document.head.appendChild(css);
    window.__mouse(window.innerWidth - 10, window.innerHeight - 10);   // (he looks where the cursor is: the picture's lower right is the ground ahead of him as staged, so he keeps facing across the view)
    window.__runFrames(2, 1 / 30); const c = g.player.char, h = c.bones.head;
    return { pipes: window.__boot.pipelines, steamOn: !!window.__knobs.registry().SNOW_LOOK?.steam, pin: r.pin, clearView: camYaw !== undefined, eye: window.__cam.pos.map(v => +v.toFixed(2)), head: h.map(v => +v.toFixed(2)), underRoof: !!g.weather.underRoof(h[0], h[2]), drawing: window.__smoke.drawing(), lamps: g.targets.filter(t => (t.light || t.areaLights) && Math.hypot(t.pos[0] - at[0], t.pos[2] - at[1]) < 6).map(t => `${t.name}@${t.pos.map(x => x.toFixed(1))}`) };
  }, { every: EVERY, dist: DIST, pitch: PITCH, at: AT, yaw: YAW });
  log(`${name}: booted`, JSON.stringify(boot));
  const rows = [];
  for (let k = 8; k <= STEPS; k += 8) {
    const r = await page.evaluate(async () => {
      const yieldM = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      const g = window.__game, S = g.sensors, c = g.player.char, h = c.bones.head, hd = c.headDir(), hl = Math.hypot(hd[0], hd[2]) || 1, f = [hd[0] / hl, 0, hd[2] / hl], s = [f[2], 0, -f[0]];
      const m = [h[0] + f[0] * 0.1, h[1] - 0.075, h[2] + f[2] * 0.1], P = (a, sd, up) => [m[0] + f[0] * a + s[0] * sd, m[1] + up, m[2] + f[2] * a + s[2] * sd];
      // the lines (asked every frame of the read, as the guards' are; answered a drawn frame or two on)
      const lines = { across15: [P(0.15, -0.4, -0.02), P(0.15, 0.4, -0.02)], across30: [P(0.3, -0.4, -0.04), P(0.3, 0.4, -0.04)], down20: [P(0.2, 0, 0.5), P(0.2, 0, -0.5)], eyeToChest: [[h[0], h[1], h[2]], [h[0] + f[0] * 3, h[1] - 0.35, h[2] + f[2] * 3]], alongIt: [P(-0.05, 0, 0), P(1.2, 0, -0.15)] };
      const least = {}; for (const key in lines) least[key] = 1;
      for (let i = 0; i < 8; i++) {
        for (const key in lines) S.askSegment('bs_' + key, lines[key][0], lines[key][1]);
        window.__runFrames(1, 1 / 30); await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); await yieldM();
        for (const key in lines) { const v = S.read('bs_' + key); if (v !== undefined && v < least[key]) least[key] = +v.toFixed(3); }
      }
      const st = window.__smoke.stats, b = window.__snow.breathStats;
      return { breaths: b.breaths, steam: b.steam, steaming: b.steaming, puffRecords: b.records, why: b.why, pool: st.pool, fineBricks: st.fineAll, fineDrawn: st.fine, sources: window.__smoke.emitters.filter(e => e.kind === 'breath').length, emitters: st.emitters, refused: st.failedTotal, held: st.fineHeldTotal, light: least };
    });
    const file = path.join(OUT, `breath_${name}_${String(k).padStart(3, '0')}.png`); await page.screenshot({ path: file, timeout: 240000 });
    rows.push(r); log(`${name}: step ${k}`, JSON.stringify(r), '→', file);
  }
  // the air alone (debug view 5: the volumetric pass), one short frame on
  await page.evaluate(async () => { const yieldM = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    window.__engine.settings.debugView = 5; window.__runFrames(1, 1 / 600); await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); await yieldM(); });
  const vfile = path.join(OUT, `breath_${name}_vol.png`); await page.screenshot({ path: vfile, timeout: 240000 }); log(`${name}: the volumetric pass alone →`, vfile);
  // the game's own rhythm and camera: what the men in view hold of the pool
  const rest = [];
  if (REST > 0) {
    await page.evaluate(() => { window.__engine.settings.debugView = 0; window.__snow.breath.every = window.__everyWas; window.__stage(null); });
    for (let k = 30; k <= REST; k += 30) {
      const r = await page.evaluate(async () => { const yieldM = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        for (let i = 0; i < 30; i++) { window.__runFrames(1, 1 / 30); if (i % 5 === 4) { await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); } }
        await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); await yieldM();
        const st = window.__smoke.stats, b = window.__snow.breathStats; return { fineBricks: st.fineAll, fineDrawn: st.fine, pool: st.pool, steaming: b.steaming, breaths: b.breaths, held: st.fineHeldTotal, refused: st.failedTotal }; });
      rest.push(r); log(`${name}: at rest, step ${k}`, JSON.stringify(r));
    }
    const rfile = path.join(OUT, `breath_${name}_game.png`); await page.screenshot({ path: rfile, timeout: 240000 }); log(`${name}: from the game's own camera →`, rfile);
  }
  await page.close();
  const booted = boot.pipes.failed === 0 && boot.pipes.done === boot.pipes.total;
  const least = Math.min(...rows.flatMap(r => Object.entries(r.light).filter(([k]) => k !== 'alongIt').map(([, v]) => v))), along = Math.min(...rows.map(r => r.light.alongIt));
  const ok = name === 'steam' ? booted && boot.steamOn && boot.drawing && !boot.underRoof && rows.some(r => r.fineBricks > 0) && rows[rows.length - 1].steam > 0 && rows[rows.length - 1].puffRecords === 0 && least > 0.8
    : booted && !boot.steamOn && rows.every(r => r.sources === 0 && r.steam === 0) && rows[rows.length - 1].puffRecords > 0;
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${boot.pipes.done} of ${boot.pipes.total} pipelines, ${boot.pipes.failed} failed · the switch ${boot.steamOn} · after ${STEPS} steps: ${JSON.stringify(rows[rows.length - 1])} · the most fine-lattice bricks at a read: ${Math.max(...rows.map(r => r.fineBricks))} · the least light a line a man could look along kept through his breath: ${least}; down its own length: ${along} ·${rest.length ? ` at the game's rhythm, fine-lattice bricks every 30 steps: ${rest.map(r => r.fineBricks).join(', ')} ·` : ''} ${errs.length} console errors${errs.length ? `, the first: ${errs[0]}` : ''}`);
  return ok && !errs.length;
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const oks = await Promise.all(jobs.map(j => one(browser, j).catch(e => { console.log(`- FAIL — ${j}: ${String(e).slice(0, 300)}`); return false; })));
  await browser.close(); log(`stills in ${OUT}`);
  process.exit(oks.every(Boolean) ? 0 : 1);
})();
