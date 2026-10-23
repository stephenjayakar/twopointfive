// HOW MUCH YOU'RE TOLD, AND THE FOG OFF ON A SQUAD MISSION, ON THE REAL PAGE (game/told.ts TOLD.on `?told=0`, TOLD.fogOff `?fogoff=0`).
//   PORT=5241 node tools/qa/told-page.cjs [outDir]      (a dev server on that port: PORT=5241 bun run tools/serve.ts)
// The start page first (plain DOM; no GPU is asked for, the boot stops at 'No WebGPU adapter' behind it): a squad mission's Setup rail has a fourth lever,
// You're told, on Standard; a click steps it (bare, guided), its line is read out at the rail's foot and Difficulty turns to a mix of your own; the Fog of
// war row steps down to 'off' and its line says it shows more than the team can see; Hard puts the fourth lever on Bare; under &told=0&fogoff=0 there is no
// fourth row and the fog has its three rungs. Then the runs behind the links, on the software adapter (a second browser; GAME=0 skips): a room clear on
// Guided leaves a '(?)' on the HUD where a defender was last seen and none on Bare; `fog=off` starts it with no fog of war and nobody hidden.
// TOLD_BREAK=1 puts both switches off on every page: must FAIL. PASS / FAIL lines, stills, exit 1 on a FAIL. The rules' half: tools/qa/told-check.ts.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || 'told-page', PORT = process.env.PORT || 5199, ROW = 'depot-four';
const OFF = process.env.TOLD_BREAK === '1' ? '&told=0&fogoff=0' : '';
fs.mkdirSync(outDir, { recursive: true });
let failed = false; const errors = [];
const check = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  for (const [W, H] of [[1440, 900], [1000, 673]]) {
    const at = `${W}x${H}`, ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/WebGPU|adapter/i.test(String(e))) errors.push(String(e).slice(0, 300)); });
    const open = async q => { await page.goto(`http://localhost:${PORT}/?${q}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(500);
      await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(500); };
    const goRow = async id => { const sel = `#missions .mrow[data-mission="${id}"]`;
      const head = await page.evaluate(q => { const e = document.querySelector(q); return e && e.classList.contains('shut') ? e.getAttribute('data-group') : null; }, sel);
      if (head) { await page.click(`#missions .msec[data-head="${head}"]`); await page.waitForTimeout(150); }
      await page.click(sel); await page.waitForTimeout(300); };
    /** the Setup rail as drawn: each row's label and value, whether it runs off the rail, and the line read out at its foot */
    const rail = () => page.evaluate(() => { const R = document.getElementById('missions'), box = R.querySelector('.mrail').getBoundingClientRect(), vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && !e.hidden; };
      const rows = [...R.querySelectorAll('.mrail .mval')].filter(vis).map(b => { const v = b.querySelector('b').getBoundingClientRect(); return { label: (b.querySelector('i')?.textContent ?? '').toLowerCase(), value: (b.querySelector('b')?.textContent ?? '').toLowerCase(), moved: b.classList.contains('moved'), over: Math.round(Math.max(0, v.right - box.right)) }; });
      return { href: R.querySelector('.mrow.sel')?.getAttribute('href') ?? '', rows, read: R.querySelector('.mread p')?.textContent ?? '', kept: localStorage.getItem('twopointsix.levers') }; });
    const of = (r, re) => r.rows.find(k => re.test(k.label));
    const step = async (re, want) => { for (let i = 0; i < 5; i++) { const r = await rail(); if (of(r, re)?.value === want) return r; const n = await page.evaluate(src => { const b = [...document.querySelectorAll('#missions .mrail .mval')].find(x => new RegExp(src, 'i').test(x.querySelector('i')?.textContent ?? '')); if (!b) return false; b.click(); return true; }, re.source); if (!n) break; await page.waitForTimeout(200); } return rail(); };
    const wipe = () => page.evaluate(() => { localStorage.removeItem('twopointsix.levers'); localStorage.removeItem('twopointsix.difficulty'); });

    await open(`paused&quality=verylow&mute${OFF}`); await wipe(); await open(`paused&quality=verylow&mute${OFF}`); await goRow(ROW);
    const a = await rail(); await page.screenshot({ path: path.join(outDir, `1-rail-${at}.png`) });
    const told = /told/, fog = /fog of war/, diff = /difficulty/;
    check(!!of(a, told) && of(a, told).value === 'standard' && !of(a, told).moved && of(a, fog)?.value === 'all round' && a.rows.every(k => k.over === 0), `${at}: a squad mission's Setup rail has a fourth lever under Enemy kit, You're told, on Standard, and no row runs off the rail`, JSON.stringify(a.rows));
    const b = await step(told, 'guided'); await page.screenshot({ path: path.join(outDir, `2-guided-${at}.png`) });
    check(of(b, told)?.value === 'guided' && of(b, told).moved && /where your team last saw an enemy/.test(b.read) && /custom|mix/i.test(of(b, diff)?.value ?? '') && /"told":"guided"/.test(b.kept ?? '') && !/told=/.test(b.href),
      `${at}: stepped to Guided: the row is moved, its line is read out, Difficulty is no longer a level's name, and the rung is kept on this machine (the link carries none)`, `told '${of(b, told)?.value}' · difficulty '${of(b, diff)?.value}' · read '${b.read}' · kept ${b.kept}`);
    const c = await step(fog, 'off'); await page.screenshot({ path: path.join(outDir, `3-fog-off-${at}.png`) });
    check(of(c, fog)?.value === 'off' && of(c, fog).moved && /no fog/.test(c.read) && /you and your team always know/.test(c.read) && /"fog":"off"/.test(c.kept ?? ''), `${at}: the Fog of war row steps down to 'off', and its line says you and your team know where every enemy is`, `fog '${of(c, fog)?.value}' · read '${c.read}' · kept ${c.kept}`);
    const d = await step(diff, 'hard');   // (a click on the Difficulty row over a mix says so first, the next one picks: the keys leave a mix alone)
    check(of(d, diff)?.value === 'hard' && of(d, told)?.value === 'bare' && !of(d, told).moved && of(d, fog)?.value === 'cones' && d.kept === null, `${at}: Hard picked: You're told is on Bare, the fog is back on Hard's own rung, nothing kept`, `difficulty '${of(d, diff)?.value}' · told '${of(d, told)?.value}' · fog '${of(d, fog)?.value}' · kept ${d.kept}`);
    await step(diff, 'standard'); await wipe();
    await open('paused&quality=verylow&mute&told=0&fogoff=0'); await wipe(); await goRow(ROW); const e = await rail(), e2 = await step(fog, 'off');
    check(!of(e, told) && of(e2, fog)?.value !== 'off', `${at}: &told=0&fogoff=0: no fourth row, and the fog steps through its three rungs only, as it was`, JSON.stringify(e.rows.map(k => `${k.label} ${k.value}`)));
    await wipe(); await ctx.close();
  }
  check(errors.length === 0, 'no page error on the start page', errors.length ? errors[0] : 'none');
  await browser.close();

  if (process.env.GAME !== '0') {
    const gb = await chromium.launch({ headless: true, channel: 'chromium', args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'] });
    const load = async (q, shot) => { const pg = await (await gb.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage(), errs = []; pg.setDefaultTimeout(900000);
      pg.on('pageerror', e => errs.push(`page error: ${String(e).slice(0, 300)}`));
      pg.on('console', m => { if (m.type() === 'error' && !/^Failed to load resource/.test(m.text())) errs.push(`console error: ${m.text().slice(0, 300)}`); });
      pg.on('response', r => { if (r.status() >= 400 && !/\/favicon\.ico$/.test(new URL(r.url()).pathname)) errs.push(`${r.status()} ${r.url()}`); });
      let v = null, why = '';
      try { await pg.goto(`http://localhost:${PORT}/?${q}`, { timeout: 900000 });
        // (every burst below draws its last step only — main.ts __runFrames, draw false: a frame on the software adapter is seconds)
        // Sam put a stride from a defender nobody sees and taken back (tools/qa/told-check.ts's staging), the camera left on the defender: the HUD's marks are counted off the DOM
        v = await pg.evaluate(async () => { await window.__ready; const g = window.__game, K = window.__knobs && typeof window.__knobs.registry === 'function' ? window.__knobs.registry() : null;
          g.godMode = true; g.aiEnabled = false; window.__runFrames(30, 1 / 60, [], false);
          const fogOn = !!g.fogOfWar.active, live = g.guards.filter(x => x.team === 'hostile' && x.state !== 'dead'), hidden0 = live.filter(x => g.fogOfWar.hidden(x)).length;
          const out = { fog: fogOn, guards: live.length, hidden: hidden0, told: K && K.TOLD ? `${K.TOLD.on}/${K.TOLD.rung}/${K.TOLD.fogOff}` : null, seen: false, lost: false, marks: 0, dom: 0, text: '', opacity: '', time: 0 };
          const h = live.find(x => g.fogOfWar.hidden(x));
          if (h) { for (const m of g.guards) if (m.team !== 'hostile') m.dazzledUntil = 1e9;
            const start = [...g.player.char.pos], hp = [...h.char.pos]; let near = null;
            for (const [dx, dz] of [[1.2, 0], [-1.2, 0], [0, 1.2], [0, -1.2], [0.9, 0.9], [-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9]]) { const p = [hp[0] + dx, 0, hp[2] + dz]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.5, p[2]], [hp[0], 1.5, hp[2]])) { near = p; break; } }
            if (near) { g.teleportPlayer(near); window.__runFrames(20, 1 / 60, [], false); out.seen = g.fogOfWar.seen(h); g.teleportPlayer(start); g.spectate = g.guards.indexOf(h); window.__runFrames(60, 1 / 60, [], false); out.lost = g.fogOfWar.hidden(h);
              out.marks = g.fogOfWar.lastSeen().length; const els = [...document.querySelectorAll('.marker.lastseen')].filter(e => e.style.display !== 'none'); out.dom = els.length; out.text = els[0]?.textContent ?? ''; out.opacity = els[0]?.style.opacity ?? ''; } }
          out.time = +g.time.toFixed(2); return out; });
        if (shot) await pg.screenshot({ path: path.join(outDir, shot) });
      } catch (e) { why = String(e).slice(0, 300); }
      await pg.close(); return { v, why, errs }; };
    const base = `roomclear&squad4&paused&quality=verylow&mute${OFF}`;
    const x = await load(`${base}&told=guided`, '4-guided-mark.png'), y = await load(`${base}&told=bare`, ''), z = await load(`${base}&fog=off`, '5-fog-off.png'), say = o => o.v ? JSON.stringify(o.v) : `the page did not come ready — ${o.why}`;
    check(!!x.v && x.v.told === 'true/guided/true' && x.v.fog && x.v.seen && x.v.lost && x.v.marks >= 1 && x.v.dom >= 1 && x.v.text === '(?)' && Number(x.v.opacity) > 0.5, 'a room clear on Guided, in play: a defender seen and then lost leaves a \'(?)\' on the HUD where he stood, still strong a second later', say(x));
    check(!!y.v && y.v.fog && y.v.seen && y.v.lost && y.v.marks === 0 && y.v.dom === 0, 'the same on Bare: the same sighting and loss leave no mark', say(y));
    check(!!z.v && z.v.fog === false && z.v.guards > 0 && z.v.hidden === 0 && z.v.time > 0, 'fog=off: the room clear starts with no fog of war and no defender is hidden', say(z));
    const all = [...x.errs.map(e => `guided: ${e}`), ...y.errs.map(e => `bare: ${e}`), ...z.errs.map(e => `fog off: ${e}`)];
    check(all.length === 0, 'no console error, page error or failed resource on the three loads', all.length ? `${all.length}, the first: ${all[0]}` : '0 + 0 + 0');
    await gb.close();
  }
  console.log(failed ? '=== told-page: FAILED ===' : '=== told-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check ran\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
