// THE PLAYER'S OWN CHARGES ON THE REAL PAGE (src/game/owncharge.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), a kit
// with one door charge and one wall charge on your card planted in the store.
//   PORT=5231 node tools/qa/owncharge-page.cjs [outDir]        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   card   the loadout screen of the four-man room clear shows 'Door charges' and 'Wall charges' on YOUR card, and two teammates' wall charges beside
//          yours are a legal squad (no cap of one). Where the build has the kit's one big slot (kit.ts BIGSLOT, on in the page) there is no 'Wall
//          charges' row: the planted wall charge must read 'wall charge' in your card's 'Big slot' row (?nobigslot = the two rows again)
//   play   the room clear staged from that kit: your charges are in the squad's counts; a shut door's panel offers 'set a charge'; the row and one Space
//          put it on in the squad's own time; F blows it
//   off    the same page under ?noowncharge: no row on the card's list for you, nothing of yours in the counts, the same door has no such row
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the whole page: frame + HUD) are written to outDir when one is given.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '';   // (ONLY=card|play|off = that page alone)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const mate = { weapon: 'rifle', smoke: 1, bangs: 1, frags: 0, shells: 0, charges: 0, walls: 1 };
const KIT = JSON.stringify({ v: 2, members: [{ weapon: 'rifle', smoke: 0, bangs: 1, frags: 0, shells: 0, charges: 1, walls: 1 }, mate, mate] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript(k => { try { localStorage.setItem('twopointsix.kit', k); } catch { } }, KIT);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    // (the software adapter draws a frame in seconds: the game is STEPPED with the renderer stubbed to the world's upload, and a still draws a few real frames first)
    await page.evaluate(() => {
      window.__ocStep = (n, keys) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } };
      window.__ocDraw = async (n) => { const dev = window.__engine.device, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await tick(); } }; });
    return { page, errors };
  };
  const shot = async (page, name, draw = 3) => { if (!OUT) return; if (draw) await page.evaluate(n => window.__ocDraw(n), draw).catch(() => { }); await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }).catch(e => console.log(`    (no still ${name}: ${String(e).slice(0, 120)})`)); };

  // ── card
  if (!ONLY || ONLY === 'card') { const { page, errors } = await open('loadout=room-clear-four&nocutboxes');
    await page.waitForTimeout(500);
    const C = await page.evaluate(() => { const lo = document.getElementById('loadout'), kit = lo?.querySelector('.lo-kit');
      const text = ((kit || lo || document.body).textContent || '').replace(/\s+/g, ' '), near = (w, n = 60) => { const at = text.indexOf(w); return at < 0 ? '' : text.slice(at, at + n); };
      [...(kit || document.body).querySelectorAll('*')].reverse().find(e => (e.textContent || '').startsWith('Door charges'))?.scrollIntoView({ block: 'center' });   // (the still: on the one start page the kit card is below the fold)
      return { up: !!lo, shown: !!lo && lo.getClientRects().length > 0, door: near('Door charges'), wall: near('Wall charges'), big: near('Big slot', 90), deploy: [...document.querySelectorAll('button, a')].filter(b => /deploy/i.test(b.textContent || '')).map(b => `${(b.textContent || '').trim().slice(0, 30)}${b.disabled || b.classList.contains('off') ? ' (off)' : ''}`).join(' | '),
        knob: window.__knobs?.registry?.().OWNCHARGE?.on, bigOn: !!window.__knobs?.registry?.().BIGSLOT?.on }; });   // (bigOn: the kit's one big slot, where the build has one — kit.ts BIGSLOT)
    await shot(page, 'owncharge-card', 0);
    line(C.up && C.shown && !!C.door && (C.bigOn ? /wall charge/.test(C.big) : !!C.wall) && C.knob === true && !errors.length, C.bigOn ? 'the loadout screen shows the door charge row on your card, and your wall charge in its big slot' : 'the loadout screen shows both charge rows on your card', `${JSON.stringify(C)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close(); }

  // ── play, and the same with the switch off
  for (const [name, q, want] of [['play', 'roomclear&squad4&freshstart=0&nocutboxes', true], ['off', 'roomclear&squad4&freshstart=0&nocutboxes&noowncharge', false]]) {
    if (ONLY && ONLY !== name) continue;
    const { page, errors } = await open(q);
    const R = await page.evaluate(async () => {
      const g = window.__game, D = window.__doortools, W = window.__wallcharge; window.__menu.close(); window.__smoke.params.enabled = false;
      window.__ocStep(30);
      const out = { knob: window.__knobs?.registry?.().OWNCHARGE?.on, charges: D.charges, walls: W.carried, men: g.guards.filter(x => x.unit && x.team === 'operative').length };
      // the nearest shut, latched, wooden door: Sam at arm's length off its middle, on the face he came from
      const home = [...g.player.char.pos]; let pick = null;
      for (const d of g.doors.list) { if (d.off || !d.isClosed() || !d.latched || d.def.steel) continue; const dist = Math.hypot(home[0] - d.pos[0], home[2] - d.pos[2]); if (!pick || dist < pick.dist) pick = { d, dist }; }
      if (!pick) return { ...out, why: 'no shut door' };
      const d = pick.d, u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width * 0.5, mid = [hx + u[0] * w, 0, hz + u[1] * w];
      const at = [1, -1].map(s => [mid[0] + u[1] * s * 0.75, 0, mid[2] - u[0] * s * 0.75]).sort((a, b) => Math.hypot(a[0] - home[0], a[2] - home[2]) - Math.hypot(b[0] - home[0], b[2] - home[2]))[0];
      g.aiEnabled = false; g.teleportPlayer(at); window.__ocStep(20);
      const rows = () => g.nearby.filter(r => r.kind === 'door').map(r => r.verb), panel = () => (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ');
      window.__ocHome = home; window.__ocDoor = d;
      return { ...out, door: d.def.name, rows: rows().join(' '), panel: panel().slice(0, 400) }; });
    await shot(page, `owncharge-${name}-door`);
    let L = null;
    if (R.rows !== undefined && want) L = await page.evaluate(async () => {
      const g = window.__game, D = window.__doortools, pl = g.player, n0 = D.charges;
      const ok = g.selectVerb('door', 'charge'); window.__input.pressed.add('Space'); window.__ocStep(1);
      const started = !!pl.charging; window.__ocStep(40); const panel = (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200);
      let secs = 40 / 60; for (let i = 0; i < 600 && pl.charging; i++) { window.__ocStep(1); secs += 1 / 60; }
      const set = D.set.filter(c => c.by === 'Sam' && c.door === window.__ocDoor).length, spent = n0 - D.charges; window.__ocStep(10);
      const after = (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ').slice(0, 200);
      return { ok, started, panel, secs: +secs.toFixed(2), setSecs: D.knobs?.setSecs, set, spent, after }; });
    if (L) await shot(page, 'owncharge-play-set');
    let E = null;
    if (L && L.set) E = await page.evaluate(async () => { const g = window.__game, D = window.__doortools, d = window.__ocDoor; g.teleportPlayer(window.__ocHome); window.__ocStep(10); const b0 = D.stats.blown;
      window.__input.pressed.add('KeyF'); window.__ocStep(4); const out = { blown: D.stats.blown - b0, set: D.set.length, open: !!d.off || !d.latched }; window.__ocStep(60); return out; });
    if (E) await shot(page, 'owncharge-play-blown');
    if (want) line(R.knob === true && /charge/.test(R.rows || '') && /set a charge/.test(R.panel || '') && L?.started && /setting the charge/.test(L.panel) && L.set === 1 && L.spent === 1 && E?.blown === 1 && E.set === 0 && E.open && !errors.length,
      'the room clear staged from that kit: the shut door offers the charge, the row and one Space set it, F blows it', `${JSON.stringify(R)} · ${JSON.stringify(L)} · ${JSON.stringify(E)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    else line(R.knob === false && !/charge/.test(R.rows || '') && !/set a charge/.test(R.panel || '') && R.rows !== undefined && !errors.length,
      'under ?noowncharge: the switch off, the same door has no such row', `${JSON.stringify(R)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== owncharge-page: FAILED ===' : '=== owncharge-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
