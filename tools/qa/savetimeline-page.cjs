// THE SAVE TIMELINE ON THE REAL PAGE (src/game/savestate.ts SAVETIMELINE): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe).
//   PORT=5199 node tools/qa/savetimeline-page.cjs [outDir]     (a dev server on that port: PORT=5199 bun run tools/serve.ts; JOBS=on,lesson,off picks jobs)
//   on      the plain night as the page opens it: F5 (a real keydown, kept from the browser) three times a few seconds apart, each on a drawn frame; the pause card's strip shows three tiles in time
//           order, each with a picture that is not one flat colour; a click on the middle one closes the card with the mission clock at that save's; the
//           down card shows the strip too; no page error
//   lesson  Training five (a pair on the floor): F5 saves are kept in memory and show on the strip with pictures; a light is put out AFTER the save and the
//           save loaded from its tile — the frame drawn after the load is lit as the frame at the save was, not as the dark one (the GPU's buffers were told:
//           host/putback.ts); SAVEPUTBACK_BREAK=1 takes that telling away and this line must FAIL
//   off     ?savetimeline=0: F5 writes nothing and the pause card has no strip
// exit 0 = every job asked for, with no page error · 1 = otherwise. Game logic and the DOM decide; the one judgment of a picture is a mean brightness, three
// frames against each other. With an outDir it keeps the stills and a screenshot of each card for a person to look at.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '', BREAK = process.env.SAVEPUTBACK_BREAK === '1';
const JOBS = (process.env.JOBS || 'on,lesson,off').split(',');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { e.render = real; } };
// in the page: one step with its frame DRAWN and presented (a save's picture is taken off the canvas after such a frame), the GPU through with it
const FRAME = async () => { window.__runFrames(1, 1 / 60); await window.__engine.device.queue.onSubmittedWorkDone(); };
// in the page: draw n frames one at a time, read the last one back: its mean brightness, and (with `keep`) a PNG data URL (page-look.cjs DRAW)
const DRAW = async ([n, keep]) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0; for (let i = 0; i < fr.data.length; i += 4) { fr.data[i + 3] = 255; sum += fr.data[i] * 0.3 + fr.data[i + 1] * 0.59 + fr.data[i + 2] * 0.11; }
  const out = { lum: sum / (fr.data.length / 4), url: null };
  if (keep) { const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0); out.url = c2.toDataURL('image/png'); }
  return out;
};
const SET = () => { const g = window.__game; window.__menu?.close?.(); if (window.__smoke) window.__smoke.params.enabled = false; g.godMode = true; g.playerInvisible = true; g.saves.enabled = false; g.saves.clear();
  return { on: !!window.__save && g.saves.timeline().length === 0, units: g.guards.filter(x => x.unit).length, saveKey: !!(window.__input.saveKey && window.__input.saveKey()) }; };
// in the page: F5 as the keyboard gives it (a keydown on the window: was it kept from the browser?), then a drawn frame
const F5 = async () => { const g = window.__game, n0 = g.saves.stats.manual; const ev = new KeyboardEvent('keydown', { code: 'F5', key: 'F5', bubbles: true, cancelable: true }); window.dispatchEvent(ev); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'F5', key: 'F5', bubbles: true })); window.__runFrames(1, 1 / 60); await window.__engine.device.queue.onSubmittedWorkDone(); return { wrote: g.saves.stats.manual - n0, kept: ev.defaultPrevented, t: g.mission.stats.elapsed, msg: (g.messages[g.messages.length - 1] || {}).text || '' }; };
// in the page: the strip as a card lays it out — per tile its classes, its age, and its picture decoded and measured
const STRIP = async (mode) => {
  const g = window.__game; window.__menu.open(mode); await new Promise(r => setTimeout(r, 50));
  const tiles = [...document.querySelectorAll('#menu .saves .tile')], out = [];
  for (const t of tiles) {
    const m = /url\("?(data:[^")]+)"?\)/.exec(t.style.backgroundImage || ''); const o = { cls: t.className, age: (t.querySelector('.age') || {}).textContent || '', bytes: m ? m[1].length : 0, w: 0, h: 0, range: 0, tab: t.tabIndex };
    if (m) { const img = new Image(); img.src = m[1]; try { await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const cx = c.getContext('2d'); cx.drawImage(img, 0, 0); const d = cx.getImageData(0, 0, c.width, c.height).data; let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const y = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; if (y < lo) lo = y; if (y > hi) hi = y; } o.w = img.width; o.h = img.height; o.range = Math.round(hi - lo); } catch (e) { o.err = String(e); } }
    out.push(o);
  }
  const line = g.saves.timeline().map(x => ({ key: x.key.replace('twopointsix.save.', ''), t: x.missionT, mem: !!x.mem, slot: x.slot }));
  return { tiles: out, line, btn: [...document.querySelectorAll('#menu .btn')].map(b => b.textContent).filter(s => /checkpoint/i.test(s)), strip: !!document.querySelector('#menu .saves') };
};
// in the page: a click on the k-th tile of the strip that is up; the card gone, the mission clock where it now stands
const PICK = (k) => { const g = window.__game, t = document.querySelectorAll('#menu .saves .tile')[k]; if (!t) return { err: 'no such tile' }; t.click(); return { open: document.getElementById('menu').classList.contains('on'), t: g.mission.stats.elapsed, loads: g.saves.stats.loads, fatal: (document.getElementById('fatal') || {}).textContent || '' }; };
// in the page (lesson): the nearest light that burns, the camera pinned on it
const LAMP = () => { const g = window.__game, p = g.player.char.pos; let best = null, bd = 1e9; for (const t of g.targets) { if (!t.on || t.broken || t.kind === 'breaker' || !t.boxes || !t.boxes.length) continue; const d = Math.hypot(t.pos[0] - p[0], t.pos[2] - p[2]); if (d < bd) { bd = d; best = t; } }
  if (!best) return null; window.__lamp = best; return { name: best.name, d: +bd.toFixed(1) }; };
const PIN = () => { const t = window.__lamp; window.__stage({ look: [t.pos[0], 0.6, t.pos[2]], yaw: 0.6, pitch: 0.9, dist: 9 }, {}); };
const OUT = () => { const t = window.__lamp; t.broken = true; return t.broken; };
const LAMPSTATE = () => { const t = window.__lamp; return { broken: t.broken, on: t.on }; };

(async () => {
  let red = 0;
  const defs = { on: '', lesson: 'levelFile=train-orders.json&roomclear=1&', off: 'savetimeline=0&' };
  for (const name of JOBS) {
    const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });   // (a browser per job: one that dies under the software adapter costs its own job only)
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?${defs[name]}paused&quality=${QUALITY}&mute`; log(`${name}: ${url}`);
    const r = {}, fails = [];
    const keep = async (tag, o) => { if (outDir && o && o.url) fs.writeFileSync(path.join(outDir, `savetimeline-${name}-${tag}.png`), Buffer.from(o.url.split(',')[1], 'base64')); };
    const shot = async (tag) => { if (outDir) await page.screenshot({ path: path.join(outDir, `savetimeline-${name}-${tag}.png`) }).catch(() => { }); };
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 30);
      r.set = await page.evaluate(SET); log(`${name}: up`, JSON.stringify(r.set));
      if (name === 'off') {
        await page.evaluate(STEP, 60); r.f5 = await page.evaluate(F5); r.strip = await page.evaluate(STRIP, 'pause');
        if (r.f5.wrote !== 0) fails.push(`F5 wrote ${r.f5.wrote} saves with the switch off`); if (r.strip.strip) fails.push('the pause card has a strip with the switch off'); if (r.set.saveKey || r.f5.kept) fails.push('F5 is kept from the browser with the switch off');
      } else {
        r.saves = [];
        for (let i = 0; i < 3; i++) { await page.evaluate(STEP, 200); const s = await page.evaluate(F5); await page.evaluate(FRAME); r.saves.push(s); log(`${name}: F5 #${i}`, JSON.stringify(s)); }
        if (r.saves.some(s => s.wrote !== 1)) fails.push(`F5 wrote ${r.saves.map(s => s.wrote).join(',')} (want 1,1,1) — ${r.saves.map(s => s.msg).join(' | ')}`);
        if (name === 'lesson') {
          // the light: lit at the last save, put out after it, the save loaded — lit again on the GPU?
          r.lamp = await page.evaluate(LAMP); if (!r.lamp) fails.push('no burning light near him');
          else {
            await page.evaluate(PIN); await page.evaluate(STEP, 30); const s = await page.evaluate(F5); await page.evaluate(FRAME); if (s.wrote !== 1) fails.push(`the save by the light: ${s.msg}`);
            const A = await page.evaluate(DRAW, [3, !!outDir]); await keep('lit-at-save', A);
            await page.evaluate(OUT); await page.evaluate(STEP, 90);
            const B = await page.evaluate(DRAW, [3, !!outDir]); await keep('light-out', B);
            await page.evaluate(() => window.__stage(null, {}));
            r.strip = await page.evaluate(STRIP, 'pause'); await shot('pause-card');
            if (BREAK) await page.evaluate(() => { window.__game.saves.onPutBack = null; });
            const last = r.strip.tiles.length - 1; r.pick = await page.evaluate(PICK, last); r.lampAfter = await page.evaluate(LAMPSTATE);
            await page.evaluate(PIN); await page.evaluate(STEP, 2);
            const C = await page.evaluate(DRAW, [3, !!outDir]); await keep('after-load', C);
            r.lum = { A: +A.lum.toFixed(2), B: +B.lum.toFixed(2), C: +C.lum.toFixed(2) }; log(`${name}: brightness`, JSON.stringify(r.lum));
            if (r.lampAfter.broken) fails.push('the light is still broken in the game after the load');
            if (!(A.lum - B.lum > 0.5)) fails.push(`putting the light out did not darken the frame (${r.lum.A} → ${r.lum.B}): the check cannot tell`);
            else if (!(Math.abs(C.lum - A.lum) < 0.35 * (A.lum - B.lum))) fails.push(`the frame after the load is not lit as the save's was: at the save ${r.lum.A}, light out ${r.lum.B}, after the load ${r.lum.C}`);
            if (r.pick.err || r.pick.open || r.pick.fatal) fails.push(`the tile's click: ${JSON.stringify(r.pick)}`);
            if (r.strip.tiles.length !== 4 || !r.strip.line.every(x => x.mem)) fails.push(`the strip: ${r.strip.tiles.length} tiles, in memory ${r.strip.line.map(x => x.mem).join(',')} (want 4, all in memory)`);
            if (r.strip.tiles.some(t => !(t.range > 12 && t.w > 0))) fails.push(`a tile's picture is missing or flat: ${r.strip.tiles.map(t => `${t.w}x${t.h} range ${t.range}`).join(' · ')}`);
          }
        } else {
          r.strip = await page.evaluate(STRIP, 'pause'); await shot('pause-card');
          const T = r.strip.tiles, L = r.strip.line;
          if (T.length !== 3) fails.push(`the pause card shows ${T.length} tiles (want 3)`);
          if (T.some(t => !(t.range > 12 && t.w > 0))) fails.push(`a tile's picture is missing or flat: ${T.map(t => `${t.w}x${t.h} range ${t.range}`).join(' · ')}`);
          if (!T.every(t => /hand/.test(t.cls))) fails.push(`the tiles are not marked as made by hand: ${T.map(t => t.cls).join(' | ')}`);
          if (L.length === 3 && !(L[0].t < L[1].t && L[1].t < L[2].t)) fails.push(`the strip is not in time order: ${L.map(x => x.t.toFixed(1)).join(',')}`);
          if (T.filter(t => t.tab === 0).length !== 1) fails.push('the strip is not one stop for the keys');
          if (!r.strip.btn.length) fails.push('the card lost its "Restart from checkpoint" button');
          r.pick = await page.evaluate(PICK, 1);
          if (r.pick.err || r.pick.open || r.pick.fatal || L.length !== 3 || Math.abs(r.pick.t - L[1].t) > 0.1) fails.push(`the middle tile: clock ${r.pick.t} (its save ${L[1] ? L[1].t : '?'}), card still up ${r.pick.open}, ${r.pick.err || r.pick.fatal || ''}`);
          await page.evaluate(FRAME);
          // the down card
          await page.evaluate(() => { const g = window.__game; g.godMode = false; g.player.down = true; });
          r.down = await page.evaluate(STRIP, 'debrief'); await shot('down-card');
          if (r.down.tiles.length !== 3) fails.push(`the down card shows ${r.down.tiles.length} tiles (want 3)`); if (!r.down.btn.length) fails.push('the down card has no "Restart from checkpoint"');
          await page.evaluate(() => { const g = window.__game; g.player.down = false; g.godMode = true; window.__menu.close(); });
          r.bytes = T.map(t => t.bytes);
        }
        if (!r.set.saveKey || r.saves.some(s => !s.kept)) fails.push('F5 is not kept from the browser');
      }
    } catch (e) { fails.push(String(e).slice(0, 300)); }
    await page.close().catch(() => { }); await browser.close().catch(() => { });
    if (errs.length) fails.push(`page errors: ${errs.slice(0, 3).join(' | ')}`);
    const ok = !fails.length; if (!ok) red++;
    const said = { on: 'the page as it opens: three F5 saves a few seconds apart; the pause card shows three tiles in time order, each a picture; the middle one loads to its own mission clock; the down card shows them too',
      lesson: `Training five, a pair on the floor: saves kept in memory show on the strip with pictures; a light put out after a save is lit again on the frame after its load${BREAK ? ' (SAVEPUTBACK_BREAK: the host is not told)' : ''}`,
      off: 'under ?savetimeline=0: F5 writes nothing, the pause card has no strip' }[name];
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${said}\n    ${JSON.stringify({ set: r.set, saves: (r.saves || []).map(s => +s.t.toFixed(1)), tiles: r.strip ? r.strip.tiles.map(t => `${t.w}x${t.h} ${(t.bytes / 1024).toFixed(1)}KB range ${t.range} '${t.age}'`) : null, pick: r.pick, lum: r.lum, lamp: r.lamp })}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== savetimeline-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
