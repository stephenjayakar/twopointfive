// THE STALK AND THE SNEAK LAB, ON THE REAL PAGE (src/game/stalk.ts STALK, src/host/sneaklab.ts): boot the lab's address in headless Chromium on the software
// WebGPU adapter (tools/qa/doorsolid-page.cjs's recipe) and, with real mouse and key events:
//   lab     the page is the lab: the level's six men, the stalk up, the panel open on the lab's system with a slider a number, empty hands.
//   key     0.8 m behind the man who stands, a tap of the interaction's keys (E, Space) grabs nobody, and the list says the click.
//   hold    2.6 m behind him, the left button pressed on him and kept down (the mouse's own events on the canvas): he is in Sam's arm inside six seconds.
//   let     the same, let go after two thirds of a second: nobody stalked, Sam at rest; pressed again: in his arm.
//   slider  the lab's first slider moved by its own input event writes the stalk's top speed.
// ONLY=off: a plain night under ?stalk=0 instead — the switch is off, the list offers the grab on its key and the key grabs him.
//   PORT=5231 node tools/qa/stalk-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)     SHOT=<file.png>: one drawn frame of the lab kept
// exit 0 = all hold with no page error · 1 = otherwise.   What this cannot say: how any of it LOOKS or FEELS (the software adapter draws it; nobody plays it here).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OFF = process.env.ONLY === 'off', SHOT = process.env.SHOT || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&levelFile=sneak-lab.json&solo${OFF ? '&stalk=0' : '&sneaklab'}`);
  const rows = []; const say = (ok, text) => { rows.push(ok); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); };
  const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5, 1 / 60, [], 'none');
    const g = window.__game, S = window.__knobs.registry().STALK; g.godMode = true; g.playerInvisible = true;
    return { fatal: document.getElementById('fatal')?.textContent || '', on: !!S.on, only: !!S.only, men: g.guards.filter(x => x.state !== 'dead' && !x.civ).length, holstered: !!g.player.holstered,
      sys: document.querySelector('#panel .prail .sys.on')?.getAttribute('title') || '', panel: !document.getElementById('panel').classList.contains('hidden'), sliders: document.querySelectorAll('#panel input[type=range]').length }; });
  /** Sam `gap` m dead behind the first man, crouched, hands empty; the frames run so the list is this frame's */
  const behind = gap => page.evaluate(async gap => { const g = window.__game, A = g.guards[0], yaw = A.char.bodyYaw; if (g.player.holding) { g.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); }
    const B = window.__game.guards[0]; window.__game.player.holstered = true; window.__game.teleportPlayer([B.char.pos[0] - Math.sin(B.char.bodyYaw) * gap, 0, B.char.pos[2] - Math.cos(B.char.bodyYaw) * gap]); window.__game.player.crouch = true;
    await window.__runFrames(20, 1 / 60, [], 'none'); }, gap);
  /** the first man's chest on the page, in the mouse's own coordinates */
  const chest = () => page.evaluate(() => { const g = window.__game, A = g.guards[0], v = document.getElementById('view'), r = v.getBoundingClientRect(), [x, y] = window.__cam.project([A.char.pos[0], 1.2, A.char.pos[2]], r.width, r.height); return [r.left + x, r.top + y]; });
  const frames = (n, until) => page.evaluate(async ([n, until]) => { const g = window.__game; let f = 0; for (; f < n; f++) { await window.__runFrames(1, 1 / 60, [], 'none'); if (until && g.player.holding) break; }
    const c = g.player.char; return { f, held: !!g.player.holding, speed: Math.hypot(c.vel[0], c.vel[2]), gap: Math.hypot(c.pos[0] - g.guards[0].char.pos[0], c.pos[2] - g.guards[0].char.pos[2]), list: g.nearby.map(r => Object.values(r).filter(v => typeof v === 'string').join(' ')).join(' | '), page: document.body.innerText.replace(/\s+/g, ' ') }; }, [n, until]);
  const tap = async code => { await page.keyboard.down(code); await frames(3); await page.keyboard.up(code); await frames(20); };
  await page.evaluate(() => window.__runFrames(150, 1 / 60, [], 'none'));   // (the man who stands is on his mark)
  if (OFF) {
    say(!boot.fatal && !boot.on && boot.men === 6, `?stalk=0: the switch is ${boot.on ? 'ON' : 'off'}, ${boot.men} men`);
    await behind(0.8); const before = await frames(2); await tap('KeyE'); let r = await frames(40, true); if (!r.held) { await tap('Space'); r = await frames(40, true); }
    say(r.held && /grab him/.test(before.list), `0.8 m behind the man who stands the list offers the grab (${/grab him/.test(before.list)}) and its key takes him (${r.held})`);
  } else {
    say(!boot.fatal && boot.on && boot.only && boot.men === 6 && boot.holstered && boot.panel && /^Sneak lab/.test(boot.sys) && boot.sliders >= 12,
      `the lab: stalk ${boot.on ? 'on' : 'OFF'}, the click the only way ${boot.only}, ${boot.men} men, empty hands ${boot.holstered}, the panel ${boot.panel ? 'open' : 'SHUT'} on '${boot.sys.slice(0, 20)}' with ${boot.sliders} sliders${boot.fatal ? ' · FATAL ' + boot.fatal : ''}`);
    // (one DRAWN frame before the page is read: the corner's rows are written by the draw)
    await behind(0.8); await page.evaluate(() => window.__runFrames(1)); const before = await frames(0); await tap('KeyE'); await tap('Space'); const k = await frames(30, true);
    say(!k.held && /hold to grab him/.test(before.list) && /hold to grab him/i.test(before.page), `0.8 m behind him a tap of E and of Space grabs nobody (in his arm ${k.held}), the man's rows say the click (${/hold to grab him/.test(before.list)}) and so does the page (${/hold to grab him/i.test(before.page)})`);
    if (SHOT) { await page.evaluate(() => window.__runFrames(1)); await page.screenshot({ path: SHOT }); }
    await behind(2.6); let [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const h = await frames(360, true); await page.mouse.up(); await frames(5);
    say(h.held, `2.6 m behind him, the left button pressed on him and kept down: ${h.held ? `in his arm after ${(h.f / 60).toFixed(2)} s` : `never grabbed (still ${h.gap.toFixed(2)} m off)`}`);
    await behind(2.6); [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const a = await frames(40, true); await page.mouse.up(); const b = await frames(40);
    await page.mouse.down(); const c = await frames(360, true); await page.mouse.up(); await frames(5);
    say(!a.held && a.gap < 2.5 && !b.held && b.speed < 0.02 && c.held, `let go after two thirds of a second (${a.gap.toFixed(2)} m off, closing): at rest ${b.speed.toFixed(2)} m/s with nobody in his arm; pressed again: in his arm ${c.held}`);
    const s = await page.evaluate(() => { const S = window.__knobs.registry().STALK, was = S.pace, el = [...document.querySelectorAll('#panel .row')].find(r => /top speed/.test(r.textContent))?.querySelector('input[type=range]'); if (!el) return { was, now: was, found: false };
      el.value = '1.2'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); const now = S.pace; S.pace = was; return { was, now, found: true }; });
    say(s.found && Math.abs(s.now - 1.2) < 1e-6, `the lab's 'top speed' slider moved to 1.2 writes the stalk's top speed (${s.was} → ${s.now})`);
  }
  if (errors.length) { rows.push(false); console.log(`- FAIL — page errors: ${errors.join(' | ')}`); }
  await browser.close();
  const failed = rows.some(r => !r);
  console.log(failed ? '=== stalk-page: FAILED ===' : '=== stalk-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
