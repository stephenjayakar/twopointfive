// IN HAND ON THE REAL PAGE (src/game/inhand.ts; Character.inHandPass): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe),
// the lights-out pair staged as the maintainer's shot was (a teammate behind the player, calm patrols with torches on the floor).
//   PORT=5241 node tools/qa/inhand-page.cjs [outDir]        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   on     the page opens with the switch on; after a second of play the drawer has told every armed man shown what is in his right hand, the look-only pass
//          has posed their hands (inHandK > 0) and no joint the game reads moved off the animator's (bones.handR is the skeleton's wrist only where the pass
//          left the wrist alone)
//   off    the same page with ?inhand=0: the switch is off, nobody is told anything, every skeleton is posed once
// exit 0 = both, with no page error · 1 = otherwise. With an outDir, a still of the page is written there. HALF=on|off runs one of the two (a boot on the
// software adapter is minutes on a loaded machine).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', HALF = process.env.HALF || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&levelFile=lights-out.json&quiet&squad=1&difficulty=hard&quietfog=cones${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== inhand-page: the real page tells every armed man what is in his hand and poses the hand to it; with ?inhand=0 it does neither ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  // a second of play with the picture's own box pass run every frame (the drawer is where the words are said), then what each man shown was told
  const stage = () => {
    const g = window.__game, e = window.__engine, real = e.render;
    const step = n => { e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, []); } finally { e.render = real; } };
    step(60);
    const men = [g.player, ...g.guards].filter(m => m.char && m.state !== 'dead' && !(m !== g.player && g.fogOfWar.hidden(m)));
    const told = men.map(m => ({ kind: m.char.inHand ? m.char.inHand.kind : null, k: +m.char.inHandK.toFixed(2), team: m === g.player ? 'you' : m.team }));
    return { on: window.__knobs.registry().INHAND.on, men: men.length, told };
  };
  if (HALF !== 'off') {
  const A = await open(''); const a = await A.page.evaluate(stage);
  const toldA = a.told.filter(t => t.kind), posedA = a.told.filter(t => t.k > 0);
  line(a.on === true && toldA.length >= 1 && posedA.length >= 1 && !A.errors.length, 'the page opens with the switch on: the men shown are told what is in their hands and the look-only pass has posed them',
    `INHAND.on ${a.on} · ${a.men} men shown · told ${JSON.stringify(a.told)} · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
  if (OUT) {   // a few real frames (seconds each on the software adapter), then the page as it stands
    await A.page.evaluate(async () => { const dev = window.__engine.device, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < 3; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await tick(); } }).catch(() => { });
    await A.page.screenshot({ path: path.join(OUT, 'inhand-page.png'), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 120)})`));
  }
  await A.page.close();
  }
  if (HALF !== 'on') {
  const B = await open('&inhand=0'); const b = await B.page.evaluate(stage);
  line(b.on === false && b.told.every(t => !t.kind && t.k === 0) && !B.errors.length, 'the same page with ?inhand=0: the switch is off, nobody is told anything, no skeleton is posed twice',
    `INHAND.on ${b.on} · ${b.men} men shown · told ${JSON.stringify(b.told)} · errors ${JSON.stringify(B.errors.slice(0, 3))}`);
  }
  await browser.close();
  console.log(`=== inhand-page: ${failed ? 'FAIL' : 'ALL PASS'} ===`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error('error:', e); process.exit(1); });
