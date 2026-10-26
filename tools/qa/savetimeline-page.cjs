// THE SAVE TIMELINE ON THE REAL PAGE (src/game/savestate.ts SAVETIMELINE): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe).
//   PORT=5199 node tools/qa/savetimeline-page.cjs [outDir]     (a dev server on that port: PORT=5199 bun run tools/serve.ts; JOBS=on,lesson,off,card picks jobs)
//   on      the plain night as the page opens it: F5 (a real keydown, kept from the browser) three times a few seconds apart, each on a drawn frame; the pause card's strip shows three tiles in time
//           order, each with a picture that is not one flat colour; a click on the middle one closes the card with the mission clock at that save's; the
//           down card shows the strip too; no page error
//   lesson  the quarters yard, once Training five (a pair on the floor): F5 saves are kept in memory and show on the strip with pictures; a light is switched off AFTER the save and the
//           save loaded from its tile — the frame drawn after the load is lit as the frame at the save was, not as the dark one (the GPU's buffers were told:
//           host/putback.ts); SAVEPUTBACK_BREAK=1 takes that telling away and this line must FAIL. He is stood under the light first: a light put out where
//           nobody on the team is looking goes on showing lit in the fog's picture (game/fogofwar.ts FOG.kept, on in the page since 10-24), and from the street
//           the dark frame this line needs between the two lit ones never came (259 → 259 bright pixels, "the check cannot tell"). Switched off, not broken:
//           a light the team SEES break arcs (game/fixtureBreak.ts) and its sparks, which no undrawn step moves on, are nearly white where the bulb was
//   off     ?savetimeline=0: F5 writes nothing and the pause card has no strip
//   card    the page's own loop let go with the pause card up (the world held): F5 is kept from the browser, writes nothing yet and the card's strip shows a
//           tile to come; the card closed, the first live tick writes ONE save by hand, with its picture; under a show's key lock F5 is the browser's.
//           The card is not laid again under the keys; a save that would be refused shows no tile; a restart made with the card up drops the press.
//           SAVECARD_BREAK=1 takes the hand-over of the kept press away and this job must FAIL
// exit 0 = every job asked for, with no page error · 1 = otherwise. Game logic and the DOM decide; the one judgment of a picture is a count of nearly white pixels (the bulb's
// glow: the ones within a twelfth of the frame's height of where the bulb is on it, so the men its light falls on are not counted), three frames against each other. With an outDir it keeps the stills and a screenshot of each card for a person to look at.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '', BREAK = process.env.SAVEPUTBACK_BREAK === '1', CARDBREAK = process.env.SAVECARD_BREAK === '1';
const JOBS = (process.env.JOBS || 'on,lesson,off,card').split(',');
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });

// in the page: the game stepped with no frame drawn
const STEP = (n) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { e.render = real; } };
// in the page: one step with its frame DRAWN and presented (a save's picture is taken off the canvas after such a frame), the GPU through with it
const FRAME = async () => { window.__runFrames(1, 1 / 60); await window.__engine.device.queue.onSubmittedWorkDone(); };
// in the page: draw n frames one at a time, read the last one back: how many of its pixels are nearly white (a burning bulb's own glow: the room it lights
// barely dims in a few frames) — `hot` on the whole frame, and with `lamp` `near`: the ones around the place on the frame of the light LAMP picked (`px`) —
// and (with `keep`) a PNG data URL (page-look.cjs DRAW)
const DRAW = async ([n, keep, lamp]) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let hot = 0; for (let i = 0; i < fr.data.length; i += 4) { fr.data[i + 3] = 255; if (fr.data[i] * 0.3 + fr.data[i + 1] * 0.59 + fr.data[i + 2] * 0.11 > 235) hot++; }
  const out = { hot, near: null, px: null, url: null }, bright = (k) => fr.data[k] * 0.3 + fr.data[k + 1] * 0.59 + fr.data[k + 2] * 0.11 > 235;
  if (lamp) { const [x, y, front] = window.__cam.project(window.__lamp.pos, fr.w, fr.h), cx = Math.round(x), cy = Math.round(y), R = Math.round(fr.h / 12); let m = 0;
    for (let j = Math.max(0, cy - R); j <= Math.min(fr.h - 1, cy + R); j++) for (let i = Math.max(0, cx - R); i <= Math.min(fr.w - 1, cx + R); i++) if (bright((j * fr.w + i) * 4)) m++;
    out.near = m; out.px = [cx, cy, !!front]; }
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
// in the page (lesson): the nearest light that burns; the camera pinned on it and (PIN's `stand`) he stood under it: the team has a look at it, so the fog's picture has it as it is
const LAMP = () => { const g = window.__game, p = g.player.char.pos; let best = null, bd = 1e9; for (const t of g.targets) { if (!t.on || t.broken || t.kind === 'breaker' || !t.boxes || !t.boxes.length) continue; const d = Math.hypot(t.pos[0] - p[0], t.pos[2] - p[2]); if (d < bd) { bd = d; best = t; } }
  if (!best) return null; window.__lamp = best; return { name: best.name, d: +bd.toFixed(1) }; };
const PIN = (stand) => { const t = window.__lamp; window.__stage({ look: [t.pos[0], 0.6, t.pos[2]], yaw: 0.6, pitch: 0.9, dist: 9 }, stand ? { player: { pos: [t.pos[0], 0, t.pos[2]] } } : {}); };
const SEEN = () => { const g = window.__game, f = g.fogOfWar, p = g.player.char.pos; return { fog: !!f.active, seen: !f.active || f.lampSeen(window.__lamp), at: [+p[0].toFixed(1), +p[2].toFixed(1)] }; };
const OUT = () => { const t = window.__lamp; t.on = false; return t.on; };   // (switched off, not broken: the head of this file — broken, 213 to 221 bright pixels of sparks with it out)
const LAMPSTATE = () => { const t = window.__lamp; return { broken: t.broken, on: t.on }; };

// in the page (card): F5 under a key lock, then on the pause card with the page's own loop running (frozen frames): kept from the browser, nothing written, a tile to come
const CARD1 = async () => {
  const g = window.__game, inp = window.__input, out = {};
  const wait = window.__wait = (ok, ms) => new Promise(res => { const t0 = Date.now(), id = setInterval(() => { const v = ok(); if (v || Date.now() - t0 > ms) { clearInterval(id); res(!!v); } }, 100); });
  const key = window.__f5 = () => { const ev = new KeyboardEvent('keydown', { code: 'F5', key: 'F5', bubbles: true, cancelable: true }); window.dispatchEvent(ev); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'F5', key: 'F5', bubbles: true })); return ev.defaultPrevented; };
  inp.lockExcept = new Set(); out.lockKey = !!inp.saveKey(); out.lockKept = key(); inp.lockExcept = null; inp.pressed.clear();
  window.__n0 = g.saves.stats.manual; window.__t0 = g.time;
  window.__menu.open('pause'); await new Promise(r => setTimeout(r, 50)); const walked = [...document.querySelectorAll('#menu .actions .btn')].find(b => /^Restart/.test(b.textContent)); if (walked) walked.focus();
  window.__pauseLoop = false;
  out.kept = key(); out.due = await wait(() => document.querySelector('#menu .saves .tile.due'), 900000);
  window.__pauseLoop = true; await new Promise(r => setTimeout(r, 500));   // (held for the still of the card: a screenshot waits on a frame, and the software adapter's take minutes)
  out.focusKept = !!walked && document.activeElement === walked;   // (the card was not laid again under the keys)
  out.early = g.saves.stats.manual - window.__n0; out.moved = +(g.time - window.__t0).toFixed(3);
  return out;
};
// in the page (card): the card closed — the first live tick writes the save, the frame after it gives it its picture; then the loop is held again.
// brk (SAVECARD_BREAK): the press the page kept is not let onto the input — the hand-over itself is what is taken away
const CARD2 = async (brk) => {
  const g = window.__game, inp = window.__input, wait = window.__wait, out = {};
  if (brk) { const add = inp.pressed.add.bind(inp.pressed); inp.pressed.add = k => k === 'F5' ? inp.pressed : add(k); }
  window.__menu.close(); window.__pauseLoop = false; out.ticked = await wait(() => g.time > window.__t0 + 0.01, 900000);
  out.wrote = g.saves.stats.manual - window.__n0; const line = g.saves.timeline();
  out.pic = line.length ? await wait(() => g.saves.pictureOf(g.saves.timeline()[0]), 600000) : false;
  window.__pauseLoop = true; await new Promise(r => setTimeout(r, 500));
  out.line = line.map(x => ({ slot: x.slot, t: +x.missionT.toFixed(2) })); out.msg = (g.messages[g.messages.length - 1] || {}).text || '';
  window.__menu.open('pause'); await new Promise(r => setTimeout(r, 50)); out.dueLeft = !!document.querySelector('#menu .saves .tile.due'); window.__menu.close();
  return out;
};
// in the page (card): a save that would be refused shows no tile; and a press kept on the card is dropped by a restart made while the card is up
const CARD3 = async () => {
  const g = window.__game, inp = window.__input, wait = window.__wait, key = window.__f5, out = {};
  const real = g.saves.handNo; g.saves.handNo = () => 'held for the check';
  window.__menu.open('pause'); window.__pauseLoop = false; key(); out.read = await wait(() => !inp.pressed.has('F5'), 900000);   // (a frozen frame has had its look at the key)
  out.refusedTile = !!document.querySelector('#menu .saves .tile.due'); g.saves.handNo = real;
  const by = () => g.saves.timeline().filter(x => x.slot === 'manual').length;
  g.restart(); window.__menu.close(); out.ticked = await wait(() => g.mission.stats.elapsed > 0.01, 900000);
  await wait(() => g.mission.stats.elapsed > 0.1, 300000); window.__pauseLoop = true; await new Promise(r => setTimeout(r, 500));
  out.afterRestart = by(); out.msg = (g.messages[g.messages.length - 1] || {}).text || '';
  return out;
};

(async () => {
  let red = 0;
  const defs = { on: '', lesson: 'levelFile=train-orders.json&roomclear=1&', off: 'savetimeline=0&', card: '' };
  for (const name of JOBS) {
    const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });   // (a browser per job: one that dies under the software adapter costs its own job only)
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?${defs[name]}paused&quality=${QUALITY}&mute`; log(`${name}: ${url}`);
    const r = {}, fails = [];
    const keep = async (tag, o) => { if (outDir && o && o.url) fs.writeFileSync(path.join(outDir, `savetimeline-${name}-${tag}.png`), Buffer.from(o.url.split(',')[1], 'base64')); };
    const shot = async (tag) => { if (outDir) await page.screenshot({ path: path.join(outDir, `savetimeline-${name}-${tag}.png`), timeout: 300000 }).catch(e => log(`${name}: no still of ${tag}: ${String(e).slice(0, 120)}`)); };   // (the card job's still follows frames of the page's own loop: the software adapter may still be minutes in one)
    try {
      await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 30);
      r.set = await page.evaluate(SET); log(`${name}: up`, JSON.stringify(r.set));
      if (name === 'card') {
        await page.evaluate(STEP, 120); await page.evaluate(FRAME);
        r.card1 = await page.evaluate(CARD1); log('card: F5 on the pause card', JSON.stringify(r.card1)); await shot('pause-card-a-save-to-come');
        r.card2 = await page.evaluate(CARD2, CARDBREAK); log('card: the card closed', JSON.stringify(r.card2));
        r.card3 = await page.evaluate(CARD3); log('card: a refusal, then a restart under a kept press', JSON.stringify(r.card3));
        if (r.card1.lockKey || r.card1.lockKept) fails.push('under a key lock F5 is kept from the browser');
        if (!r.card1.kept) fails.push('on the pause card F5 is not kept from the browser');
        if (!r.card1.due) fails.push('the pause card shows no tile to come');
        if (r.card1.early !== 0 || r.card1.moved !== 0) fails.push(`with the card up: ${r.card1.early} saves written, the world moved ${r.card1.moved} s (want 0, 0)`);
        if (!r.card2.ticked) fails.push('no live tick after the card closed');
        if (r.card2.wrote !== 1) fails.push(`the card closed: ${r.card2.wrote} saves written (want 1) — ${r.card2.msg}`);
        else if (!r.card2.pic) fails.push('the save has no picture');
        if (r.card2.dueLeft) fails.push('the tile to come is still on the card after the save');
        if (!r.card1.focusKept) fails.push('the card lost where the keys had walked when the tile was added');
        if (!r.card3.read || r.card3.refusedTile) fails.push('a save that would be refused shows a tile to come');
        if (!r.card3.ticked || r.card3.afterRestart !== 0) fails.push(`a restart with the card up: ${r.card3.afterRestart} saves by hand in the new run (want 0) — ${r.card3.msg}`);
      } else if (name === 'off') {
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
            await page.evaluate(PIN, true); await page.evaluate(STEP, 30); r.seen = await page.evaluate(SEEN); const s = await page.evaluate(F5); await page.evaluate(FRAME); if (s.wrote !== 1) fails.push(`the save by the light: ${s.msg}`);
            const tell = r.seen.seen; if (!tell) fails.push(`stood at ${r.seen.at} the team has no look at the light: the fog's picture would keep it as last seen, and the frames could not tell (not drawn)`);
            const A = tell ? await page.evaluate(DRAW, [3, !!outDir, true]) : null; await keep('lit-at-save', A);
            await page.evaluate(OUT); await page.evaluate(STEP, 90); r.seenOut = await page.evaluate(SEEN);
            const B = tell ? await page.evaluate(DRAW, [3, !!outDir, true]) : null; await keep('light-out', B);
            await page.evaluate(() => window.__stage(null, {}));
            r.strip = await page.evaluate(STRIP, 'pause'); await shot('pause-card');
            if (BREAK) await page.evaluate(() => { window.__game.saves.onPutBack = null; });
            const last = r.strip.tiles.length - 1; r.pick = await page.evaluate(PICK, last); r.lampAfter = await page.evaluate(LAMPSTATE);
            await page.evaluate(PIN, false); await page.evaluate(STEP, 2); if (tell) { await page.evaluate(FRAME); await page.evaluate(FRAME); }   // (two drawn frames, as the save's frame had before its three: F5's own and the one after)
            const C = tell ? await page.evaluate(DRAW, [3, !!outDir, true]) : null; await keep('after-load', C);
            if (!r.lampAfter.on || r.lampAfter.broken) fails.push('the light is still out in the game after the load');
            if (tell) {
              r.lum = { A: A.near, B: B.near, C: C.near, frame: [A.hot, B.hot, C.hot], px: A.px }; log(`${name}: the bulb's bright pixels (around it; the whole frame's; its place on the frame)`, JSON.stringify(r.lum));
              if (!(A.near - B.near > 20)) fails.push(`switching the light off did not take its glow off the frame (${r.lum.A} → ${r.lum.B} bright pixels around ${A.px}): the check cannot tell (with it off the team ${r.seenOut.seen ? 'has' : 'has not'} a look at it${r.seenOut.fog ? '' : ', no fog of war up'})`);
              else if (!(Math.abs(C.near - A.near) < 0.35 * (A.near - B.near))) fails.push(`the bulb on the frame after the load is not lit as the save's was: bright pixels around it at the save ${r.lum.A}, light off ${r.lum.B}, after the load ${r.lum.C}`);
            }
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
      lesson: `the quarters yard, a pair on the floor: saves kept in memory show on the strip with pictures; a light put out after a save is lit again on the frame after its load${BREAK ? ' (SAVEPUTBACK_BREAK: the host is not told)' : ''}`,
      off: 'under ?savetimeline=0: F5 writes nothing, the pause card has no strip',
      card: `F5 on the pause card is kept, shows a tile to come and saves once as play goes on; under a key lock it is the browser's${CARDBREAK ? ' (SAVECARD_BREAK: the kept press is not handed over)' : ''}` }[name];
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${said}\n    ${JSON.stringify({ set: r.set, saves: (r.saves || []).map(s => +s.t.toFixed(1)), tiles: r.strip ? r.strip.tiles.map(t => `${t.w}x${t.h} ${(t.bytes / 1024).toFixed(1)}KB range ${t.range} '${t.age}'`) : null, pick: r.pick, lum: r.lum, lamp: r.lamp, seen: r.seen, seenOut: r.seenOut, card1: r.card1, card2: r.card2, card3: r.card3 })}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`);
  }
  console.log(`=== savetimeline-page: ${red ? 'FAILURES above' : 'ALL PASS'} ===`);
  process.exit(red ? 1 : 0);
})();
