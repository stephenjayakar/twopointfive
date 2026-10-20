// THE FIRST CLICK AND A DEVICE THAT GOES (src/audio/audio.ts SFX_WARM, src/gpu/device.ts GPU_LOST), on the real page in headless Chromium, software WebGPU adapter.
//   1. the page as it opens, sound on: the sounds are made a voice at a time while it boots (none left by the time it is ready and idle), the mixer's start
//      inside the first click is then short, and every sound of the table has its buffer; the same page under ?sfxwarm=0 makes the whole table inside start,
//      as it was — the two times are printed side by side, and the new one must be under a third of the old.
//   2. the page's device destroyed (what a load to another address does to it), on a page that draws nothing: once the browser has told the loss, no red
//      card and no console error; under ?gpuretry=0 the card, as it was.
//   node tools/qa/shaderwait-page.cjs        env: PORT (the dev server's, default 5199) · SHADERWAIT_ONLY=lost = the lost-device checks alone
// A real loss (a driver that falls over) cannot be made here: its rule is tools/qa/gpulost-check.ts's. Nothing here is heard, and no time is a real machine's.
// Exit 0 = every check passed, 1 = one failed or a page did not boot.   SHADERWAIT_BREAK=1: step 1 runs both pages under ?sfxwarm=0 — must FAIL.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, BREAK = process.env.SHADERWAIT_BREAK === '1';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--autoplay-policy=no-user-gesture-required'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let red = 0; const check = (ok, what) => { console.log(`${ok ? '- PASS' : '- FAIL'} — ${what}`); if (!ok) red++; };
const BASE = `http://localhost:${PORT}/?quality=medium&levelFile=train-move.json&quiet`;

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { window.__testVisible = true; });
  // a browser the mixer has started in before: the page's guess at the output's rate is the right one (audio.ts SFX_WARM — a first visit's wrong guess is tools/qa/sfxwarm-check.ts's)
  await ctx.addInitScript(() => { try { const c = new AudioContext(); localStorage.setItem('twopointsix.sfxRate', String(c.sampleRate)); c.close(); } catch { /* the page guesses */ } });
  const open = async extra => { const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/favicon|:5174\//.test(m.location().url || '')) errs.push(m.text().slice(0, 300)); });
    log(BASE + extra); await page.goto(BASE + extra, { waitUntil: 'commit' });
    try { await page.waitForFunction(() => !!window.__ready, null, { timeout: 1500000 }); await page.evaluate(async () => { await window.__ready; }); } catch (e) { check(false, `${extra || 'the page'}: did not come ready — ${String(e).slice(0, 200)} ${errs[0] ?? ''}`); return null; }
    return { page, errs }; };
  const startMs = page => page.evaluate(() => { const a = window.__audio; const t = performance.now(); a.start(); const ms = performance.now() - t; const names = ['pistolLoud', 'pistolSuppressed', 'chairRoll', 'thunderFar', 'click', 'wallDebris', 'footSoft']; return { ms, started: a.started, rate: a.backend.sfxContext.sampleRate, missing: names.filter(n => !(a.backend.duration(n) > 0)), warm: window.__sfxWarm() }; });

  // 1. the first click
  const LOST_ONLY = process.env.SHADERWAIT_ONLY === 'lost';   // the device checks alone, two pages
  const A = LOST_ONLY ? null : await open(BREAK ? '&sfxwarm=0' : '');
  const B = LOST_ONLY ? null : await open('&sfxwarm=0');
  if (A && B) {
    await A.page.waitForFunction(() => window.__sfxWarm().left === 0, null, { timeout: 120000 }).catch(() => {});
    const w = await A.page.evaluate(() => window.__sfxWarm());
    check(w.left === 0 && w.waiting >= 80 && !w.live, `as it opens: every sound is made before any click (${w.waiting} waiting, ${w.left} left, ${w.slices} slices, the longest ${w.longest.toFixed(0)} ms)`);
    const a = await startMs(A.page), b = await startMs(B.page);
    check(a.warm.rate === a.rate, `as it opens: they were made at the output's own rate (${a.warm.rate} Hz, the mixer's ${a.rate})`);
    check(a.started && a.missing.length === 0, `as it opens: the mixer starts and the table's sounds have their buffers${a.missing.length ? ` — missing ${a.missing.join(', ')}` : ''}`);
    check(b.started && b.missing.length === 0 && b.warm.slices === 0, '?sfxwarm=0: the mixer starts with the whole table, nothing was made ahead');
    console.log(`  the mixer's start inside the first click: ${a.ms.toFixed(0)} ms as it opens · ${b.ms.toFixed(0)} ms under ?sfxwarm=0`);
    check(a.ms < b.ms / 3, `the start is under a third of what it was (${a.ms.toFixed(0)} ms against ${b.ms.toFixed(0)} ms)`);
    const left = await A.page.evaluate(() => new Promise(r => setTimeout(() => r(window.__sfxWarm()), 500)));
    check(left.left === 0 && left.waiting === 0 && left.live, 'after the start nothing waits: what was made is the mixer\'s');
    check(A.errs.length === 0 && B.errs.length === 0, `no page or console error on either page${A.errs.length + B.errs.length ? ` — ${[...A.errs, ...B.errs][0]}` : ''}`);
  }
  // 2. the device destroyed, on pages of their own that draw nothing (?paused): the browser's GPU side tells the loss, and behind a software-drawn frame that is
  //    minutes late — a page that was only waited on for a second passed "no card" without the loss ever having been told. The loss must be TOLD, then judged.
  if (A) await A.page.close(); if (B) await B.page.close();
  const lose = page => page.evaluate(async () => { const d = window.__engine.gpu.device; let told = null; d.lost.then(i => { told = { reason: i.reason, message: i.message }; });
    d.destroy(); for (let i = 0; i < 600 && !told; i++) await new Promise(r => setTimeout(r, 500)); await new Promise(r => setTimeout(r, 500));
    const f = document.getElementById('fatal'); return { told, up: getComputedStyle(f).display !== 'none', text: f.textContent }; });
  { const D = await open('&paused&mute');
    if (D) { const before = D.errs.length; const r = await lose(D.page);
      check(!!r.told && r.told.reason === 'destroyed', `as it opens: the browser tells the page its device is gone (reason ${r.told ? r.told.reason : 'never told'})`);
      check(!!r.told && !r.up, 'as it opens: a device destroyed (a page on its way out) puts no card up');
      check(D.errs.slice(before).filter(e => /device lost/i.test(e)).length === 0, "as it opens: and prints no 'device lost' error");
      await D.page.close(); } }
  { const C = await open('&paused&mute&gpuretry=0');
    if (C) { const r = await lose(C.page);
      check(!!r.told && r.up && /^GPU device lost: /.test(r.text) && !/\n/.test(r.text), `?gpuretry=0: the card at once with the one line it always had ("${String(r.text).slice(0, 80)}"${r.told ? '' : ' — the loss was never told'})`);
      await C.page.close(); } }
  await browser.close();
  console.log(red ? `${red} FAILED` : 'all passed');
  process.exit(red ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
