// STICKY CAMERAS ON THE REAL START PAGE (ui/startpage.ts over ui/levers.ts): a quiet mission's Setup rail has a Fog row and, under it, a Sticky cameras row. On a
// fresh machine both are lit as a quiet mission starts (quietfog.ts QUIETFOG.def: the fog all round, the cameras handed out) and the link carries neither key; a press off that puts ONE key on the link (cams=0, quietfog=<rung>); ?quietdef=off = it starts all shown and one click on Sticky cameras is quietfog=team&cams=N; a squad mission's rail has no Sticky cameras row.
//   PORT=5237 node tools/qa/sticky-page.cjs [outDir]      (a dev server on that port: PORT=5237 bun run tools/serve.ts)
// No GPU is asked for (the start page is plain DOM, live from the first tick; the boot stops at 'No WebGPU adapter' behind it). PASS / FAIL lines, stills, exit 1 on a FAIL.
// Then the mission behind the quiet link, on the software adapter (a second browser; GAME=0 skips): the wand and the cameras in hand, the fog live, STICKY.take / QUIETFOG.wand on, and off under &camtake=0&quietwand=0.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || 'sticky-page', PORT = process.env.PORT || 5199, QUIET = process.env.MISSION || 'police-post-quiet', SQUAD = process.env.SQUAD || 'compound-four';
fs.mkdirSync(outDir, { recursive: true });
let failed = false; const errors = [];
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (!/WebGPU|adapter/i.test(String(e))) errors.push(String(e).slice(0, 300)); });
  const open = async q => { await page.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(500);
    await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(500); };
  const goRow = async id => { const sel = `#missions .mrow[data-mission="${id}"]`;
    const head = await page.evaluate(q => { const e = document.querySelector(q); return e && e.classList.contains('shut') ? e.getAttribute('data-group') : null; }, sel);
    if (head) { await page.click(`#missions .msec[data-head="${head}"]`); await page.waitForTimeout(150); }
    await page.click(sel); await page.waitForTimeout(300); };
  // the rail as drawn: each lever row's label and value, and the selected mission's link
  const rail = () => page.evaluate(() => { const R = document.getElementById('missions'), vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.hidden; };
    const rows = [...R.querySelectorAll('.mrail .mval.lever')].filter(vis).map(b => ({ label: b.querySelector('i')?.textContent ?? '', value: b.querySelector('b')?.textContent ?? '' }));
    const href = R.querySelector('.mrow.sel')?.getAttribute('href') ?? '';
    return { href, rows, keys: href.replace(/^[^?]*\?/, '').split('&').filter(k => /^(quietfog|cams)\b/.test(k)).join('&') || '(neither)', cut: [...R.querySelectorAll('.mrail .mval b')].filter(e => vis(e) && e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent) }; });
  const val = (r, label) => r.rows.find(x => x.label === label)?.value ?? null;
  const press = async label => { const btns = page.locator('#missions .mrail .mval.lever:not([hidden])'); const n = await btns.count();
    for (let i = 0; i < n; i++) if ((await btns.nth(i).locator('i').textContent()) === label) { await btns.nth(i).click(); await page.waitForTimeout(250); return true; } return false; };

  const wipe = () => page.evaluate(() => { localStorage.removeItem('twopointsix.quietfog'); localStorage.removeItem('twopointsix.quietcams'); });
  await open('paused&quality=verylow&mute'); await wipe(); await open('paused&quality=verylow&mute');
  await goRow(QUIET); const r0 = await rail(); await page.screenshot({ path: path.join(outDir, '1-quiet-fresh.png') });
  const fogLabel = r0.rows.find(x => /fog/i.test(x.label))?.label ?? 'Fog of war', fog = r => val(r, fogLabel);
  check(val(r0, 'Sticky cameras') === '2' && r0.keys === '(neither)' && !!fog(r0) && !/^off$/i.test(fog(r0)) && !r0.cut.length, 'a quiet mission\'s rail on a fresh machine: the fog row lit on a fog rung, Sticky cameras on 2, the link carrying neither key; nothing on the rail is cut short', `rail ${JSON.stringify(r0.rows)} · link ${r0.keys} · cut ${JSON.stringify(r0.cut)}`);
  await press('Sticky cameras'); const r1 = await rail();
  check(val(r1, 'Sticky cameras') === 'None' && r1.keys === 'cams=0' && fog(r1) === fog(r0), 'one click on Sticky cameras lets them go and leaves the fog: the link says cams=0 and nothing else', `rail ${JSON.stringify(r1.rows)} · link ${r1.keys}`);
  await press('Sticky cameras'); const r2 = await rail(); await page.screenshot({ path: path.join(outDir, '2-quiet-cameras.png') });
  check(val(r2, 'Sticky cameras') === '2' && r2.keys === '(neither)', 'a second click hands them back: the link is bare again', `rail ${JSON.stringify(r2.rows)} · link ${r2.keys}`);
  await press(fogLabel); const r3 = await rail();
  check(r3.keys === 'quietfog=cones' && val(r3, 'Sticky cameras') === '2', 'one click on the fog row: the next rung, named on the link, the cameras kept', `rail ${JSON.stringify(r3.rows)} · link ${r3.keys}`);
  await press(fogLabel); await press(fogLabel); const r4 = await rail(); await page.screenshot({ path: path.join(outDir, '2b-quiet-all-shown.png') });
  check(r4.keys === 'quietfog=off' && val(r4, 'Sticky cameras') === 'None', 'two more: all guards shown is quietfog=off on the link, and no camera goes with it (nothing for one to show)', `rail ${JSON.stringify(r4.rows)} · link ${r4.keys}`);
  await press(fogLabel); const r4b = await rail();
  check(r4b.keys === '(neither)' && val(r4b, 'Sticky cameras') === '2' && fog(r4b) === fog(r0), 'one more is back where a quiet mission starts: the cameras are back with the fog, the link bare', `rail ${JSON.stringify(r4b.rows)} · link ${r4b.keys}`);
  await wipe(); await open('paused&quality=verylow&mute&quietdef=off'); await goRow(QUIET); const r5a = await rail();
  await press('Sticky cameras'); const r5 = await rail();
  check(val(r5a, 'Sticky cameras') === 'None' && r5a.keys === '(neither)' && val(r5, 'Sticky cameras') === '2' && r5.keys === 'quietfog=team&cams=2', '?quietdef=off: a quiet mission starts all shown as it did (None, a bare link), and ONE click on Sticky cameras is the fog and the cameras', `fresh: rail ${JSON.stringify(r5a.rows)} · link ${r5a.keys} · after the click: rail ${JSON.stringify(r5.rows)} · link ${r5.keys}`);
  await wipe(); await open('paused&quality=verylow&mute');
  await goRow(SQUAD); const r6 = await rail(); await page.screenshot({ path: path.join(outDir, '3-squad.png') });
  check(val(r6, 'Sticky cameras') === null && r6.keys === '(neither)', 'a squad mission\'s rail has no Sticky cameras row and its link neither key', `rail ${JSON.stringify(r6.rows)} · link ${r6.keys}`);
  await open('paused&quality=verylow&mute&nosticky'); await goRow(QUIET); const r7 = await rail();
  check(val(r7, 'Sticky cameras') === null, '?nosticky: no Sticky cameras row', `rail ${JSON.stringify(r7.rows)} · link ${r7.keys}`);
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  // THE MISSION ITSELF, behind that link (GAME=0 skips it: ~4 min a load here). The fresh rail's own link for the quiet mission, less the harness's `paused` (a player's link has none; quality=verylow&mute stay: the software
  // adapter's cost and the sound, no rule), opened in a browser of its own that HAS a WebGPU adapter (the software one, as shipped-page.cjs asks for it). Read off window.__game / window.__knobs after window.__ready.
  if (process.env.GAME !== '0') {
    const link = (r0.href || `?levelFile=police-post.json&quiet&quality=verylow&mute`).replace(/^[^?]*\?/, '').split('&').filter(k => k && k !== 'paused').join('&');
    const gb = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
    const load = async q => { const pg = await (await gb.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage(), errs = []; pg.setDefaultTimeout(900000);   // (a context of its own: an empty store)
      pg.on('pageerror', e => errs.push(`page error: ${String(e).slice(0, 300)}`));
      pg.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errs.push(`console error: ${m.text().slice(0, 300)}`); });   // (a failed resource is named by the response line below; a WebGPU software-adapter line is a warning, never counted)
      pg.on('response', r => { if (r.status() >= 400 && !/\/favicon\.ico$/.test(new URL(r.url()).pathname)) errs.push(`${r.status()} ${r.url()}`); });   // (the browser's own favicon ask is no resource of the page)
      let v = null, why = '';
      try { await pg.goto(`http://localhost:${PORT}/?${q}`, { timeout: 900000 });
        v = await pg.evaluate(async () => { await window.__ready; const g = window.__game, pl = g.player, t0 = g.time, until = performance.now() + 90000;
          while (!(g.time > t0) && performance.now() < until) await new Promise(r => setTimeout(r, 250));   // the game clock moves = it is running, not only built
          const K = window.__knobs && typeof window.__knobs.registry === 'function' ? window.__knobs.registry() : null;
          return { wand: pl.wand, cams: pl.rifle ? pl.rifle.cams : null, fog: g.fogOfWar ? g.fogOfWar.active : null, time: +g.time.toFixed(2), knobs: !!K, take: K && K.STICKY ? K.STICKY.take : null, qwand: K && K.QUIETFOG ? K.QUIETFOG.wand : null }; });
      } catch (e) { why = String(e).slice(0, 300); }
      await pg.close(); return { v, why, errs }; };
    const a = await load(link), b = await load(`${link}&camtake=0&quietwand=0`), say = x => x.v ? JSON.stringify(x.v) : `the page did not come ready — ${x.why}`;
    check(!!a.v && a.v.wand === true && a.v.cams === 2 && a.v.fog === true && a.v.time > 0, 'the quiet mission\'s own link, in play: the player holds the optical wand, 2 sticky cameras ride the rifle, the fog of war is live, the game clock runs', `?${link} · ${say(a)}`);
    check(!!a.v && a.v.knobs && a.v.take === true && a.v.qwand === true, 'that page\'s switches (window.__knobs): STICKY.take and QUIETFOG.wand are both on', a.v ? (a.v.knobs ? `STICKY.take ${a.v.take} · QUIETFOG.wand ${a.v.qwand}` : 'window.__knobs.registry is not there: not read') : say(a));
    check(!!b.v && !b.v.wand && b.v.cams === 2 && b.v.fog === true && b.v.time > 0, '&camtake=0&quietwand=0: no wand on the player, still 2 cameras, the fog still live', `${say(b)}`);
    check(!!b.v && b.v.knobs && b.v.take === false && b.v.qwand === false, '&camtake=0&quietwand=0: both switches read off', b.v ? (b.v.knobs ? `STICKY.take ${b.v.take} · QUIETFOG.wand ${b.v.qwand}` : 'window.__knobs.registry is not there: not read') : say(b));
    const all = [...a.errs.map(e => `bare link: ${e}`), ...b.errs.map(e => `both off: ${e}`)];
    check(all.length === 0, 'no console error, page error or failed resource on either load of the mission', all.length ? `${all.length} (${a.errs.length} + ${b.errs.length}), the first: ${all[0]}` : '0 + 0');
    await gb.close();
  }
  await browser.close();
  console.log(failed ? '=== sticky-page: FAILED ===' : '=== sticky-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
