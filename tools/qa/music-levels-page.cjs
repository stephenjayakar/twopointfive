// THE LEVEL'S OWN MUSIC, HELD TO THE PAGE (src/audio/setlist.ts, MUSIC.byLevel): boot the real page on a level in headless Chromium (the software WebGPU adapter, its
// output muted), press a key (the gesture that makes the score), and read off `window.__audio` which list the score was told and which piece is playing. This is the
// wiring tools/qa/music-check.ts cannot play (main.ts → AudioEngine.scoreSet → Music.setlist): there it is held by its text only.
//   node tools/qa/music-levels-page.cjs [query ...]      default: the records office (a level's row), the office rescue (a level:kind row), the solo night under ?shuffle
//   env: PORT (the dev server's, default 5199 — `PORT=5199 bun run tools/serve.ts` from this checkout, started after the last edit to src/)
// What is held, per page: the list told is setlist.ts's row for that query (read from the page's own bundle: `__audio.scoreSet` against the piece names in
// `__audio.music`), the piece playing after the gesture is the row's first, exactly one piece has begun, and no page error. Under ?shuffle: the switch reads off and a
// newer piece (any) is playing. SLOW: three to seven minutes a page on the software adapter. Nothing here says what a piece SOUNDS like.
// Exit 0 = every page opened on its level's piece, 1 = one did not (or did not boot).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const FLAGS = ['--autoplay-policy=no-user-gesture-required', '--mute-audio', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
// query → the piece that must open it (null = ?shuffle: any newer piece) — keep in step with src/audio/setlist.ts SETLISTS
const WANT = { 'roomclear&levelFile=records.json': 'Paper Walls', 'rescue': 'Dead Freight', 'solo&shuffle': null, 'solo': 'Night Shift', 'quiet&levelFile=vault.json': 'Wire Act', 'roomclear&squad4&levelFile=warehouse.json': 'Cold Storage' };
const jobs = process.argv.slice(2).length ? process.argv.slice(2) : ['roomclear&levelFile=records.json', 'rescue', 'solo&shuffle'];

(async () => {
  let red = 0;
  for (const q of jobs) {
    const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });   // (a browser a page: closing a page that is mid-frame on the software adapter takes minutes, closing its browser does not)
    const page = await (await browser.newContext({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', x => errs.push(String(x).slice(0, 200))); page.setDefaultTimeout(420000);
    const shuffle = /(^|&)shuffle(&|$)/.test(q), want = q in WANT ? WANT[q] : undefined;
    log(`?${q}`);
    try {
      await page.goto(`http://localhost:${PORT}/?${q}&paused&quality=verylow`);
      for (let k = 0; ; k++) { try { await page.evaluate(() => window.__ready); break; } catch (e) { if (k < 3 && /destroyed|navigation/i.test(String(e))) { await page.waitForLoadState('load'); continue; } throw e; } }   // (a page that loads itself once more on the way in)
      log('  ready'); await page.keyboard.press('ShiftLeft');   // the gesture that starts the audio (no game key)
      await page.waitForFunction(() => window.__audio && window.__audio.music, null, { timeout: 30000 });
      await page.evaluate(() => { window.__runFrames(3); if (window.__audio.scoreMenu) { window.__menu.close(); window.__runFrames(3); } });   // (a frame says the menu's flag and the list; a start card still up is shut)
      await page.waitForFunction(() => window.__audio.music.pieceName !== 'Theme', null, { timeout: 20000 }).catch(() => {});
      const s = await page.evaluate(() => ({ told: (window.__audio.scoreSet || []).slice(), set: (window.__audio.music.setlist || []).slice(), piece: window.__audio.music.pieceName, at: window.__audio.music.piece, changes: window.__audio.music.changes, byLevel: window.__knobs.registry().MUSIC.byLevel }));
      const why = [];
      if (s.told.length !== 2 || s.told.join() !== s.set.join()) why.push(`the score was told ${JSON.stringify(s.set)}, the mixer holds ${JSON.stringify(s.told)}`);
      if (shuffle) { if (s.byLevel !== false) why.push('?shuffle left the switch on'); if (s.piece === 'Theme') why.push('the theme in play'); }
      else { if (s.byLevel !== true) why.push('the switch is off in the page'); if (s.at !== s.set[0]) why.push(`${s.piece} is playing, not the list's first`); if (want !== undefined && s.piece !== want) why.push(`${s.piece}, not ${want}`); if (s.changes !== 1) why.push(`${s.changes} pieces begun`); }
      if (errs.length) why.push(`page errors: ${errs.join(' | ')}`);
      log(`- ${why.length ? 'FAIL' : 'PASS'} — ?${q}: ${shuffle ? 'dealt from the bag' : 'opens on its own piece'} (${s.piece}; list ${JSON.stringify(s.set)})${why.length ? `\n    ${why.join(' · ')}` : ''}`); if (why.length) red++;
    } catch (e) { log(`- FAIL — ?${q}: ${String(e).slice(0, 300)}${errs.length ? ` · ${errs[0]}` : ''}`); red++; }
    await browser.close().catch(() => {});
  }
  console.log(red ? `=== music-levels-page: ${red} FAILED ===` : '=== music-levels-page: ALL PASS ===');
  process.exit(red ? 1 : 0);
})();
