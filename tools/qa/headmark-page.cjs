// THE MARK OVER A MAN'S HEAD ON THE REAL PAGE (src/ui/headmark.ts, drawn by src/ui/overlay.ts): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the four-man room clear staged, nobody's senses on.
//   PORT=5241 node tools/qa/headmark-page.cjs [outDir]        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   seen   every living teammate put in a fight: a red '!' is drawn for each (their marks are on the screen and the page draws them)
//   own    every living teammate given the awareness a frag leaves (0.92: six dots), every defender none: no yellow mark is drawn anywhere on the page
//   rest   the defenders given a little (0.2: two dots, and under the 0.3 at which a man on his round turns suspicious), the fog of war lifted and one of
//          them stood beside Sam for the reading: two dots are drawn over those on the screen, and no row of six anywhere
// (The page draws marks from a pool that is not in the roster's order, so the reading is of what is on the page: the yellow marks shown, and how many.)
// exit 0 = all three, with no page error · 1 = otherwise. With an outDir, a still of the whole page (frame + HUD) as the 'own' reading stands is written there.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== headmark-page: the real page draws no wary mark over a man of your own ===');
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes`);
  const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
  if (fatal) errors.push('fatal: ' + fatal);
  const A = await page.evaluate(() => {
    const g = window.__game, e = window.__engine, real = e.render; window.__menu.close(); window.__smoke.params.enabled = false;
    // (the software adapter draws a frame in seconds: the game is stepped with the renderer stubbed to the world's upload; the HUD is the page's own)
    const step = n => { e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, []); } finally { e.render = real; } };
    step(30); g.aiEnabled = false;
    const own = g.guards.filter(x => x.team === 'operative' && x.state !== 'dead'), foes = g.guards.filter(x => x.team !== 'operative' && x.state !== 'dead');
    const give = (men, a) => { for (const x of men) { x.state = 'patrol'; x.awareness = a; x.dazzledUntil = -1; } };
    // the yellow marks the page shows over men (not the civilians' own, not a last-seen '(?)')
    const yellow = () => [...document.querySelectorAll('.marker.sus')].filter(el => !el.classList.contains('civ') && !el.classList.contains('lastseen') && el.style.display !== 'none' && (el.textContent || '') !== '').map(el => el.textContent);
    const shown = () => [...document.querySelectorAll('.marker')].filter(el => el.style.display !== 'none').length;
    const reds = () => [...document.querySelectorAll('.marker.alert')].filter(el => !el.classList.contains('civ') && el.style.display !== 'none' && (el.textContent || '') === '!').length;
    give(foes, 0); for (const x of own) { x.state = 'alert'; x.awareness = 1; x.dazzledUntil = -1; } step(3); const seen = reds();
    give(own, 0.92); give(foes, 0); step(3); const a = { yellow: yellow(), shown: shown() };
    window.__hm = { g, own, foes, give, step, yellow, shown };
    return { own: own.length, foes: foes.length, seen, a };
  });
  if (OUT) {   // a few real frames (seconds each on the software adapter), then the page as it stands: the squad at a frag's awareness, nothing yellow over them
    await page.evaluate(async () => { const dev = window.__engine.device, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < 3; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await tick(); } }).catch(() => { });
    await page.screenshot({ path: path.join(OUT, 'headmark-own.png'), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 120)})`));
  }
  const B = await page.evaluate(() => {
    const { g, own, foes, give, step, yellow, shown } = window.__hm;
    const fog = g.fogOfWar, hid = fog.hidden; fog.hidden = () => false;   // (the reading only: a defender nobody on the team sees has no mark at all)
    // one defender stood two metres from Sam for the reading, so that one of them is on the screen whatever room they were dealt
    const near = foes[0], was = near ? [...near.char.pos] : null, at = g.player.char.pos; if (near) { near.char.pos[0] = at[0] + 2; near.char.pos[2] = at[2]; near.char.vel[0] = near.char.vel[2] = 0; }
    give(own, 0.92); give(foes, 0.2); step(3); const b = { yellow: yellow(), shown: shown() }; fog.hidden = hid;
    if (near && was) { near.char.pos[0] = was[0]; near.char.pos[2] = was[2]; }
    return { b };
  });
  const R = { ...A, ...B };
  line(R.own >= 2 && R.seen === R.own && !errors.length, 'every teammate put in a fight: the page draws a red \'!\' for each of them',
    `${R.own} teammates · ${R.seen} red '!' shown · errors ${JSON.stringify(errors.slice(0, 3))}`);
  line(R.seen === R.own && R.a.yellow.length === 0 && !errors.length, 'every teammate at the awareness a frag leaves, the defenders at none: no yellow mark on the page',
    `${R.own} teammates · ${R.foes} defenders · ${R.a.shown} head marks placed · yellow shown ${JSON.stringify(R.a.yellow)}`);
  line(R.b.yellow.length > 0 && R.b.yellow.length <= R.foes && R.b.yellow.every(t => t === '··') && !errors.length, 'the defenders given a little: two dots over those on the screen, and no teammate\'s row of six',
    `yellow shown ${JSON.stringify(R.b.yellow)} of ${R.foes} defenders and ${R.own} teammates · ${R.b.shown} head marks placed · errors ${JSON.stringify(errors.slice(0, 3))}`);
  await browser.close();
  console.log(`=== headmark-page: ${failed ? 'FAIL' : 'ALL PASS'} ===`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check ran\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
