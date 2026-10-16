// KIT LOOK: the member cards and the men who wear them, as the real page draws them in headless Chromium on the SOFTWARE WebGPU adapter (SwiftShader — no GPU;
// see page-look.cjs for what that adapter can and cannot do). Two kinds of page:
//   cards   ?kit — the preview of the five cards (ui/kitPreview.ts) as issued, with the quiet set and the loud set on everybody, and with a mixed squad; and
//           the keys and the mouse driven through the real page (Tab, S S D W → on teammate 1; arrows and a set clicked). HTML: no frame is drawn.
//   men     a scenario staged with a kit in the store (twopointsix.kit, written before the page loads as a person's earlier visit would have left it): the
//           team from four sides and each man close from two, under a work lamp hung over them for the still (QA only: the staged floor is dark).
//   node tools/qa/kit-look.cjs <outDir> [cards] [men:<name>=<issued|mixed>] ...      env: PORT (5199) · SIZE (960x540) · QUALITY (verylow) · FRAMES (3)
//   · QUICK=1 (one team still only) · PLAY=<secs> (then an order on the nearest door and that much of the run through the page's own loop, and a still)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'kit-look';
const jobs = process.argv.slice(3); if (!jobs.length) jobs.push('cards');
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow', FRAMES = Number(process.env.FRAMES || 3), SCN = process.env.SCN || 'roomclear&squad4';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
// the kits a 'men' page is staged with, as a person's earlier visit would have left them in the store: only the CHANGED rows (kit.ts kitSanitize reads the
// rest as issued). mixed = you in navy with white trim, pistol only, 2 smoke 4 stun · 1 the bare carbine, olive drab, amber, one more stun canister ·
// 2 the suppressed pistol, no light, no goggles, desert tan, white · 3 the bare 9 mm, jungle green, green, two charges · 4 as issued
const KITS = {
  issued: null,
  mixed: [{ weapon: 'pistol', cans: 'stun', suit: 'navy', trim: 'white' }, { suppressed: false, suit: 'olive', trim: 'amber', bangs: 3 },
    { weapon: 'pistol', light: false, nvg: false, suit: 'desert', trim: 'white' }, { weapon: 'pistol', suppressed: false, suit: 'jungle', trim: 'green', charges: 2 }, {}],
};
const DRAW = async (n) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, url: c2.toDataURL('image/png') };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const report = [];
  for (const job of jobs) {
    const R = { job, errors: [], noise: 0, notes: [] }; report.push(R);
    const cards = job === 'cards', m = /^men:([\w-]+)=(\w+)$/.exec(job);
    if (!cards && !(m && m[2] in KITS)) { R.errors.push(`no such job '${job}'`); continue; }
    const page = await browser.newPage({ viewport: cards ? { width: 1400, height: 760 } : { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', x => { const t = x.type(), s = x.text(); if (t !== 'error' || /Failed to load resource/.test(s)) return; if (NOISE.test(s) && R.noise < 80) R.noise++; else R.errors.push(`${t}: ${s.slice(0, 400)}`); });
    page.on('pageerror', x => R.errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
    try {
      if (cards) {
        await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&kit&noslots`);
        await page.waitForSelector('#kit-preview .kc', { timeout: 60000 });
        await page.evaluate(async () => { await window.__ready; window.__testVisible = true; });   // (the cards are up long before: but a page still compiling its kernels on the software adapter cannot be screenshotted)
        const box = async (name) => { const r = await page.evaluate(() => { const b = document.querySelector('#kit-preview .kp').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; }); await page.screenshot({ path: path.join(outDir, `${name}.png`), clip: r }); };
        const words = () => page.evaluate(() => window.__kit.words());
        await page.evaluate(() => window.__kit.reset()); await box('cards-issued'); R.notes.push('issued: ' + JSON.stringify(await words()));
        // the keys, through the real page: S S to teammate... the first card is yours; Tab to teammate 1, S S (weapon light), D (none), W (suppressor), D (off)
        await page.keyboard.press('Tab'); await page.keyboard.press('KeyS'); await page.keyboard.press('KeyS'); await page.keyboard.press('KeyD'); await page.keyboard.press('KeyW'); await page.keyboard.press('ArrowRight');
        R.notes.push('keys Tab S S D W →: ' + JSON.stringify(await page.evaluate(() => ({ light: window.__kit.KIT.members[1].light, suppressed: window.__kit.KIT.members[1].suppressed, kept: JSON.parse(localStorage.getItem('twopointsix.kit')).members[1] }))));
        await box('cards-keys');
        // the mouse: the Suit row's right arrow on teammate 2, twice; then its Quiet set button
        const c2 = '#kit-preview .kc[data-member="2"]';
        await page.click(`${c2} .kc-row[data-field="suit"] .kc-step:last-of-type`); await page.click(`${c2} .kc-row[data-field="suit"] .kc-step:last-of-type`);
        R.notes.push('mouse › › on teammate 2 suit: ' + JSON.stringify(await page.evaluate(() => window.__kit.KIT.members[2].suit)));
        await page.click(`#kit-preview .kc[data-member="3"] .kc-set[data-set="quiet"]`);
        R.notes.push('mouse Quiet set on teammate 3: ' + JSON.stringify(await page.evaluate(() => window.__kit.words()[3])));
        for (const p of ['quiet', 'loud']) { await page.evaluate((p) => window.__kit.preset(p), p); await box(`cards-${p}`); R.notes.push(`${p}: ` + JSON.stringify(await words())); }
        await page.evaluate((k) => { window.__kit.reset(); k.forEach((m, i) => { for (const f of Object.keys(m)) window.__kit.set(i, f, m[f]); }); }, KITS.mixed);
        await box('cards-mixed'); R.notes.push('mixed: ' + JSON.stringify(await words()) + ' · pool(4) ' + JSON.stringify(await page.evaluate(() => window.__kit.pool(4))));
        await shot('cards-page');
        await page.keyboard.press('Escape'); R.notes.push('Esc closes: ' + JSON.stringify(await page.evaluate(() => !document.getElementById('kit-preview'))));
        await page.evaluate(() => window.__kit.reset());
      } else {
        const name = m[1], kit = KITS[m[2]];
        await page.addInitScript((k) => { try { if (k) localStorage.setItem('twopointsix.kit', JSON.stringify({ v: 1, members: k })); else localStorage.removeItem('twopointsix.kit'); } catch (e) {} }, kit);
        const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&noslots&${SCN}`; log(name, 'goto', url);
        await page.goto(url);
        const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '' }; });
        log(name, 'ready', JSON.stringify(ready)); if (ready.fatal) R.errors.push('fatal: ' + ready.fatal);
        const staged = await page.evaluate(() => {
          window.__menu.close(); window.__smoke.params.enabled = false;
          const g = window.__game, e = window.__engine, real = e.render; e.render = () => {}; try { window.__runFrames(60, 1 / 60); } finally { e.render = real; }
          const men = window.__orders.squad(), c = [0, 0, 0]; for (const x of men) { c[0] += x.char.pos[0] / men.length; c[2] += x.char.pos[2] / men.length; }
          // the work lamp (QA only): a warm point over the team, and Sam stood in it too
          e.lights.add({ name: 'kitlook', group: 'qa', kind: 0, pos: [c[0], 2.35, c[2]], dir: [0, -1, 0], color: [1, 0.96, 0.9], intensity: 34, range: 9, innerDeg: 0, outerDeg: 0, radius: 0.12, volumetric: 0, owner: 0, enabled: true, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 34 });
          window.__kitC = c;
          const P = g.player;
          return { centre: c.map(x => +x.toFixed(2)), men: men.map(x => ({ who: x.callsign, gun: x.weapon.def.id, tint: x.char.tint.map(v => +v.toFixed(3)), tint2: x.char.tint2.map(v => +v.toFixed(3)), lightFitted: x.lightDeadUntil !== Infinity })),
            you: { rifle: P.hasRifle, smoke: P.canisters, stun: P.flashbangs, tint: P.char.tint.map(v => +v.toFixed(3)), tint2: P.char.tint2.map(v => +v.toFixed(3)) }, squadCount: { stun: g.doorTools.bangs, charges: g.doorTools.charges }, staged: window.__kit.staged.n };
        });
        R.staged = staged; log(name, 'staged', JSON.stringify(staged));
        const still = async (tag, pin) => { await page.evaluate((pin) => window.__stage(pin, {}), pin); const cap = await page.evaluate(DRAW, FRAMES);
          if (cap && cap.url) fs.writeFileSync(path.join(outDir, `${name}-${tag}.png`), Buffer.from(cap.url.split(',')[1], 'base64')); else R.errors.push(`${tag}: ${JSON.stringify(cap)}`); log(name, tag); };
        const c = staged.centre, QUICK = !!process.env.QUICK;
        for (let k = 0; k < (QUICK ? 1 : 4); k++) await still(`team${k}`, { look: [c[0], 1.0, c[2]], yaw: k * Math.PI / 2 + Math.PI / 4, pitch: 0.75, dist: 5.2 });
        if (m[2] !== 'issued' && !QUICK) for (let i = 0; i < staged.men.length; i++) {
          const p = await page.evaluate((i) => { const x = window.__orders.squad()[i]; return [x.char.pos[0], x.char.pos[2], x.char.aimYaw ?? x.char.yaw ?? 0]; }, i);
          for (const [tag, yaw] of [['a', p[2]], ['b', p[2] + Math.PI]]) await still(`man${i + 1}${tag}`, { look: [p[0], 1.25, p[1]], yaw, pitch: 0.28, dist: 2.3 });
        }
        if (!QUICK) { const p = await page.evaluate(() => { const x = window.__game.player.char; return [x.pos[0], x.pos[2], x.aimYaw ?? 0]; }); await page.evaluate((p) => { const l = window.__engine.lights.lights.find(x => x.name === 'kitlook'); if (l) l.pos = [p[0], 2.35, p[1]]; }, p);
          for (const [tag, yaw] of [['a', p[2]], ['b', p[2] + Math.PI]]) await still(`you${tag}`, { look: [p[0], 1.25, p[1]], yaw, pitch: 0.28, dist: 2.3 }); }
        await page.evaluate(() => window.__stage(null, {}));
        if (process.env.PLAY) {   // the run itself through the page's own loop (renderer stubbed between stills): an order on the nearest door that takes one, PLAY seconds, a still
          const played = await page.evaluate((secs) => {
            const g = window.__game, O = window.__orders, P = g.player.char.pos, e = window.__engine, real = e.render; let threw = null, door = null;
            for (const d of g.doors.list.slice().sort((a, b) => Math.hypot(a.frameCentre[0] - P[0], a.frameCentre[2] - P[2]) - Math.hypot(b.frameCentre[0] - P[0], b.frameCentre[2] - P[2]))) {
              const t = O.targetAt(d.frameCentre); if (!t || t.kind !== 'door') continue; if (!O.give('bangClear', t, 'all')) { door = d.def.name; break; } }
            const lit = O.squad().map(() => 0); e.render = () => {};
            try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); O.squad().forEach((x, k) => { if (x.flashlight.enabled) lit[k]++; }); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
            return { door, threw, time: +g.time.toFixed(1), men: O.squad().map((x, k) => `${x.callsign}:${x.state}:${x.weapon.def.id}:lit ${lit[k]}`), others: g.guards.filter(x => x.team !== 'operative').map(x => `${x.callsign}:${x.state}`), squadCount: { stun: g.doorTools.bangs, charges: g.doorTools.charges } };
          }, Number(process.env.PLAY));
          R.played = played; log(name, 'played', JSON.stringify(played)); if (played.threw) R.errors.push('play threw: ' + played.threw);
          const cap = await page.evaluate(DRAW, FRAMES); if (cap && cap.url) fs.writeFileSync(path.join(outDir, `${name}-after.png`), Buffer.from(cap.url.split(',')[1], 'base64'));
        }
      }
    } catch (x) { R.errors.push('script: ' + String(x && x.stack || x).slice(0, 800)); await shot(`fail-${job.replace(/\W+/g, '-')}`).catch(() => {}); }
    log(job, R.errors.length ? `ERRORS ${R.errors.length}` : 'clean', `(${R.noise} smoke-pipeline lines passed over)`); R.errors.forEach(e => console.log('   >', e)); R.notes.forEach(n => console.log('   ·', n));
    await page.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, `report-${jobs.map(j => j.replace(/\W+/g, '-')).join('_').slice(0, 60)}.json`), JSON.stringify(report, null, 1));
  const bad = report.filter(r => r.errors.length);
  console.log(bad.length ? `=== kit-look: ${bad.length} of ${report.length} with errors ===` : `=== kit-look: ${report.length} clean ===`);
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
