// PAGE LOOK: boot the real page in headless Chromium on the software WebGPU adapter (SwiftShader — no GPU needed), start a scenario from its query string,
// play a little of it through the page's own loop and keep what the page shows: the console's errors, the frame read back, the page as composited (HUD and
// menus over the canvas). What the headless harness cannot see: a module that only breaks in the bundle, the HUD's words, what is DRAWN.
//   node tools/qa/page-look.cjs <outDir> [name=query ...]     e.g.  pair='roomclear'  depot='levelFile=depot.json&roomclear&squad4'
//   env: PORT (the dev server's, default 5199) · SIZE (default 960x540) · QUALITY (default verylow) · SECS (sim seconds played, default 25) · FRAMES (drawn
//   frames per still, default 3 — TAAU wants a few) · PANEL (a search typed into the Tab panel for one more still, e.g. PANEL='team feel')
//   · IR=1 (the team from above with Sam's goggles up, then down, and the count of infrared laser boxes drawn in each)
//   · FOE=1 (the quiet pair orders, src/game/pairorders.ts: a defender stood on the open aisle with his back to the one teammate, the order menu opened ON HIM for
//   a still, 'take him on your mark' given, the mark given once the teammate is set; in place of the door order below. Wants `pairorders` in the query and a squad of one)
//   · SHUT=1 (the nearest door stood open and the order menu on it turned to the door tools' page — 'shut that door' on 3 — for one more still, its rows in the notes)
//   · THROW=1 (a spot of floor nobody has a throw to from where he stands: the throw page on it for a still — the thrower's ring, his walk, the arc —, 'frag there' given, a still of him walking and one once it is thrown)
//   · MAN=1 (close stills of the first teammate from four sides right after the staged still — what he wears and carries; the camera pin is released after)
// The smoke solver is switched off: on this adapter a step costs about 3 ms a brick, and a can is two thousand bricks. (Until 2026-10 the reason was harder: the box solver's 15 pipelines
// did not compile here at all, and this file passed their console lines over as noise. The brick pool's compile, so a line that names smoke is an error like any other.)
// Slow by nature: ~95 s to boot a page, 5–15 s per drawn frame. The simulation between stills runs with the renderer stubbed out (the page's loop, undrawn).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const outDir = process.argv[2] || 'page-look';
const jobs = process.argv.slice(3).map(a => { const i = a.indexOf('='); return i < 0 ? { name: a || 'plain', query: '' } : { name: a.slice(0, i), query: a.slice(i + 1) }; });
if (!jobs.length) jobs.push({ name: 'plain', query: '' });
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
const SECS = Number(process.env.SECS || 25);
const FRAMES = Number(process.env.FRAMES || 3);
const PANEL = process.env.PANEL || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });

// in the page: draw n frames one at a time (each waited for), read the last one back as a PNG data URL
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0, nz = 0; for (let i = 0; i < fr.data.length; i += 4) { const l = fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; sum += l; if (l > 12) nz++; fr.data[i + 3] = 255; }
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h * 3)).toFixed(2), litPct: +(100 * nz / (fr.w * fr.h)).toFixed(1), url: c2.toDataURL('image/png') };
};
// in the page: run the page's own loop for `secs` of game time with the renderer stubbed out
const PLAY = (secs) => {
  const e = window.__engine, real = e.render; let threw = null;
  e.render = () => {};
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw;
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const report = [];
  for (const job of jobs) {
    const R = { name: job.name, query: job.query, errors: [], notes: [] }; report.push(R);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return;
      if (/Failed to load resource/.test(x)) return;   // (named with its URL by the response / requestfailed hooks below)
      R.errors.push(`${t}: ${x.slice(0, 500)}`); });
    page.on('requestfailed', r => R.errors.push(`request failed: ${r.url()} — ${r.failure()?.errorText ?? '?'}`));
    page.on('response', r => { if (r.status() >= 400) { const u = r.url(); if (/favicon/.test(u)) R.notes.push(`${r.status()} ${u}`); else R.errors.push(`http ${r.status()}: ${u}`); } });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
    const save = async (tag, cap) => {
      if (cap && cap.url) { fs.writeFileSync(path.join(outDir, `${job.name}-${tag}-frame.png`), Buffer.from(cap.url.split(',')[1], 'base64')); R.notes.push(`${tag}: frame ${cap.w}x${cap.h} mean ${cap.mean} lit ${cap.litPct}%`); }
      else if (cap) R.notes.push(`${tag}: ${JSON.stringify(cap)}`);
      await page.screenshot({ path: path.join(outDir, `${job.name}-${tag}-page.png`) }).catch(() => {});
    };
    try {
      const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${job.query ? '&' + job.query : ''}`;
      log(job.name, 'goto', url);
      await page.goto(url);
      const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines, internal: [window.__engine.width, window.__engine.height] }; });
      log(job.name, 'ready', JSON.stringify(ready)); if (ready.fatal) R.errors.push('fatal: ' + ready.fatal);
      // CUT PIECES: the second set of ray programs compiles in the background after boot, and on the software adapter the page does not answer a screenshot while
      // it does (a 30 s timeout). Wait for it, at most CUT_WAIT_S; a build without the hook, the switch off (?nocutboxes) or a wait that runs out carries on as before.
      const cutSet = await page.evaluate(async (secs) => { const P = window.__cut?.programs, r = P?.swap ? P.ready : null; if (!r) return 'none';
        const t0 = performance.now(), got = await Promise.race([Promise.resolve(r).then(ok => ok ? 'ready' : 'failed', () => 'failed'), new Promise(done => setTimeout(() => done('timed out'), secs * 1000))]);
        return `${got} after ${((performance.now() - t0) / 1000).toFixed(0)} s`; }, Number(process.env.CUT_WAIT_S || 300)).catch(e => 'threw: ' + e.message);
      log(job.name, 'cut programs', cutSet);
      await page.screenshot({ path: path.join(outDir, `${job.name}-card-page.png`) });
      // the start card away, smoke off, the scenario as staged
      const staged = await page.evaluate(() => {
        window.__menu.close(); window.__smoke.params.enabled = false;
        const g = window.__game, O = window.__orders;
        return { time: g.time, guards: g.guards.map(x => `${x.callsign}:${x.team}:${x.state}`), squad: O.squad().length, fog: g.fogOfWar.on, msg: g.message ?? null,
          scenario: g.roomClear?.active ? 'roomclear' : g.nightBreach?.active ? 'nightbreach' : g.rescue?.active ? 'rescue' : null };
      });
      R.staged = staged; log(job.name, 'staged', JSON.stringify(staged));
      let threw = await page.evaluate(PLAY, 2); if (threw) R.errors.push('play threw: ' + threw);
      await save('staged', await page.evaluate(DRAW, FRAMES));
      if (process.env.MAN && staged.squad) {
        for (let k = 0; k < 4; k++) {
          R.notes.push('man' + k + ': ' + JSON.stringify(await page.evaluate((k) => { const m = window.__orders.squad()[0], p = m.char.pos;
            window.__stage({ look: [p[0], 1.45, p[2]], yaw: k * Math.PI / 2, pitch: 0.3, dist: 2.4 }, {});
            return { who: m.callsign, torch: window.__orders.squad().map(x => x.flashlight.enabled ? 1 : 0).join('') }; }, k)));
          await save('man' + k, await page.evaluate(DRAW, FRAMES));
        }
        await page.evaluate(() => window.__stage(null, {}));
      }
      if (process.env.IR && staged.squad) {
        // the team from above with Sam's goggles up, then down: the infrared lasers (irlaser.ts) are in the drawn boxes of the second still only
        // (to a stack on the nearest door first: guns up toward it — a man's laser lies along the way he covers, not across the file)
        R.notes.push('stack: ' + JSON.stringify(await page.evaluate(() => { const g = window.__game, O = window.__orders, P = g.player.char.pos;
          const d = g.doors.list.slice().sort((a, b) => Math.hypot(a.frameCentre[0] - P[0], a.frameCentre[2] - P[2]) - Math.hypot(b.frameCentre[0] - P[0], b.frameCentre[2] - P[2]))[0];
          return { door: d.def.name, refused: O.give('stack', O.targetAt(d.frameCentre), 'all') || null }; })));
        threw = await page.evaluate(PLAY, 5); if (threw) R.errors.push('play threw: ' + threw);
        for (const on of [false, true]) {
          const tag = on ? 'nvdown' : 'nvup';
          await page.evaluate((on) => { window.__game.player.nv = on; }, on);
          threw = await page.evaluate(PLAY, 1.5); if (threw) R.errors.push('play threw: ' + threw);
          R.notes.push(tag + ': ' + JSON.stringify(await page.evaluate(() => { const g = window.__game, m = window.__orders.squad(), p = [0, 0, 0];
            for (const x of m) { p[0] += x.char.pos[0] / m.length; p[2] += x.char.pos[2] / m.length; }
            window.__stage({ look: [p[0], 1.0, p[2]], yaw: 0, pitch: 1.05, dist: 9 }, {});
            const ir = g.dynBoxes.filter(b => b.emissive && b.emissive[0] > 0 && b.emissive[0] === b.emissive[1] && b.emissive[1] === b.emissive[2] && b.albedo[0] === 0 && b.albedo[1] === 0 && b.albedo[2] === 0 && b.h[0] < 0.05 && b.h[1] < 0.05);   // (irlaser-probes.ts isIr: a hueless emissive hair with no albedo)
            return { nv: g.player.nv, nvAmount: +g.player.nvAmount.toFixed(2), infraredBoxes: ir.length, torch: window.__orders.squad().map(x => x.flashlight.enabled ? 1 : 0).join('') }; })));
          await save(tag, await page.evaluate(DRAW, FRAMES));
        }
        await page.evaluate(() => { window.__stage(null, {}); window.__game.player.nv = false; });   // (as it found them: the stills after this are the bare-eyed ones)
        threw = await page.evaluate(PLAY, 1); if (threw) R.errors.push('play threw: ' + threw);
      }
      if (process.env.THROW && staged.squad) {
        // THROW=1: a spot of floor nobody has a throw to from where he stands (game/squadthrow.ts walks a man to one): the order menu on it turned to the throw page for a still
        // (the picture's preview: who, his walk, the arc), then 'frag there' given and a still of him on his way, then of the floor once it is thrown
        const th = await page.evaluate(() => {
          const g = window.__game, O = window.__orders, T = window.__squadthrow, P = g.player.char.pos, nav = g.col.nav; if (!T) return { err: 'no __squadthrow hook' };
          let best = null;
          for (let dz = -14; dz <= 14; dz += 1) for (let dx = -14; dx <= 14; dx += 1) {
            const at = [Math.round(P[0] + dx) + 0.25, 0, Math.round(P[2] + dz) + 0.25], cx = Math.floor(at[0] / nav.cell), cz = Math.floor(at[2] / nav.cell);
            if (cx < 0 || cz < 0 || cx >= nav.W || cz >= nav.H || nav.blocked[cz * nav.W + cx]) continue;
            const t = O.targetAt(at); if (!t || t.kind !== 'floor') continue;
            const pl = T.plan(at, 'frag'); if (!pl || !pl.post) continue;
            const walk = Math.hypot(pl.post[0] - pl.gd.char.pos[0], pl.post[2] - pl.gd.char.pos[2]); if (!best || walk > best.walk) best = { at, walk, who: pl.gd.callsign, post: pl.post, from: [pl.gd.char.pos[0], 0, pl.gd.char.pos[2]] };
          }
          if (!best) return { err: 'no spot with a walk' };
          const mid = [(best.at[0] + best.from[0]) / 2, 0.5, (best.at[2] + best.from[2]) / 2], span = Math.hypot(best.at[0] - best.from[0], best.at[2] - best.from[2]);
          window.__stage({ look: mid, yaw: 0, pitch: 1.1, dist: Math.max(10, span * 1.5) }, {});
          g.fogOfWar.on = false;
          O.open(O.targetAt(best.at)); window.__input.pressed.add('KeyG');
          return best;
        });
        R.throw = th; log(job.name, 'throw', JSON.stringify(th));
        if (!th.err) {
          threw = await page.evaluate(PLAY, 0.2); if (threw) R.errors.push('play threw: ' + threw);
          th.menu = await page.evaluate(() => { const O = window.__orders, M = O.menu; return { page: M?.page ?? null, rows: M ? M.rows.map((r, i) => `${r.key} ${r.id}${M.why[i] ? ' — ' + M.why[i] : ''}`) : [], plans: window.__squadthrow.plans().map(p => ({ who: p.gd.callsign, kind: p.kind, preview: !!p.preview, walk: p.walk?.length ?? 0, pts: p.points.length })), svg: document.querySelector('#traj .squadthrow')?.childElementCount ?? -1 }; });
          await save('throwmenu', await page.evaluate(DRAW, 2));
          th.svgMenu = await page.evaluate(() => document.querySelector('#traj .squadthrow')?.innerHTML.length ?? -1);
          await page.evaluate(() => window.__input.pressed.add('Digit1'));
          threw = await page.evaluate(PLAY, 1.5); if (threw) R.errors.push('play threw: ' + threw);
          th.going = await page.evaluate(() => ({ plans: window.__squadthrow.plans().map(p => ({ who: p.gd.callsign, preview: !!p.preview, walk: p.walk?.length ?? 0 })), status: JSON.stringify(window.__orders.hud().status ?? null).slice(0, 400), stats: { ...window.__squadthrow.stats } }));
          await save('throwwalk', await page.evaluate(DRAW, 2));
          for (let i = 0; i < 40; i++) { threw = await page.evaluate(PLAY, 0.5); if (threw) { R.errors.push('play threw: ' + threw); break; } if (await page.evaluate(() => window.__squadthrow.stats.walked + window.__squadthrow.stats.gaveUp > 0)) break; }
          th.thrown = await page.evaluate(() => ({ stats: { ...window.__squadthrow.stats }, plans: window.__squadthrow.plans().length, items: (window.__game.items.list ?? window.__game.items.items ?? []).length }));
          await save('throwout', await page.evaluate(DRAW, 2));
          log(job.name, 'throw done', JSON.stringify({ menu: th.menu, svgMenu: th.svgMenu, going: th.going, thrown: th.thrown }));
        }
        await page.evaluate(() => { window.__orders.close(); window.__stage(null, {}); });
      }
      if (process.env.SHUT && staged.squad) {
        // SHUT=1: the nearest door stood open, the order menu on it turned to the door tools' page (X, 5) — where 'shut that door' stands on 3 — kept up for a still
        const sh = await page.evaluate(() => {
          const g = window.__game, O = window.__orders, P = g.player.char.pos, far = (d) => Math.hypot(d.frameCentre[0] - P[0], d.frameCentre[2] - P[2]);
          const d = g.doors.list.filter(x => !x.off && O.targetAt(x.frameCentre)?.kind === 'door').sort((a, b) => far(a) - far(b))[0]; if (!d) return { door: null };
          if (d.latched || Math.abs(d.angle) < 0.6) { d.latched = false; d.angle = d.swing * 1.3; d.vel = 0; d.closing = false; d.quietT = -3600; d.place(); }
          O.open(O.targetAt(d.frameCentre)); const opener = O.menu?.rows.find(r => r.opens); if (opener) window.__input.pressed.add('Digit' + opener.key);
          return { door: d.def.name, angle: +d.angle.toFixed(2), opener: opener?.id ?? null };
        });
        threw = await page.evaluate(PLAY, 0.3); if (threw) R.errors.push('play threw: ' + threw);
        sh.page = await page.evaluate(() => { const O = window.__orders, M = O.menu; return M ? { page: M.page, rows: M.rows.map((r, i) => `${r.key} ${r.id}${M.why[i] ? ' — ' + M.why[i] : ''}`), hud: (O.hud().menu?.rows ?? []).map(r => r.opts.map(o => `${o.key} ${o.text}`).join(' / ')) } : null; });
        R.shut = sh; log(job.name, 'shut', JSON.stringify(sh));
        await save('shutmenu', await page.evaluate(DRAW, 1));
        await page.evaluate(() => window.__orders.close());
      }
      if (staged.squad && process.env.FOE) {
        const ord = await page.evaluate(() => {
          const g = window.__game, O = window.__orders, m = O.squad()[0], h = g.guards.find(x => x.team === 'hostile');
          const put = (gd, p) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; gd.lastPos = [p[0], 0, p[2]]; gd.path = []; gd.pathGoal = null; };
          put(h, [22, 0, 17.6]); put(m, [13, 0, 17.6]); g.teleportPlayer([11, 0, 18.5]);
          return { foe: h.callsign, up: window.__pair.up };
        });
        threw = await page.evaluate(PLAY, 0.6); if (threw) R.errors.push('play threw: ' + threw);
        Object.assign(ord, await page.evaluate(() => {
          const g = window.__game, O = window.__orders, h = g.guards.find(x => x.team === 'hostile');
          const t = O.targetAt([h.char.pos[0], 0, h.char.pos[2]]), given = t ? O.give('pairMark', t, 'all') : 'no target'; O.open(t); const hud = O.hud().menu;   // (the order first: a loud teammate shoots a defender he sees in the open)
          return { kind: t && t.kind, given, menu: !!O.menu, rows: (hud?.rows ?? []).map(r => `${r.opts?.[0]?.key ?? ''} ${r.opts?.[0]?.text ?? r.label}${r.off ? ' (greyed)' : ''}`) };
        }));
        log(job.name, 'foe menu', JSON.stringify(ord));
        threw = await page.evaluate(PLAY, 0.2); if (threw) R.errors.push('play threw: ' + threw);
        await save('foemenu', await page.evaluate(DRAW, 1));
        const took = {}; await page.evaluate(() => window.__orders.close());
        for (let i = 0; i < 40 && !took.set; i++) { threw = await page.evaluate(PLAY, 0.5); if (threw) { R.errors.push('play threw: ' + threw); break; }
          took.set = await page.evaluate(() => { const P = window.__pair, m = window.__orders.squad()[0]; return !!P.jobOf(m)?.set; }); }
        took.hud = await page.evaluate(() => JSON.stringify(window.__orders.hud().status).slice(0, 600)).catch(() => null);
        await save('foeset', await page.evaluate(DRAW, FRAMES));
        await page.evaluate(() => window.__pair.mark('F'));
        threw = await page.evaluate(PLAY, 2.5); if (threw) R.errors.push('play threw: ' + threw);
        Object.assign(took, await page.evaluate(() => { const g = window.__game; return { time: +g.time.toFixed(1), guards: g.guards.map(x => `${x.callsign}:${x.state}:${x.awareness.toFixed(2)}`) }; }));
        R.order = { ...ord, took }; log(job.name, 'take', JSON.stringify(took));
        await save('foedown', await page.evaluate(DRAW, FRAMES));
      } else if (staged.squad) {
        // the order menu on the nearest door that takes a bang, kept up for a still, then the order given
        const ord = await page.evaluate(() => {
          const g = window.__game, O = window.__orders, P = g.player.char.pos;
          const doors = g.doors.list.slice().sort((a, b) => Math.hypot(a.frameCentre[0] - P[0], a.frameCentre[2] - P[2]) - Math.hypot(b.frameCentre[0] - P[0], b.frameCentre[2] - P[2]));
          for (const d of doors) {
            const t = O.targetAt(d.frameCentre); if (!t || t.kind !== 'door') continue;
            const why = O.give('bangClear', t, 'all');
            if (!why) { O.open(O.targetAt(d.frameCentre)); return { door: d.def.name, menu: !!O.menu, rows: O.hud?.().length ?? null }; }
          }
          return { door: null };
        });
        R.order = ord; log(job.name, 'order', JSON.stringify(ord));
        threw = await page.evaluate(PLAY, 0.2); if (threw) R.errors.push('play threw: ' + threw);
        await save('menu', await page.evaluate(DRAW, 1));
        await page.evaluate(() => window.__orders.close());
      }
      threw = await page.evaluate(PLAY, SECS); if (threw) R.errors.push('play threw: ' + threw);
      R.after = await page.evaluate(() => { const g = window.__game; return { time: +g.time.toFixed(1), guards: g.guards.map(x => `${x.callsign}:${x.team}:${x.state}`), sam: g.player.down ? 'down' : 'up', ops: window.__doortools.log?.slice(-6) ?? null }; });
      log(job.name, 'after', JSON.stringify(R.after));
      await save('after', await page.evaluate(DRAW, FRAMES));
      if (PANEL) {   // the Tab panel with a search typed in (HTML over the canvas: the page still shows it)
        R.panel = await page.evaluate((q) => { const P = window.__panel; if (!P.visible) P.toggle(); const s = document.querySelector('#panel input[type=search]'); if (!s) return { err: 'no search box' }; s.value = q; s.dispatchEvent(new Event('input'));
          return { rows: [...document.querySelectorAll('#panel .prow, #panel .row')].filter(e => e.offsetParent).length, text: (document.querySelector('#panel')?.innerText ?? '').slice(0, 1500) }; }, PANEL);
        await page.screenshot({ path: path.join(outDir, `${job.name}-panel-page.png`) });
        await page.evaluate(() => { const b = document.querySelector('#panel'); if (b) { const m = b.querySelector('.pmain > div:last-child') ?? b; m.scrollTop = m.scrollHeight; } });
        await page.screenshot({ path: path.join(outDir, `${job.name}-panel2-page.png`) });
      }
    } catch (x) { R.errors.push('script: ' + String(x && x.stack || x).slice(0, 800)); await page.screenshot({ path: path.join(outDir, `${job.name}-fail-page.png`) }).catch(() => {}); }
    log(job.name, R.errors.length ? `ERRORS ${R.errors.length}` : 'clean'); R.errors.forEach(e => console.log('   >', e));
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.filter(r => r.errors.length);
  console.log(bad.length ? `=== page-look: ${bad.length} of ${report.length} with errors: ${bad.map(r => r.name).join(', ')} ===` : `=== page-look: ${report.length} pages clean ===`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
