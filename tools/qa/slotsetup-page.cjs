// SLOTSETUP-PAGE: the gun's key pressed again opens its setup ON THE REAL PAGE, by the keyboard alone (src/game/slotsetup.ts, ui/handbox.ts, host/keymap.ts
// `setFree`). Headless Chromium on the software adapter; every press is a real key event on the page, never a line written into the game's input.
//   as the page opens     the switch is on and the kit column is the box · 2 draws the rifle; 2 again and the box is the setup: a digit in the cap before each row,
//                         none above 5 · a row's digit steps the row and the setup is gone: 2 1 the selector, 2 2 the launcher's load, 2 3 the light ·
//                         Z and L file nothing · 2 then Tab: shut, nothing set · 1 draws the pistol, 1 again then 3: its light
//   with ?slotsetup=0     the switch is off and the column is the one before · 2 again steps the launcher's load, no setup · Z turns the selector, L the light
//   PORT=<port> node tools/qa/slotsetup-page.cjs        (a dev server on that port: PORT=<port> bun run tools/serve.ts)
// exit 0 = every line PASS with no page error · 1 = otherwise. Nothing here has been seen on a GPU, and nobody has played it.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== slotsetup-page: on the real page a gun\'s key again opens its setup and Z and L are no keys; with ?slotsetup=0 the keys and the column are the ones before ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra), { waitUntil: 'domcontentloaded' });
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); const g = window.__game, e = window.__engine, real = e.render; g.godMode = true; g.aiEnabled = false; window.__smoke.params.enabled = false; g.player.rifle.shells = Math.max(g.player.rifle.shells, 3);   // (grenades for the launcher: a load he is out of is stepped over)
      window.__step = (n = 1) => { e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60, []); } finally { e.render = real; } };   // (the game and the HUD step, the picture is not drawn: the software adapter's frame is seconds)
      window.__step(10); return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    const key = async (k, frames = 3) => { await page.keyboard.press(k); await page.evaluate(n => window.__step(n), frames); };
    const read = () => page.evaluate(() => { const g = window.__game, pl = g.player, el = document.getElementById('equip'), box = el.querySelector('.hb');
      const kbd = [...el.querySelectorAll('.hb-row kbd:not(.no)')].map(k => k.textContent);   // (the caps before the rows the setup can step: empty to the eye while it is shut)
      return { on: window.__knobs.registry().SLOTSETUP.on, hand: el.classList.contains('hand'), slot: pl.slot, away: pl.holstered, up: pl.setup ? pl.setup.gun : '', lit: !!box && box.classList.contains('setup'), kbd,
        mode: pl.rifle.mode, load: pl.rifle.attachment, light: pl.rifle.lightOn === true, plight: pl.pistol.lightOn === true, keys: [...el.querySelectorAll('.slot .key')].map(k => k.textContent).join(' ') }; });
    return { page, errors, key, read }; };
  const s = r => `on ${r.on} · box ${r.hand} · ${r.slot}${r.away ? ' (away)' : ''} · setup '${r.up}'${r.lit ? ' lit' : ''} [${r.kbd.join(' ')}] · ${r.mode} · ${r.load} · light ${r.light} · pistol light ${r.plight}`;

  { const A = await open(''), { key, read } = A; const r0 = await read();
    await key('2', 120); const drawn = await read(); await key('2'); const up = await read();
    line(r0.on === true && r0.hand && drawn.slot === 'rifle' && !drawn.away && drawn.up === '' && up.up === 'rifle' && up.lit && up.kbd.length >= 2 && up.kbd.every(d => +d >= 1 && +d <= 5) && up.load === drawn.load && up.mode === drawn.mode,
      'the page opens with the switch on and the kit column is the box; 2 draws the rifle, 2 again and the box is its setup: a digit before each row, none above 5, nothing set yet', `${s(r0)}\n    drawn: ${s(drawn)}\n    2 again: ${s(up)} · slot keys ${up.keys}`);
    await key('1'); const a = await read(); await key('2'); await key('2'); const b = await read(); await key('2'); await key('3'); const c = await read();
    line(a.mode !== up.mode && a.up === '' && a.load === up.load && b.load !== a.load && b.mode === a.mode && b.up === '' && c.light !== b.light && c.load === b.load && c.up === '' && c.slot === 'rifle',
      'a row\'s digit steps its row and the setup is gone: 2 1 turns the selector, 2 2 puts the next load on the launcher, 2 3 turns the light', `2 1: ${s(a)}\n    2 2: ${s(b)}\n    2 3: ${s(c)}`);
    await key('z'); await key('l'); const d = await read(); await key('2'); const e1 = await read(); await key('Tab'); const e2 = await read();
    line(d.mode === c.mode && d.light === c.light && d.load === c.load && e1.up === 'rifle' && e2.up === '' && !e2.lit && e2.mode === c.mode && e2.load === c.load && e2.light === c.light && e2.slot === 'rifle',
      'Z and L are no keys (the selector and the light stay as set); 2 then Tab shuts the setup with nothing set', `after Z, L: ${s(d)}\n    2: ${s(e1)}\n    Tab: ${s(e2)}`);
    await key('1', 120); const p0 = await read(); await key('1'); const p1 = await read(); await key('3'); const p2 = await read();
    line(p0.slot === 'pistol' && !p0.away && p0.up === '' && p1.up === 'pistol' && p1.kbd.includes('3') && p2.plight !== p0.plight && p2.up === '' && !A.errors.length,
      '1 draws the pistol; 1 again and 3 turns its light; no page error in the whole of it', `1: ${s(p0)}\n    1 again: ${s(p1)}\n    3: ${s(p2)} · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
    await A.page.close(); }

  { const B = await open('&slotsetup=0'), { key, read } = B; const r0 = await read();
    await key('2', 120); const drawn = await read(); await key('2'); const again = await read(); await key('z'); const z = await read(); await key('l'); const l = await read();
    line(r0.on === false && !r0.hand && drawn.slot === 'rifle' && again.up === '' && !again.lit && again.load !== drawn.load && z.mode !== again.mode && l.light !== z.light && !B.errors.length,
      'the same page with ?slotsetup=0: the switch is off and the column is the one before; 2 again steps the launcher\'s load with no setup, Z turns the selector, L the light', `${s(r0)}\n    2: ${s(drawn)}\n    2 again: ${s(again)}\n    Z: ${s(z)}\n    L: ${s(l)} · errors ${JSON.stringify(B.errors.slice(0, 3))}`);
    await B.page.close(); }
  await browser.close();
  console.log(failed ? '=== slotsetup-page: FAIL ===' : '=== slotsetup-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check threw\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
