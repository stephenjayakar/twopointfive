// THE SOLO NIGHT UNDER THE FOG OF WAR, ON THE REAL PAGE (game/quietfog.ts QUIETFOG.solo): on the start page the solo night's row has the fog's lever and
// the Sticky cameras row lit as a quiet mission's are, its link is the bare `?solo`; stepped into Team & kit, the sticky cameras and the optical wand tiles
// do not read 'no use here' and show what the mission hands out; under &solofog=0 the rail has neither row lit and the tiles show the card's own, as they did.
//   PORT=5241 node tools/qa/solofog-page.cjs [outDir]      (a dev server on that port: PORT=5241 bun run tools/serve.ts)
// No GPU is asked for that part (the start page is plain DOM; the boot stops at 'No WebGPU adapter' behind it). Then the run behind the link, on the software
// adapter (a second browser; GAME=0 skips): `?solo` straight in — the fog live, the wand in hand, 2 cameras on the rifle — and none of it under &solofog=0.
// PASS / FAIL lines, stills, exit 1 on a FAIL.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || 'solofog-page', PORT = process.env.PORT || 5199, SOLO = 'solo-night';
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
  const rail = () => page.evaluate(() => { const R = document.getElementById('missions'), vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.hidden; };
    const rows = [...R.querySelectorAll('.mrail .mval.lever')].filter(vis).map(b => ({ label: b.querySelector('i')?.textContent ?? '', value: b.querySelector('b')?.textContent ?? '', na: b.classList.contains('na') || b.disabled === true }));
    return { href: R.querySelector('.mrow.sel')?.getAttribute('href') ?? '', rows }; });
  // the kit tiles as drawn on the Team & kit step: the value's words and whether the tile is the faint 'of no use here' kind
  const tiles = () => page.evaluate(() => { const out = {}; for (const f of ['cams', 'wand']) { const r = document.querySelector(`#loadout .kc-row[data-field="${f}"], .lo-kit .kc-row[data-field="${f}"], .kc-row[data-field="${f}"]`);
      out[f] = r ? { idle: r.classList.contains('idle'), text: (r.querySelector('.kc-val')?.textContent ?? r.textContent ?? '').trim().toLowerCase() } : null; } return out; });
  const wipe = () => page.evaluate(() => { localStorage.removeItem('twopointsix.quietfog'); localStorage.removeItem('twopointsix.quietcams'); });
  const visit = async (q, shot) => { await open(q); await goRow(SOLO); const r = await rail(); await page.keyboard.press('Enter'); await page.waitForTimeout(900); const t = await tiles(); await page.screenshot({ path: path.join(outDir, shot) }); return { r, t }; };

  await open('paused&quality=verylow&mute'); await wipe();
  const a = await visit('paused&quality=verylow&mute', '1-solo-kit.png'), b = await visit('paused&quality=verylow&mute&solofog=0', '2-solo-kit-off.png');
  const fogOf = x => x.r.rows.find(k => /fog/i.test(k.label)), camOf = x => x.r.rows.find(k => /sticky/i.test(k.label));
  const keys = x => x.r.href.replace(/^[^?]*\?/, '').split('&').filter(k => /^(solo|quietfog|cams)\b/.test(k)).join('&');
  check(!!fogOf(a) && !fogOf(a).na && !/^off$/i.test(fogOf(a).value) && !!camOf(a) && camOf(a).value === '2' && keys(a) === 'solo', 'the solo night\'s row on the start page: the fog row lit on a fog rung, Sticky cameras on 2, the link the bare solo link', `rail ${JSON.stringify(a.r.rows)} · link ${keys(a)}`);
  check(!!a.t.cams && !!a.t.wand && !a.t.cams.idle && !a.t.wand.idle && !/no use here/.test(a.t.cams.text) && !/no use here/.test(a.t.wand.text), 'stepped into Team & kit: the sticky cameras and the optical wand tiles do not read \'no use here\'', `cameras ${JSON.stringify(a.t.cams)} · wand ${JSON.stringify(a.t.wand)}`);
  check((!fogOf(b) || fogOf(b).na || /^off$/i.test(fogOf(b).value)) && !camOf(b) && keys(b) === 'solo', '&solofog=0: the solo row has no fog rung lit and no Sticky cameras row, as it was', `rail ${JSON.stringify(b.r.rows)} · link ${keys(b)}`);
  check(!!a.t.cams && /mission/.test(a.t.cams.text) && /mission/.test(a.t.wand.text) && !!b.t.cams && !!b.t.wand && !/mission/.test(b.t.cams.text) && !/mission/.test(b.t.wand.text), 'the tiles show what the mission hands this fresh card (2 cameras and a wand, the mission\'s); under &solofog=0 nothing is handed: the card\'s own, as it was', `on: cameras ${JSON.stringify(a.t.cams)} · wand ${JSON.stringify(a.t.wand)} · off: cameras ${JSON.stringify(b.t.cams)} · wand ${JSON.stringify(b.t.wand)}`);
  check(errors.length === 0, 'no page error on the start page', errors.length ? errors[0] : 'none');
  await browser.close();

  if (process.env.GAME !== '0') {
    const gb = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
    const load = async q => { const pg = await (await gb.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage(), errs = []; pg.setDefaultTimeout(900000);
      pg.on('pageerror', e => errs.push(`page error: ${String(e).slice(0, 300)}`));
      pg.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errs.push(`console error: ${m.text().slice(0, 300)}`); });
      pg.on('response', r => { if (r.status() >= 400 && !/\/favicon\.ico$/.test(new URL(r.url()).pathname)) errs.push(`${r.status()} ${r.url()}`); });
      let v = null, why = '';
      try { await pg.goto(`http://localhost:${PORT}/?${q}`, { timeout: 900000 });
        v = await pg.evaluate(async () => { await window.__ready; const g = window.__game, pl = g.player, t0 = g.time, until = performance.now() + 90000;
          while (!(g.time > t0) && performance.now() < until) await new Promise(r => setTimeout(r, 250));   // the game clock moves = it is running, not only built
          const K = window.__knobs && typeof window.__knobs.registry === 'function' ? window.__knobs.registry() : null, live = g.guards.filter(x => x.state !== 'dead');
          return { fog: !!g.fogOfWar.active, wand: !!pl.wand, cams: pl.rifle ? pl.rifle.cams : null, time: +g.time.toFixed(2), solo: K && K.QUIETFOG ? K.QUIETFOG.solo : null, card: !!document.querySelector('#menu.on'), guards: live.length, hidden: live.filter(x => g.fogOfWar.hidden(x)).length }; });
      } catch (e) { why = String(e).slice(0, 300); }
      await pg.close(); return { v, why, errs }; };
    const x = await load('solo&quality=verylow&mute'), y = await load('solo&quality=verylow&mute&solofog=0'), say = o => o.v ? JSON.stringify(o.v) : `the page did not come ready — ${o.why}`;
    check(!!x.v && x.v.solo === true && x.v.fog === true && x.v.wand === true && x.v.cams === 2 && x.v.time > 0 && !x.v.card, 'the solo night\'s own link, in play: the fog of war is live, the optical wand in hand, 2 sticky cameras on the rifle, the game clock runs, no start card', say(x));
    check(!!y.v && y.v.solo === false && y.v.fog === false && y.v.time > 0 && y.v.hidden === 0, '&solofog=0: no fog of war and every guard shown, as the solo night was', say(y));
    const all = [...x.errs.map(e => `solo: ${e}`), ...y.errs.map(e => `off: ${e}`)];
    check(all.length === 0, 'no console error, page error or failed resource on either load', all.length ? `${all.length}, the first: ${all[0]}` : '0 + 0');
    await gb.close();
  }
  console.log(failed ? '=== solofog-page: FAILED ===' : '=== solofog-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check ran\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
