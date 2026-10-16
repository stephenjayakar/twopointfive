// EVERY MISSION STARTS THE SAME WAY ON EVERY TRY, ON THE REAL PAGE (src/game/samestart.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's
// recipe). A page load names no seed, so each load is another die: the same mission's URL is loaded twice and must stand the same people on the same spots, and a
// restart must stand them there again; under ?samestart=0 the switch reads off and the old deal is the one played (a fresh placement seed on a room clear).
//   PORT=5231 node tools/qa/samestart-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = all of it holds and no page printed an error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const PAGES = [['compound', 'levelFile=compound.json&roomclear&squad4'], ['bazaar', 'levelFile=bazaar.json&quiet'], ['rescue', 'rescue']];
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, s) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const load = async q => {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const R = await page.evaluate(async () => { await window.__ready; const g = window.__game;
      const sig = () => { const r = v => (Math.round(v * 20) / 20).toFixed(2), at = c => `${r(c.char.pos[0])},${r(c.char.pos[2])}`;
        return [`sam@${at(g.player)}`, ...[...g.guards, ...g.civilians].map(x => `${x.team}:${x.callsign}@${at(x)}`).sort(),
          g.quiet?.active ? `deal ${g.quiet.deal.start}/${g.quiet.deal.spot}/${g.quiet.deal.patrol}` : '', g.rescue?.active ? `clock ${g.rescue.resolveSecs}` : ''].join(' | '); };
      await window.__runFrames(3); const first = sig(); g.restartEncounter(); await window.__runFrames(3);
      return { fatal: document.getElementById('fatal')?.textContent || '', first, again: sig(), die: g.dice ? g.dice.seed : null, on: window.__knobs.registry().SAMESTART?.on,
        seed: g.roomClear?.active ? `${g.roomClear.seed}/${g.roomClear.attempt}` : '', men: g.guards.length }; });
    await page.close(); return { ...R, errors };
  };
  for (const [name, q] of PAGES) {
    const A = await load(q), B = await load(q), clean = [A, B].every(x => !x.fatal && !x.errors.length);
    line(clean, `${name}: two loads boot with no page error${clean ? '' : ' — ' + [A, B].map(x => x.fatal || x.errors.join(' ; ')).join(' | ').slice(0, 500)}`);
    line(A.on === true && A.die !== null && A.die !== B.die, `${name}: the switch reads on, and the two loads are two dice (${A.die}, ${B.die})`);
    line(A.men > 0 && A.first === B.first, `${name}: both loads stand the same ${A.men} men on the same spots${A.seed ? ` (placement ${A.seed} and ${B.seed})` : ''}`);
    line(A.again === A.first && B.again === B.first, `${name}: a restart stands them there again`);
  }
  { const [name, q] = PAGES[0], A = await load(q + '&samestart=0'), B = await load(q + '&samestart=0');
    line(A.on === false && !A.fatal && !A.errors.length, `${name} under ?samestart=0: the switch reads off, the page boots clean`);
    line(A.first !== B.first && A.again !== A.first, `${name} under ?samestart=0: the old deal — the two loads differ (placement ${A.seed} and ${B.seed}) and a restart deals again`); }
  await browser.close();
  console.log(failed ? '=== samestart-page: FAILED ===' : '=== samestart-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
