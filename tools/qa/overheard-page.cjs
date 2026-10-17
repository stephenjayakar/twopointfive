// A SHOUT HEARD, ON THE REAL PAGE (src/game/cues.ts overheard, behind CUES.overheard): boot the page in headless Chromium on the software WebGPU adapter, on the
// block under the fog, stand the player beside a defender the fog hides, have that man shout through the game's own say(), and read the radio strip's own
// element: one dim row under the word HEARD with his words alone — and with `?overheard=0` no such row. What the harness cannot see: the page writes the
// switch up, and the HUD draws the row.
//   node tools/qa/overheard-page.cjs
//   env: PORT (the dev server's, default 5199 — `PORT=5199 bun run tools/serve.ts` from this checkout)
// It reads the strip's element, not its pixels (an element picture on the software adapter stalls the browser): how the row LOOKS is nobody's claim here.
// ~3 minutes a page on the software adapter. Exit 0 = both pages as said, 1 = not, or a page did not boot or threw.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// in the page
const DRIVE = async () => {
  await window.__ready;
  const g = window.__game, K = window.__knobs.registry().CUES; g.godMode = true;
  window.__runFrames(90);
  const ROUND = [[2, 0], [-2, 0], [0, 2], [0, -2], [1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]];
  const foes = g.guards.filter(gd => gd.state !== 'dead' && gd.team === 'hostile' && g.fogOfWar.hidden(gd));
  const heard = () => !!g.cues.heardRow;
  let who = '', tries = 0;
  // the switch up: the first hidden man whose shout the hearing model carries to the player stood beside him. Down: the same men, the same places, all tried
  pick: for (const gd of foes) for (const [dx, dz] of ROUND) { tries++; g.teleportPlayer([gd.char.pos[0] + dx, 0, gd.char.pos[2] + dz]); g.cues.reset(); g.say(gd, 'over here!'); if (heard()) { who = gd.callsign; break pick; } }
  window.__runFrames(2);
  const el = document.getElementById('log');
  return { on: K.on, overheard: K.overheard, fog: g.fogOfWar.on, hidden: foes.length, tries, who, rows: g.cues.rows.map(r => r.text), heardRow: g.cues.heardRow ? g.cues.heardRow.text : '', html: el ? el.innerHTML : null, ring: g.messages.map(m => m.text) };
};

(async () => {
  let red = 0;
  for (const job of [{ name: 'on', query: '', want: true }, { name: 'off', query: 'overheard=0&', want: false }]) {
    const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });   // (a browser a page: a second page in one browser never opened here once the first had run its frames on the software adapter)
    const shut = () => Promise.race([browser.close(), new Promise(res => setTimeout(res, 15000))]);
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 300)); });
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errs.push(`${r.status()}: ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });   // (a resource that did not load, by its path — the console's own line does not say which)
    const url = `http://localhost:${PORT}/?levelFile=block-squads.json&roomclear=2&squad4&${job.query}paused&quality=verylow&mute`;
    log(`${job.name}: ${url}`);
    let r;
    try { await page.goto(url); r = await page.evaluate(DRIVE); }
    catch (e) { console.log(`- FAIL — ${job.name}: the page did not come ready — ${String(e).slice(0, 300)}${errs.length ? ` · ${errs[0]}` : ''}`); red++; await shut(); continue; }
    log(`${job.name}: driven`); await shut();
    const row = '<span class="rx heard old"><b>HEARD</b>over here!</span>';
    const ok = job.want
      ? r.on && r.overheard === true && r.fog && !!r.who && r.html === row && r.heardRow === 'over here!' && !r.rows.length && !errs.length
      : r.on && r.overheard === false && r.fog && r.hidden > 0 && !r.who && !/heard/.test(r.html || '') && !errs.length;
    if (!ok) red++;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${job.name}: ${job.want ? 'the page has the switch up; a hidden defender shouting beside the player is one dim row under HEARD, his words alone' : '?overheard=0: the switch is down and the same shouts are no row'}\n    CUES.overheard ${r.overheard} · fog ${r.fog} · ${r.hidden} hidden defenders · ${r.tries} places tried · the man: ${r.who || 'none'} · heard row '${r.heardRow}' · net rows [${r.rows.join(' | ')}] · the strip's element: ${r.html || '(empty)'}${errs.length ? ` · page errors: ${errs.slice(0, 3).join(' ; ')}` : ''}`);
  }
  console.log(`=== overheard-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
