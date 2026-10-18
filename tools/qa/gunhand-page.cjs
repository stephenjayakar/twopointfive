// GUN HAND ON THE REAL PAGE (src/game/gunhand.ts): headless Chromium on the software WebGPU adapter (tools/qa/inhand-page.cjs's recipe), the lights-out pair.
//   PORT=5241 node tools/qa/gunhand-page.cjs        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   on     the page opens with the switch on; a man with a long gun in his hands who is given a magazine change takes the reload carry (the gun off its
//          carriage, his eyes at the well) and is back on his carriage when it ends
//   off    the same page with ?gunhand=0: the switch is off and the same change shows no carry at all
// exit 0 = both, with no page error · 1 = otherwise. HALF=on|off runs one of the two (a boot on the software adapter is minutes on a loaded machine).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', HALF = process.env.HALF || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&levelFile=lights-out.json&quiet&squad=1&difficulty=hard&quietfog=cones${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== gunhand-page: on the real page a long gun\'s magazine change is the reload carry; with ?gunhand=0 it is not ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  // a second of play, then a magazine change given to the first man shown with a long gun in his hands: the carry at its most, whether his eyes went to the
  // well, and the carry once the change is over
  const stage = () => {
    const g = window.__game, e = window.__engine, real = e.render;
    const step = n => { e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, []); } finally { e.render = real; } };
    step(60);
    const m = [g.player, ...g.guards].find(x => x.char && x.state !== 'dead' && x.char.anim.longGun);
    const out = { on: window.__knobs.registry().GUNHAND.on, man: m ? (m === g.player ? 'you' : m.team) : null, top: 0, well: false, after: -1 };
    if (!m) return out;
    const an = m.char.anim; an.reload(2.4);
    for (let f = 0; f < 150; f++) { step(1); out.top = Math.max(out.top, an.rlShown.carry); out.well = out.well || an.atWell; }
    step(30); out.after = an.rlShown.carry;
    return out;
  };
  const say = (r, errs) => `GUNHAND.on ${r.on} · the man: ${r.man} · carry at its most ${r.top.toFixed(2)} · eyes at the well ${r.well} · carry after ${r.after} · errors ${JSON.stringify(errs.slice(0, 3))}`;
  if (HALF !== 'off') {
    const A = await open(''); const a = await A.page.evaluate(stage);
    line(a.on === true && a.man !== null && a.top > 0.9 && a.well === true && a.after === 0 && !A.errors.length, 'the page opens with the switch on: a long gun\'s magazine change takes the carry and gives it back', say(a, A.errors));
    await A.page.close();
  }
  if (HALF !== 'on') {
    const B = await open('&gunhand=0'); const b = await B.page.evaluate(stage);
    line(b.on === false && b.man !== null && b.top === 0 && b.well === false && !B.errors.length, 'the same page with ?gunhand=0: the switch is off and the change shows no carry', say(b, B.errors));
    await B.page.close();
  }
  await browser.close();
  console.log(failed ? '\n=== gunhand-page: FAILURES above ===' : '\n=== gunhand-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
