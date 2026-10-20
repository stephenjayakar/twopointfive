// THE BIG SLOT ON THE REAL PAGE (src/game/kit.ts BIGSLOT, src/game/bigkit.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's
// recipe), a kit with the hammer in YOUR big slot and the breaching shotgun in Red One's planted in the store.
//   PORT=5231 node tools/qa/bigslot-page.cjs [outDir]        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   card   the loadout screen of the four-man room clear: every card has ONE 'Big slot' row, the last, and no Wall charges row; yours reads
//          'dynamic hammer' and its wide pip is lit; one press of its arrow steps it
//   play   the pair's room clear staged from that kit: the hammer is on you, Red One keeps his rifle; at a door locked against you the panel offers the
//          hammer in the boot's place, the row and one Space take the lock, and no shot is fired (a level with no door locked against you: the nearest
//          wooden door is locked by hand, and the line says so)
//          Then (BIGSLOT.shut, BIGSLOT.beside): the kit column on the HUD has a row for the tool, on SPACE, lit at a door that offers it and not away from
//          one; a shut door that is NOT locked keeps its own rows and lists 'hammer it open' under them; the row and one Space and the door ends open,
//          worked from beside the jamb. And the squad's row: the menu opened on a shut door reads 'H: shotgun and clear' on its first page, and H
//          gives it from there
//   off    the same page under ?nobigslot: no 'Big slot' row on any card, nothing on you, the same door offers the boot
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the card's rows) are written to outDir when one is given.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '';   // (ONLY=card|play|off = that page alone)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const you = { weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, shells: 1, charges: 0, walls: 0, big: 'hammer' }, mate = { weapon: 'rifle', smoke: 0, bangs: 2, frags: 1, shells: 0, charges: 1, walls: 0, big: 'shotgun' };
const KIT = JSON.stringify({ v: 2, members: [you, mate] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript(k => { try { localStorage.setItem('twopointsix.kit', k); } catch { } }, KIT);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    // (the software adapter draws a frame in seconds: the game is STEPPED with the renderer stubbed to the world's upload)
    await page.evaluate(() => { window.__bsStep = (n, keys) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } }; });
    return { page, errors };
  };
  const cardOf = (page) => page.evaluate(() => { const rows = [...document.querySelectorAll('.kc-row')].map(r => ({ f: r.getAttribute('data-field'), text: (r.textContent || '').replace(/\s+/g, ' ').trim() }));
    const pips = document.querySelector('.kc-pips'); return { fields: rows.map(r => r.f), big: rows.filter(r => r.f === 'big').map(r => r.text), last: rows.filter(r => r.f !== 'suit' && r.f !== 'trim').at(-1)?.f /* (the last of the KIT's rows: the dense card — ui/kitDense.ts — lays the two colours in a strip after them) */, wide: pips ? [...pips.querySelectorAll('i.big')].map(i => i.classList.contains('on')) : null, knob: window.__knobs?.registry?.().BIGSLOT?.on }; });
  const still = async (page, name) => { if (!OUT) return; await page.evaluate(() => { const v = document.getElementById('view'); if (v) v.style.visibility = 'hidden'; const e = window.__engine; if (e) e.render = () => { }; });
    const row = await page.$('.kc-row[data-field="big"]') ?? await page.$('.kc-row'); if (!row) return; const box = await row.evaluateHandle(e => e.parentElement);
    await box.asElement().screenshot({ path: path.join(OUT, `${name}.png`), timeout: 90000 }).catch(e => console.log(`    (no still ${name}: ${String(e).slice(0, 120)})`)); };

  // ── card
  if (!ONLY || ONLY === 'card') { const { page, errors } = await open('loadout=room-clear-four&nocutboxes'); await page.waitForTimeout(500);
    const C = await cardOf(page);
    line(C.knob === true && C.big.length === 1 && C.last === 'big' && !C.fields.includes('walls') && /dynamic hammer/.test(C.big[0]) && C.wide?.length === 1 && C.wide[0] === true,
      'your card on the loadout screen: ONE Big slot row, the last, and no Wall charges row; it reads the hammer your stored kit carries and the head\'s wide pip is lit', `rows ${C.fields.join(' ')} · '${C.big.join(' | ')}' · wide pip ${JSON.stringify(C.wide)} · switch ${C.knob}`);
    await still(page, 'bigslot-card-hammer');
    const stepped = await page.evaluate(() => { const b = document.querySelector('.kc-row[data-field="big"]'), nx = b ? [...b.querySelectorAll('button')].at(-1) : null; nx?.click(); return !!nx; }); await page.waitForTimeout(300);
    const C2 = await cardOf(page);
    line(stepped && C2.big.length === 1 && C2.big[0] !== C.big[0], 'one press of the row\'s arrow steps the big slot', `'${C.big[0]}' → '${C2.big[0]}'`);
    line(errors.length === 0, 'no page error on the loadout screen', errors.join(' · ') || 'none'); await page.close(); }

  // ── play, and the same page with the switch off
  const play = async (q, name, on) => {
    const { page, errors } = await open(q);
    const R = await page.evaluate(async () => {
      const g = window.__game, pl = g.player; window.__smoke.params.enabled = false; window.__bsStep(30);
      const mates = g.guards.filter(x => x.unit && x.team === 'operative'), out = { knob: window.__knobs?.registry?.().BIGSLOT?.on, bigKit: pl.bigKit, mateGun: mates[0]?.weapon?.def?.id ?? mates[0]?.route?.weapon ?? null, men: mates.length };
      const home = [...pl.char.pos], wood = g.doors.list.filter(d => !d.off && d.isClosed() && !d.def.steel), near = (a, b) => Math.hypot(home[0] - a.pos[0], home[2] - a.pos[2]) - Math.hypot(home[0] - b.pos[0], home[2] - b.pos[2]);
      const spot = (d, s) => { const u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width * 0.5, mid = [hx + u[0] * w, 0, hz + u[1] * w]; return [mid[0] + u[1] * s * 0.75, 0, mid[2] - u[0] * s * 0.75]; };
      let d = null, at = null, byHand = false;
      for (const x of wood.sort(near)) { for (const s of [1, -1]) { const p = spot(x, s); if (!g.doors.bootHolds(x, p) && g.doors.lockedOut(x, p, pl.keys)) { d = x; at = p; break; } } if (d) break; }
      if (!d) { d = wood.sort(near)[0]; if (!d) return { ...out, why: 'no shut wooden door' }; byHand = true; at = [1, -1].map(s => spot(d, s)).find(p => !g.doors.bootHolds(d, p)) ?? spot(d, 1); d.latched = true; d.locked = true; d.lockId = d.lockId || 'bigslot-page'; d.keySide = g.doors.side(d, at); }
      g.aiEnabled = false; g.godMode = true; g.teleportPlayer(at); window.__bsStep(20);
      window.__bsDoor = d; const shots0 = g.events.filter(e => e.kind === 'shot' || e.kind === 'gunshot').length; window.__bsShots0 = shots0;
      return { ...out, door: d.def.name, byHand, locked: d.locked, rows: g.nearby.filter(r => r.kind === 'door').map(r => r.verb).join(' '), panel: (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300) }; });
    if (on) {
      line(R.knob === true && R.bigKit === 'hammer' && R.mateGun !== 'm870' && R.men >= 1, 'the room clear staged from the stored kit: the hammer is on you, and Red One — the shotgun in his big slot — has his rifle in his hands', `bigKit ${R.bigKit} · Red One's gun ${R.mateGun} · ${R.men} with you`);
      line(/\bhammer\b/.test(R.rows || '') && !/\bkick\b/.test(R.rows || '') && /hammer it open/.test(R.panel || ''), `at a door locked against you${R.byHand ? ' (locked by hand: this level has none locked against you within reach)' : ''} the panel offers the hammer in the boot's place`, `${R.door}: rows '${R.rows}' · panel '${(R.panel || '').slice(0, 160)}'${R.why ? ' · ' + R.why : ''}`);
      const L = await page.evaluate(async () => { const g = window.__game, pl = g.player, d = window.__bsDoor; const ok = g.selectVerb('door', 'hammer'); window.__input.pressed.add('Space'); window.__bsStep(1);
        const started = !!pl.kick?.tool, need = pl.kick?.tool?.need; let secs = 1 / 60; for (let i = 0; i < 240 && d.locked; i++) { window.__bsStep(1); secs += 1 / 60; } window.__bsStep(40);
        return { ok, started, need, secs: +secs.toFixed(2), locked: d.locked, broken: !!d.lockBroken, open: !d.latched || Math.abs(d.angle) > 0.2, shots: g.events.filter(e => e.kind === 'shot' || e.kind === 'gunshot').length - window.__bsShots0, free: !pl.kick }; });
      line(L.ok && L.started && !L.locked && L.broken && L.open && L.shots === 0 && L.free && L.secs < 3, 'the row and one Space: the lock is broken and the leaf is in, inside three seconds, no shot fired, and you have your legs back', JSON.stringify(L));
      // any shut door, from beside the frame; the HUD's row; the squad's row on H
      const U = await page.evaluate(async () => { const g = window.__game, pl = g.player, first = window.__bsDoor, home = [...pl.char.pos];
        const hud = () => { const b = document.querySelector('#equip .slot.big'); return b ? { text: (b.textContent || '').replace(/\s+/g, ' ').trim(), key: b.querySelector('.key')?.textContent || '', lit: b.classList.contains('sel') } : null; };
        const spot = (d, s) => { const u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width * 0.5, mid = [hx + u[0] * w, 0, hz + u[1] * w]; return [mid[0] + u[1] * s * 0.75, 0, mid[2] - u[0] * s * 0.75]; };
        const along = (d, p) => { const u = d.dir(), [hx, hz] = d.def.hinge; return (p[0] - hx) * u[0] + (p[2] - hz) * u[1]; };
        const wood = g.doors.list.filter(d => d !== first && !d.off && d.isClosed() && !d.def.steel).sort((a, b) => Math.hypot(home[0] - a.pos[0], home[2] - a.pos[2]) - Math.hypot(home[0] - b.pos[0], home[2] - b.pos[2]));
        const d = wood[0]; if (!d) return { why: 'no second shut wooden door' };
        const at = [1, -1].map(s => spot(d, s)).find(p => !g.col.nav.isBlocked(p[0], p[2])) ?? spot(d, 1), byHand = !!d.locked; d.angle = 0; d.vel = 0; d.latched = true; d.locked = false; d.lockBroken = false;
        // away from every door first: the HUD's row unlit
        const far = g.roomClear?.team?.[0]?.char?.pos ?? home; g.teleportPlayer([far[0], 0, far[2]]); window.__bsStep(8); const away = hud(), awayRows = g.nearby.filter(r => r.kind === 'door').map(r => r.verb).join(' ');
        pl.bigKit = 'none'; window.__bsStep(4); g.teleportPlayer(at); window.__bsStep(12); const bare = g.nearby.filter(r => r.kind === 'door').map(r => r.verb).join(' '), none = hud();
        pl.bigKit = 'hammer'; window.__bsStep(6); const rows = g.nearby.filter(r => r.kind === 'door').map(r => r.verb).join(' '), here = hud(), panel = (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300);
        const ok = g.selectVerb('door', 'hammer'); window.__input.pressed.add('Space'); window.__bsStep(1); const started = !!pl.kick?.tool;
        let stood = NaN; for (let i = 0; i < 300 && !d.lockBroken; i++) window.__bsStep(1); stood = along(d, pl.char.pos); for (let i = 0; i < 180 && Math.abs(d.angle) < 0.5; i++) window.__bsStep(1); window.__bsStep(40);
        return { door: d.def.name, byHand, away, awayRows, none, bare, rows, here, panel, ok, started, broken: !!d.lockBroken, angle: +d.angle.toFixed(2), stood: +stood.toFixed(2), width: d.def.width, free: !pl.kick }; });
      line(!!U.here && /hammer/.test(U.here.text) && U.here.key === 'SPACE' && U.here.lit && !!U.away && !U.away.lit && U.none === null && !/\d/.test(U.here.key), 'the kit column on the HUD has a row for the hammer, on SPACE and no digit: lit at a door that offers it, unlit away from one, and gone with nothing in the big slot', `at the door ${JSON.stringify(U.here)} · away ${JSON.stringify(U.away)} (door rows there: '${U.awayRows}') · nothing carried ${JSON.stringify(U.none)}${U.why ? ' · ' + U.why : ''}`);
      line(!!U.bare && U.rows === `${U.bare} hammer` && /hammer it open/.test(U.panel || ''), `a shut door that is NOT locked${U.byHand ? ' (unlocked by hand)' : ''}: its own rows stand, and 'hammer it open' is listed under them`, `${U.door}: without it '${U.bare}' · with it '${U.rows}' · panel '${(U.panel || '').slice(0, 200)}'`);
      line(U.ok && U.started && U.broken && Math.abs(U.angle) > 0.5 && U.free && (U.stood < -0.05 || U.stood > U.width + 0.05), 'the row and one Space: worked from beside the jamb, the latch broken and the door ENDS OPEN', JSON.stringify({ started: U.started, broken: U.broken, angle: U.angle, stood: U.stood, width: U.width, free: U.free }));
      const M = await page.evaluate(async () => { const g = window.__game, pl = g.player, O = g.orders, mates = g.guards.filter(x => x.unit && x.team === 'operative' && x.state !== 'dead');
        const lead = mates[0]?.char?.pos ?? pl.char.pos, d = g.doors.list.filter(x => !x.off && x.isClosed() && !x.def.steel).sort((a, b) => Math.hypot(lead[0] - a.pos[0], lead[2] - a.pos[2]) - Math.hypot(lead[0] - b.pos[0], lead[2] - b.pos[2]))[0]; if (!d) return { why: 'no shut wooden door left' };
        g.teleportPlayer([lead[0] + 0.6, 0, lead[2] + 0.6]); window.__bsStep(6);
        const up = O.open(O.targetAt(d.frameCentre)); window.__bsStep(2); const shown = (O.hud().menu?.rows ?? []).flatMap(r => r.opts.map(x => `${x.key ? `[${x.key}] ` : ''}${x.text}`)).join(' | '), panel = (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ');
        window.__input.pressed.add('KeyH'); window.__bsStep(1); const down = !O.menu, big = g.doorTools.ops.some(op => op.big), last = O.log?.[O.log.length - 1] ?? null; O.clear?.(); window.__bsStep(2);
        return { door: d.def.name, up, shown, inPanel: /H: (shotgun|hammer) and clear/.test(panel), down, big, last: typeof last === 'string' ? last : JSON.stringify(last) }; });
      line(M.up && /H: shotgun and clear/.test(M.shown || '') && M.inPanel && M.down && M.big, 'the squad\'s row: the orders menu opened on a shut door reads \'H: shotgun and clear\' on its first page (Red One carries the shotgun), and H gives it from there', `${M.door}: ${M.shown} · drawn in the panel ${M.inPanel} · after H: menu down ${M.down}, a door order of the tool's ${M.big} · ${String(M.last).slice(0, 160)}${M.why ? ' · ' + M.why : ''}`);
    } else {
      line(R.knob === false && R.bigKit === 'none' && !/\bhammer\b|\bbreach\b/.test(R.rows || '') && /\bkick\b/.test(R.rows || ''), '?nobigslot: nothing is on you, and the same door offers the boot', `switch ${R.knob} · bigKit ${R.bigKit} · ${R.door}: rows '${R.rows}'`);
      const H = await page.evaluate(() => ({ big: !!document.querySelector('#equip .slot.big'), slots: document.querySelectorAll('#equip .slot').length }));
      line(!H.big && H.slots >= 5, '?nobigslot: the HUD\'s kit column has no big slot row', JSON.stringify(H));
    }
    line(errors.length === 0, `no page error (${name})`, errors.join(' · ') || 'none'); await page.close(); };
  if (!ONLY || ONLY === 'play') await play('roomclear&nocutboxes', 'play', true);
  if (!ONLY || ONLY === 'off') { await play('roomclear&nocutboxes&nobigslot', 'off', false);
    const { page, errors } = await open('loadout=room-clear-four&nocutboxes&nobigslot'); await page.waitForTimeout(500); const C = await cardOf(page);
    line(C.knob === false && C.big.length === 0 && C.wide?.length === 0, '?nobigslot on the loadout screen: no Big slot row, no wide pip', `rows ${C.fields.join(' ')} · switch ${C.knob}`);
    line(errors.length === 0, 'no page error (off, loadout)', errors.join(' · ') || 'none'); await page.close(); }
  await browser.close();
  console.log(failed ? '\nbigslot-page: FAILED' : '\nbigslot-page: ALL PASS'); process.exit(failed ? 1 : 0);
})();
