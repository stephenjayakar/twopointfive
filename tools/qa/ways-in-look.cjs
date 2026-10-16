// WAYS IN, LOOKED AT ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's own recipe — SwiftShader, no
// GPU) once per way into the build that is NOT a row of the scenario list — the plain start card, ?solo, ?loadout=, ?demo, ?breach, a ?levelFile= / ?level= with
// no scenario on it — and write down what the page itself says it opened: the card's buttons, the mission list's rows, the level, who is on the floor, whether a
// scenario or a showcase is up, the console's errors, and what a stretch of the page's own loop does to it. A measuring tool: it edits nothing.
//   node tools/qa/ways-in-look.cjs <outDir> [name=query[:kind] ...]      kind: plain (default) | card | show
//     plain   the card read, then closed (= Start), SECS of the page's loop, the state read again, one still
//     card    plain, and before closing the card: MISSIONS clicked and the list's words kept (a still of each)
//     show    a showcase URL: the loop run until the show hands back (the start card up again) or SHOW_CAP sim seconds; where it was every 10 s
//   env: PORT (the dev server's, default 5199) · SIZE (960x540) · QUALITY (verylow) · SECS (20) · SHOW_CAP (300) · FRAMES (drawn frames a still, 2)
//   With no jobs: the full round (JOBS below).
// The smoke solver is switched off and its 15 pipelines' compile failures are counted as noise, exactly as page-look.cjs does and for its reason.
// Slow by nature: a page takes a minute and a half to boot here, a drawn frame 5–15 s. Between stills the loop runs with the renderer stubbed out.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'ways-in-look';
const JOBS = ['plain=:card', 'solo=solo', 'loadout=loadout=solo-night', 'demo=demo:show', 'breach=breach:show',
  'kityard=levelFile=kit-yard.json', 'kityard-rc=levelFile=kit-yard.json&roomclear&squad4', 'testrooms=levelFile=test-rooms.json', 'testrooms-rc=levelFile=test-rooms.json&roomclear',
  'testrooms-rescue=levelFile=test-rooms.json&rescue', 'relief=level=relief', 'relief-file=levelFile=office-relief.json',
  'local=level=local', 'nofile=levelFile=no-such-level.json'];
const jobs = (process.argv.length > 3 ? process.argv.slice(3) : JOBS).map(a => { const i = a.indexOf('='), name = i < 0 ? a : a.slice(0, i); let query = i < 0 ? '' : a.slice(i + 1), kind = 'plain';
  const m = query.match(/:(plain|card|show)$/); if (m) { kind = m[1]; query = query.slice(0, -m[0].length); } return { name, query, kind }; });
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow', SECS = Number(process.env.SECS || 20), SHOW_CAP = Number(process.env.SHOW_CAP || 300), FRAMES = Number(process.env.FRAMES || 2);
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });

const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  return true;
};
const PLAY = (secs) => {
  const e = window.__engine, real = e.render; let threw = null;
  e.render = () => {};
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw;
};
// what the page says is open (everything read off the page's own hooks and DOM)
const SNAP = () => {
  const g = window.__game, D = g.director, txt = (el) => (el && el.textContent || '').replace(/\s+/g, ' ').trim();
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  return { search: location.search, menu: window.__menu.mode, buttons: [...document.querySelectorAll('#menu button')].filter(vis).map(txt).filter(Boolean).slice(0, 24),
    time: +g.time.toFixed(1), stage: g.mission && g.mission.stage, guards: g.guards.map(x => `${x.callsign}:${x.team}:${x.state}`), civilians: (g.civilians || []).length,
    doors: g.doors.list.length, statics: (g.world && g.world.statics || []).length, spawn: g.player.char.pos.map(v => +v.toFixed(1)),
    scenario: g.roomClear && g.roomClear.active ? 'roomclear' : g.nightBreach && g.nightBreach.active ? 'nightbreach' : g.rescue && g.rescue.active ? 'rescue' : null,
    show: D && D.showing ? (D.frame && D.frame.program || true) : null, caption: D && D.frame && D.frame.caption || null, daylight: !!(g.level && g.level.daylight && document.body.classList.contains('breaching')),
    fog: g.fogOfWar && g.fogOfWar.on, msg: g.message || null, bodyClass: document.body.className, down: g.player.down, fatal: txt(document.getElementById('fatal')) };
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const report = [];
  for (const job of jobs) {
    const R = { name: job.name, query: job.query, kind: job.kind, errors: [], noise: 0, notes: [] }; report.push(R);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return;
      if (/Failed to load resource/.test(x)) return;
      if (NOISE.test(x) && R.noise < NOISE_MAX) R.noise++; else R.errors.push(`${t}: ${x.slice(0, 500)}`); });
    page.on('requestfailed', r => R.errors.push(`request failed: ${r.url()} — ${r.failure()?.errorText ?? '?'}`));
    page.on('response', r => { if (r.status() >= 400) { const u = r.url(); if (/favicon/.test(u)) R.notes.push(`${r.status()} ${u}`); else R.errors.push(`http ${r.status()}: ${u}`); } });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
    const shot = (tag) => page.screenshot({ path: path.join(outDir, `${job.name}-${tag}.png`) }).catch(() => {});
    try {
      const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${job.query ? '&' + job.query : ''}`;
      log(job.name, 'goto', url); await page.goto(url);
      const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines }; });
      log(job.name, 'ready', JSON.stringify(ready)); if (ready.fatal) R.errors.push('fatal: ' + ready.fatal);
      await page.waitForTimeout(2500);   // (?demo starts its show a second and a half after boot)
      await page.evaluate(() => { window.__smoke.params.enabled = false; });
      R.boot = await page.evaluate(SNAP); log(job.name, 'boot', JSON.stringify(R.boot)); await shot('boot');
      if (job.kind === 'card') {
        // every layer the card can open without leaving the page: the mission list's words
        const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('#menu button')].find(x => /^(Missions|Play)/.test((x.textContent || '').trim())); if (!b) return false; b.click(); return true; });
        await page.waitForTimeout(400);
        R.missions = await page.evaluate(() => { const rows = [...document.querySelectorAll('a[href*="?"], [class*="mission"] [class*="row"], [class*="ms-"]')].map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(t => t && t.length < 240);
          return { rows: [...new Set(rows)].slice(0, 60), links: [...new Set([...document.querySelectorAll('a[href*="?"]')].map(a => a.getAttribute('href')))].slice(0, 40), words: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 4000) }; });
        R.missions.clicked = clicked; log(job.name, 'missions', `${R.missions.links.length} links`); await shot('missions');
        await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      }
      if (job.kind === 'show') {
        R.timeline = []; let threw = null, back = false;
        for (let s = 0; s < SHOW_CAP && !threw && !back; s += 10) { threw = await page.evaluate(PLAY, 10); const z = await page.evaluate(SNAP); R.timeline.push({ t: z.time, show: z.show, menu: z.menu, caption: z.caption, guards: z.guards.length });
          if (s === 30 || s === 90) { await page.evaluate(DRAW, FRAMES); await shot(`at${s + 10}`); }
          back = !z.show && z.menu === 'start'; }
        if (threw) R.errors.push('play threw: ' + threw);
        R.end = await page.evaluate(SNAP); R.handedBack = back; log(job.name, 'show', JSON.stringify({ back, last: R.timeline[R.timeline.length - 1] })); await shot('end');
      } else {
        if (R.boot.menu === 'start') await page.evaluate(() => window.__menu.close());   // (= the card's Start)
        let threw = await page.evaluate(PLAY, SECS); if (threw) R.errors.push('play threw: ' + threw);
        R.played = await page.evaluate(SNAP); log(job.name, 'played', JSON.stringify(R.played));
        await page.evaluate(DRAW, FRAMES); await shot('played');
        if (job.name === 'solo') {   // the P key on a floor in play: it must start nothing (src/game/showkey.ts) — afterP.show stays null
          await page.evaluate(() => { window.__input.pressed.add('KeyP'); }); threw = await page.evaluate(PLAY, 3); if (threw) R.errors.push('play threw (P): ' + threw);
          R.afterP = await page.evaluate(SNAP); log(job.name, 'after P', JSON.stringify({ show: R.afterP.show, menu: R.afterP.menu }));
        }
      }
    } catch (x) { R.errors.push('look threw: ' + String(x && x.stack || x).slice(0, 600)); log(job.name, 'THREW', String(x).slice(0, 200)); }
    log(job.name, `errors ${R.errors.length} · noise ${R.noise}`); for (const e of R.errors.slice(0, 6)) log('   ', e.slice(0, 300));
    await page.close().catch(() => {});
    fs.writeFileSync(path.join(outDir, 'ways-in-look.json'), JSON.stringify(report, null, 1));
  }
  await browser.close();
  log('done');
})();
