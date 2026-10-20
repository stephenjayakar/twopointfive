// THE LOAD BRIEF ON THE REAL PAGE (src/ui/loadbrief.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), a mission's own
// address loaded as a visitor loads it — no ?paused, no ?mute — once for each kind of mission, each started another way.
//   PORT=5199 node tools/qa/loadbrief-page.cjs [outDir]      (a dev server on that port: PORT=5199 bun run tools/serve.ts; JOBS=a,b = only those jobs)
//   night breach · room clear · rescue · quiet · training · solo night
//            from the first tick the page shows that mission's brief (its id, its title, a place and a job in words, its picture) and no controls list; when
//            the boot is done the block is live and the world behind it holds still (the game's clock does not move over drawn frames); then it is started —
//            Enter · a click · a click made WHILE IT BOOTS (kept: the run starts by itself the moment it can) · Space · Controls opened and shut first (the
//            options layer over it, Esc back to the brief and no pause card) · a script taking the page over (the brief goes, unstarted, and the frames it
//            asked for are run) — and the brief is gone, the clock runs, no key is left held on the game, no pause card, no page error
//   off      the same page under ?loadbrief=0: no brief, the old card with its controls list while it boots, the run under way with nothing pressed
//   paused   the automation boot (?paused&mute): no brief at any point, and a script's frames run
// exit 0 = every job, with no page error · 1 = otherwise. LOADBRIEF_BREAK=1 loads the brief jobs with the switch off: they must FAIL.
// THE FRAMES ARE NOT DRAWN unless REAL=1: the software adapter takes minutes over one frame of the level, and nothing here reads one — the page's own loop
// runs every frame of the game with the renderer's draw put aside from the moment the boot is done (carlamps-page.cjs's STEP, for the whole run). REAL=1
// leaves the renderer alone: the same verdicts over drawn frames, for one job at a time and a long wait.
// Game logic and DOM only: nothing here judges a picture of the level. With an outDir it keeps a still of each brief as Chromium lays it out (the brief is
// plain DOM, so that still is the brief; the level behind it has never been seen on a GPU by this tool).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '', BREAK = process.env.LOADBRIEF_BREAK === '1', REAL = process.env.REAL === '1';
const ONLY = (process.env.JOBS || '').split(',').map(s => s.trim()).filter(Boolean);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });

const JOBS = [
  { name: 'night breach', query: 'nightbreach', id: 'night-breach', title: 'Night breach', how: 'enter' },
  { name: 'room clear', query: 'levelFile=depot.json&roomclear&squad4', id: 'depot-four', title: 'The depot', how: 'click' },
  { name: 'rescue', query: 'levelFile=registry.json&rescue', id: 'rescue-registry', title: 'The registry', how: 'early' },
  { name: 'quiet', query: 'levelFile=vault.json&quiet', id: 'vault-quiet', title: 'The counting house', how: 'space' },
  { name: 'training', query: 'levelFile=train-move.json&quiet', id: 'train-move', title: '1 · Moving unseen', how: 'controls' },
  { name: 'solo night', query: 'solo', id: 'solo-night', title: 'Solo night', how: 'script' },
  { name: 'off', query: 'loadbrief=0&levelFile=depot.json&roomclear&squad4', off: true },
  { name: 'paused', query: 'paused&mute&nightbreach', paused: true },
].filter(j => !ONLY.length || ONLY.includes(j.name));
if (!JOBS.length) { console.log(`- FAIL — no job is named ${ONLY.join(', ')}`); process.exit(2); }

// in the page: what is on the screen
const SEEN = () => { const b = document.getElementById('brief'), t = (s) => (b && b.querySelector(s) ? b.querySelector(s).textContent : '') || '';
  return { brief: !!b && b.classList.contains('on'), cls: b ? b.className : '', id: b ? b.getAttribute('data-mission') : null, title: t('.bt'), place: t('.bplace'), job: t('.bjob'), facts: b ? [...b.querySelectorAll('.bf')].map(f => f.textContent) : [],
    picture: !!(b && b.querySelector('.bpic img')), start: t('.bgo span'), status: t('.bstatus'),
    menu: document.getElementById('menu').classList.contains('on'), controlsList: document.querySelectorAll('#menu .controls .row').length, options: !!(document.getElementById('options') && document.getElementById('options').classList.contains('on')),
    fatal: (document.getElementById('fatal') || {}).textContent || '' }; };
// in the page: the game's clock after two drawn frames (so a clock that did not move is a held world, not a page that drew nothing)
const CLOCK = async () => { await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const g = window.__game; return { t: g.time, held: [...window.__input.keys], pressed: [...window.__input.pressed] }; };
const centre = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
const runs = async (page, from, secs = 300) => { for (const end = Date.now() + secs * 1000; Date.now() < end;) { const c = await page.evaluate(CLOCK); if (c.t > from + 1e-6) return c; await page.waitForTimeout(500); } return null; };

(async () => {
  let red = 0; const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of JOBS) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const brief = !job.off && !job.paused, query = (BREAK && brief ? 'loadbrief=0&' : '') + job.query;
    const url = `http://localhost:${PORT}/?${query}&quality=${QUALITY}`; log(`${job.name}: ${url}`);
    const r = {}; let ok = false, why = '';
    try {
      await page.goto(url, { waitUntil: 'commit' });
      await page.waitForSelector(brief ? '#brief.on' : '#menu.on', { timeout: 90000 });
      r.boot = await page.evaluate(SEEN);
      if (job.how === 'early') { r.early = await page.evaluate(() => { const b = document.getElementById('brief'), was = b.className; b.querySelector('.bgo').click(); return { was, cls: b.className, brief: b.classList.contains('on') }; }); }   // (one turn of the page: what it was when pressed, and what the press made of it)
      await page.evaluate(async (real) => { await window.__ready; if (!real) { const e = window.__engine; e.render = () => { e.world.upload(); }; } }, REAL); log(` ${job.name}: ready`);   // (in the same turn as the boot's end: before the loop's first frame)
      r.ready = await page.evaluate(SEEN);
      if (brief && job.how !== 'early') {
        const a = await page.evaluate(CLOCK); await page.waitForTimeout(2500); const b = await page.evaluate(CLOCK);
        r.heldFor = [a.t, b.t]; r.still = await page.evaluate(SEEN);
        if (outDir) { try { await page.screenshot({ path: path.join(outDir, `loadbrief-${job.name.replace(/ /g, '-')}.png`), timeout: 120000 }); } catch (e) { log(` (no still: ${String(e).slice(0, 80)})`); } }
        if (job.how === 'enter') await page.keyboard.press('Enter');
        else if (job.how === 'space') await page.keyboard.press('Space');
        else if (job.how === 'click') { const [x, y] = await centre(page, '#brief .bgo'); await page.mouse.click(x, y); }
        else if (job.how === 'controls') {
          const [x, y] = await centre(page, '#brief .bq'); await page.mouse.click(x, y); await page.waitForTimeout(300); r.keysUp = await page.evaluate(SEEN);
          r.keysWords = await page.evaluate(() => (document.getElementById('options') || {}).textContent || '');
          await page.keyboard.press('Escape'); await page.waitForTimeout(300); r.keysShut = await page.evaluate(SEEN); r.keysClock = (await page.evaluate(CLOCK)).t;
          r.keysFocus = await page.evaluate(() => (document.activeElement || {}).className || '');
          await page.keyboard.press('Enter');
        }
        else if (job.how === 'script') r.script = await page.evaluate(() => { const t0 = window.__game.time; window.__runFrames(3, 1 / 60); return window.__game.time - t0; });
      }
      const from = brief && job.how !== 'early' ? r.heldFor[1] : 0;
      if (job.paused) { r.ran = await page.evaluate(() => { const t0 = window.__game.time; window.__runFrames(5, 1 / 60); return window.__game.time - t0; }); r.after = await page.evaluate(SEEN); }
      else { r.clock = await runs(page, job.how === 'script' ? from - 1 : from); await page.waitForTimeout(400); r.after = await page.evaluate(SEEN); }
    } catch (e) { r.err = String(e).slice(0, 300); }
    await page.close();
    const clean = !errs.length && !(r.after && r.after.fatal);
    if (r.err) why = r.err;
    else if (!clean) why = `page errors: ${errs.slice(0, 3).join(' | ') || r.after.fatal}`;
    else if (job.off) { ok = !r.boot.brief && r.boot.controlsList > 5 && !r.ready.brief && !!r.clock && !r.after.brief && !r.after.menu; why = JSON.stringify({ boot: r.boot.brief, rows: r.boot.controlsList, ran: !!r.clock, menu: r.after.menu }); }
    else if (job.paused) { ok = !r.boot.brief && !r.ready.brief && Math.abs(r.ran - 5 / 60) < 1e-6 && !r.after.brief; why = JSON.stringify({ boot: r.boot.brief, ready: r.ready.brief, ran: r.ran }); }
    else {
      const words = r.boot.brief && r.boot.id === job.id && r.boot.title === job.title && r.boot.place.length > 8 && r.boot.job.length > 20 && r.boot.facts.length >= 2 && r.boot.start === 'Start' && !r.boot.menu && r.boot.controlsList === 0;
      const gone = !r.after.brief && !r.after.menu && !!r.clock && r.clock.held.length === 0;
      let mid = true;
      if (job.how === 'early') mid = /live/.test(r.early.was) || (/armed/.test(r.early.cls) && r.early.brief);   // (pressed while it boots: kept, and nothing more is asked of the player; on a machine that booted before the press could be made, the press was an ordinary start)
      else mid = /live/.test(r.ready.cls) && r.heldFor[0] === r.heldFor[1] && r.still.brief && r.still.picture;
      if (job.how === 'controls') mid = mid && r.keysUp.options && r.keysWords.length > 200 && /sprint/i.test(r.keysWords) && !r.keysShut.options && r.keysShut.brief && !r.keysShut.menu && r.keysClock === r.heldFor[1] && /bgo/.test(r.keysFocus);
      if (job.how === 'script') mid = mid && Math.abs(r.script - 3 / 60) < 1e-6;
      ok = words && mid && gone;
      why = JSON.stringify({ words, id: r.boot.id, title: r.boot.title, picture: r.still ? r.still.picture : undefined, live: r.ready.cls, held: r.heldFor, mid, gone, after: { brief: r.after.brief, menu: r.after.menu }, clock: r.clock && +r.clock.t.toFixed(3), keys: r.clock && r.clock.held });
    }
    if (!ok) red++;
    const says = job.off ? 'under ?loadbrief=0: no brief, the old card and its controls list while it boots, the run under way with nothing pressed'
      : job.paused ? 'the automation boot: no brief at any point, a script\'s frames run'
      : `${job.name}: its own brief from the first tick, held until started (${job.how}), then the run`;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${says} — ${why}`);
  }
  await browser.close();
  console.log(`=== loadbrief-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
