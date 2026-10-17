// THE OPTICAL WAND ON THE REAL PAGE (src/game/wand.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), a kit with the wand
// on your card planted in the store.
//   PORT=5231 node tools/qa/wand-page.cjs [outDir]        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   card    the loadout screen of the four-man room clear shows the 'Optical wand' row, carried; the solo night's (no fog of war: nothing for it to look
//           into) shows the same tile saying 'no use here' in the dim grey, its label lit, the words not cut short
//   play    the room clear staged from that kit: the wand is on him; at a shut door with a defender behind it the panel offers 'look under it'; the row and
//           one Space start it; once through, the lens is his eye among the fog's and the man behind the door is in the picture; a step pulls it out
//   nowand  the same page under ?nowand: nothing on him, no row
//   mate    a teammate's card carries the wand (src/game/wandorder.ts): his chip's card shows the row, carried; in the room clear the door's order menu lists
//           'wandLook' on V with no digit; X on the door then V sends that man alone, he kneels at it, his lens is one of the fog's eyes and the man behind
//           the door comes into the picture; nobody looks before the order
//   nowandmate  the same under ?nowandmate: no row on his card, no row on the door's menu, V sends nobody
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the whole page: frame + HUD) are written to outDir when one is given.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '';   // (ONLY=card|play|nowand|mate|nowandmate = that page alone)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const YOURS = { weapon: 'rifle', smoke: 0, bangs: 1, frags: 1, shells: 1, wand: true };
const KIT = JSON.stringify({ v: 2, members: [YOURS] });
const KIT_MATE = JSON.stringify({ v: 2, members: [{ ...YOURS, wand: false, smoke: 1 }, { weapon: 'rifle', bangs: 1, charges: 1, frags: 1, wand: true }] });   // (the first teammate's issued card with one stun canister given up for the wand; yours carries none)
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q, kit = KIT) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript(k => { try { localStorage.setItem('twopointsix.kit', k); } catch { } }, kit);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    // (the software adapter draws a frame in seconds: the game is STEPPED with the renderer stubbed out — tools/qa/page-look.cjs's PLAY — and a still draws a few real frames first)
    await page.evaluate(() => {
      window.__wandStep = (n, keys) => { const e = window.__engine, real = e.render; e.render = () => { }; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } };
      window.__wandDraw = async (n) => { const dev = window.__engine.device, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await tick(); } }; });
    return { page, errors };
  };
  const shot = async (page, name, draw = 3) => { if (!OUT) return; if (draw) await page.evaluate(n => window.__wandDraw(n), draw).catch(() => { }); await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }).catch(e => console.log(`    (no still ${name}: ${String(e).slice(0, 120)})`)); };

  // ── card
  if (!ONLY || ONLY === 'card') { const { page, errors } = await open('loadout=room-clear-four&nocutboxes');
    await page.waitForTimeout(500);
    const C = await page.evaluate(() => { const lo = document.getElementById('loadout'), kit = lo?.querySelector('.lo-kit');
      const text = (kit || lo || document.body).textContent || '', at = text.indexOf('Optical wand');
      [...(kit || document.body).querySelectorAll('*')].reverse().find(e => (e.textContent || '').startsWith('Optical wand'))?.scrollIntoView({ block: 'center' });   // (the still: on the one start page the kit card is below the fold)
      return { up: !!lo, kit: !!kit, shown: !!lo && lo.getClientRects().length > 0, near: at < 0 ? '' : text.slice(at, at + 160).replace(/\s+/g, ' '), head: at < 0 ? text.replace(/\s+/g, ' ').slice(0, 300) : '' }; });
    await shot(page, 'wand-card', 0);
    line(C.up && C.shown && /carried/i.test(C.near) && !errors.length, 'the loadout screen shows the row on your card, carried', `${JSON.stringify(C)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
    // the same card on the solo night: no fog of war there, so the tile says the wand is of no use ("wand greyed out": it was dimmed whole and still read CARRIED)
    { const { page, errors } = await open('loadout=solo-night&nocutboxes');
      await page.waitForTimeout(500);
      const T = await page.evaluate(() => { const row = document.querySelector('#loadout .lo-kit .kc-row[data-field="wand"]'); if (!row) return { row: false };
        row.scrollIntoView({ block: 'center' });
        const val = row.querySelector('.kc-val'), label = row.querySelector('.kc-label'), other = document.querySelector('#loadout .lo-kit .kc-row[data-field="frags"] .kc-val'), cs = e => (e ? getComputedStyle(e) : null);
        return { row: true, idle: row.classList.contains('idle'), text: (val?.textContent || '').trim(), title: row.title, rowOpacity: cs(row)?.opacity, valColor: cs(val)?.color, otherColor: cs(other)?.color, labelColor: cs(label)?.color,
          cut: !!val && val.scrollWidth > val.clientWidth + 1, icoOpacity: cs(row.querySelector('.kc-ico'))?.opacity, idleRows: [...document.querySelectorAll('#loadout .kc-row.idle')].map(r => r.getAttribute('data-field')).join(',') }; });
      await shot(page, 'wand-card-solo', 0);
      line(T.row && T.idle && /^no use here$/i.test(T.text) && /fog of war/.test(T.title || '') && T.rowOpacity === '1' && T.valColor !== T.otherColor && !T.cut && T.idleRows === 'wand' && !errors.length,
        'the solo night\'s loadout: the wand tile is whole (not dimmed), says "no use here" in another grey than a live value, uncut, with the reason on the tile; no other tile is marked', `${JSON.stringify(T)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
      await page.close(); } }

  // ── play, and the same with the switch off
  for (const [name, q, want] of [['play', 'roomclear&squad4&freshstart=0&nocutboxes', true], ['nowand', 'roomclear&squad4&freshstart=0&nocutboxes&nowand', false]]) {
    if (ONLY && ONLY !== name) continue;
    const { page, errors } = await open(q);
    const R = await page.evaluate(async () => {
      const g = window.__game, pl = () => g.player, fog = g.fogOfWar; window.__menu.close(); window.__smoke.params.enabled = false;
      window.__wandStep(30);
      const out = { wand: pl().wand, fog: fog.active, knob: window.__knobs?.registry?.().WAND?.on };
      // a shut door the wand fits with a living defender within 5 m on one face: Sam goes to the other
      let pick = null;
      for (const d of g.doors.list) { if (d.off || !d.isClosed() || d.def.steel) continue;
        for (const x of g.guards) { if (x.state === 'dead' || x.team !== 'hostile') continue; const dist = Math.hypot(x.char.pos[0] - d.pos[0], x.char.pos[2] - d.pos[2]); if (dist < 5 && (!pick || dist < pick.dist)) pick = { d, x, dist }; } }
      if (!pick) return { ...out, why: 'no shut door with a defender behind it' };
      const { d, x } = pick, side = -g.doors.side(d, x.char.pos), u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width * 0.5, nx = u[1] * side, nz = -u[0] * side;
      g.aiEnabled = false; g.teleportPlayer([hx + u[0] * w - nx * 0.9, 0, hz + u[1] * w - nz * 0.9]);
      const view = document.getElementById('view'), aim = () => { const [sx, sy] = window.__cam.project(x.char.pos, view.clientWidth, view.clientHeight, Infinity, 1e-3); window.__mouse(sx, sy); };
      aim(); window.__wandStep(30);
      const rows = () => g.nearby.filter(r => r.kind === 'door').map(r => r.verb), panel = () => (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ');
      Object.assign(out, { door: d.def.name, man: x.callsign, rows: rows().join(' '), panel: panel().slice(0, 400), hiddenBefore: fog.hidden(x) });
      window.__wandAim = aim;
      return out; });
    await shot(page, `wand-${name}-door`);
    let L = null;
    if (R.rows !== undefined && want) L = await page.evaluate(async (man) => {
      const g = window.__game, pl = g.player, fog = g.fogOfWar, x = g.guards.find(m => m.callsign === man);
      const ok = g.selectVerb('door', 'wand'); window.__input.pressed.add('Space'); window.__wandStep(1);
      const started = !!pl.wanding; for (let i = 0; i < 240; i++) { window.__wandAim(); window.__wandStep(1); }
      const live = !!pl.wanding?.live, eye = !!fog.eyes[0]?.wand, seen = !fog.hidden(x), panel = (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ').slice(0, 300);
      return { ok, started, live, eye, seen, panel };
    }, R.man);
    if (L) await shot(page, 'wand-play-live');
    // N while he looks: the goggles go down, the tube's picture comes up, the look goes on (then up again, so the rest runs as it did)
    let N = null;
    if (L?.live) N = await page.evaluate(async () => {
      const pl = window.__game.player, run = n => { for (let i = 0; i < n; i++) { window.__wandAim(); window.__wandStep(1); } };
      const a0 = pl.nvAmount; window.__input.pressed.add('KeyN'); run(1); const on = pl.nv; run(90); const a1 = pl.nvAmount, live = !!pl.wanding?.live;
      return { on, a0, a1, live };
    });
    if (N) await shot(page, 'wand-play-nv');
    if (N) N.up = await page.evaluate(async () => { const pl = window.__game.player; window.__input.pressed.add('KeyN'); for (let i = 0; i < 90; i++) { window.__wandAim(); window.__wandStep(1); } return { on: pl.nv, a: pl.nvAmount, live: !!pl.wanding?.live }; });
    if (want) line(!!N && N.on === true && N.a0 < 0.05 && N.a1 > 0.9 && N.live && N.up.on === false && N.up.a < 0.1 && N.up.live && !errors.length,
      'N while he looks under the door: his goggles go down and the picture is the tube\'s, the look goes on; N again takes them up', `${JSON.stringify(N)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    let E = null;
    if (L) E = await page.evaluate(async () => { const g = window.__game, pl = g.player; window.__input.pressed.add('KeyS'); window.__wandStep(3, ['KeyS']); const out = !pl.wanding, lock = pl.equipT; window.__wandStep(120); return { out, lock }; });
    if (E) await shot(page, 'wand-play-after');
    if (want) line(R.wand === true && R.knob === true && R.fog === true && /wand/.test(R.rows || '') && /look under it/.test(R.panel || '') && R.hiddenBefore && L?.started && L.live && L.eye && L.seen && E?.out && E.lock > 0 && !errors.length,
      'the room clear staged from that kit: the wand is on him, the door offers the look, the lens shows the man behind it, a step pulls it out', `${JSON.stringify(R)} · ${JSON.stringify(L)} · ${JSON.stringify(E)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    else line(R.wand === false && R.knob === false && !/wand/.test(R.rows || '') && !/look under it/.test(R.panel || '') && R.rows !== undefined && !errors.length,
      'under ?nowand: nothing on him, the switch off, the same door has no such row', `${JSON.stringify(R)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
  // ── a teammate's wand, on your order — and the same with that switch off
  for (const [name, flag, want] of [['mate', '', true], ['nowandmate', '&nowandmate', false]]) {
    if (ONLY && ONLY !== name) continue;
    { const { page, errors } = await open('loadout=room-clear-four&nocutboxes' + flag, KIT_MATE);   // his card
      await page.waitForTimeout(500);
      const C = await page.evaluate(() => { const chip = document.querySelector('#loadout .lo-slot[data-slot="1"]'); chip?.click();
        const row = document.querySelector('#loadout .lo-kit .kc-row[data-field="wand"]'); (row || chip)?.scrollIntoView({ block: 'center' });
        return { chip: !!chip, who: chip?.querySelector('.lo-name')?.textContent || '', picked: !!chip?.classList.contains('pick') || !!document.querySelector('#loadout .lo-slot[data-slot="1"].pick'), row: !!row,
          label: (row?.querySelector('.kc-label')?.textContent || '').trim(), val: (row?.querySelector('.kc-val')?.textContent || '').trim(), title: row?.title || '', pouch: document.querySelector('#loadout .lo-slot[data-slot="1"] .lo-pouch')?.textContent || '',
          yours: (() => { document.querySelector('#loadout .lo-slot[data-slot="0"]')?.click(); const r = document.querySelector('#loadout .lo-kit .kc-row[data-field="wand"]'); const v = (r?.querySelector('.kc-val')?.textContent || '').trim(); document.querySelector('#loadout .lo-slot[data-slot="1"]')?.click(); return v; })() }; });
      await shot(page, `wand-${name}-card`, 0);
      if (want) line(C.chip && C.picked && C.row && /optical wand/i.test(C.label) && /carried/i.test(C.val) && /4 \/ 4/.test(C.pouch) && !/carried/i.test(C.yours) && !errors.length, 'the first teammate\'s kit card shows the Optical wand row, carried, his pouches full; your own card carries none', `${JSON.stringify(C)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
      else line(C.chip && C.picked && !C.row && !errors.length, 'under ?nowandmate: his card has no such row', `${JSON.stringify(C)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
      await page.close(); }
    const { page, errors } = await open('roomclear&squad4&freshstart=0&nocutboxes' + flag, KIT_MATE);
    const R = await page.evaluate(async () => {
      const g = window.__game, fog = g.fogOfWar, S = window.__orders; window.__menu.close(); window.__smoke.params.enabled = false;
      window.__wandStep(30);
      const out = { fog: fog.active, knob: window.__knobs?.registry?.().WAND?.mate, squad: S.squad().map(m => m.callsign).join(', '), wandOnYou: g.player.wand };
      // a shut door the wand fits with a living defender within 5 m of it (the office's server room first: the headless check's own door)
      let pick = null;
      for (const d of g.doors.list) { if (d.off || !d.isClosed() || d.def.steel) continue;
        for (const x of g.guards) { if (x.state === 'dead' || x.team !== 'hostile') continue; const dist = Math.hypot(x.char.pos[0] - d.pos[0], x.char.pos[2] - d.pos[2]) - (d.def.name === 'server' ? 100 : 0); if (dist < 5 && (!pick || dist < pick.dist)) pick = { d, x, dist }; } }
      if (!pick) return { ...out, why: 'no shut door with a defender behind it' };
      const { d, x } = pick; g.aiEnabled = false;
      window.__wandStep(60);   // nobody was ordered: nobody looks
      const unasked = fog.eyes.some(e => e.wand) || S.squad().some(m => S.of(m)?.order === 'wandLook');
      const c = d.frameCentre; S.open(S.targetAt([c[0], 0, c[2]])); window.__wandStep(1);
      const rows = (S.menu?.rows || []).map(r => `${r.id}${r.key ? `(${r.key})` : r.hotKey ? `[${r.hotKey}]` : ''}`).join(' '), high = (S.menu?.rows || []).filter(r => r.key != null && +r.key > 5).length;
      Object.assign(out, { door: d.def.name, man: x.callsign, unasked, rows, high, panel: (document.getElementById('interact')?.innerText || '').replace(/\s+/g, ' ').slice(0, 500), hiddenBefore: fog.hidden(x) });
      window.__wandDoor = d; window.__wandMan = x;
      return out; });
    await shot(page, `wand-${name}-menu`);
    let L = null;
    if (R.rows !== undefined) {
      L = await page.evaluate(async () => { const S = window.__orders; window.__input.pressed.add('KeyV'); window.__wandStep(1);
        const men = S.squad().filter(m => S.of(m)?.order === 'wandLook'); window.__wandHim = men[0] || null;
        return { sent: men.map(m => m.callsign).join(', '), menuUp: !!S.menu, frames: 0, live: false }; });
      for (let k = 0; k < 8 && L.sent && !L.live; k++) Object.assign(L, await page.evaluate(async (f0) => { const fog = window.__game.fogOfWar; let f = 0;
        while (f < 240 && !fog.eyes.some(e => e.wand)) { window.__wandStep(1); f++; }
        return { frames: f0 + f, live: fog.eyes.some(e => e.wand) }; }, L.frames));
      if (L.live) { Object.assign(L, await page.evaluate(async () => { const g = window.__game, fog = g.fogOfWar, S = window.__orders, him = window.__wandHim, x = window.__wandMan; let seen = 0, eyes = 0;
          for (let i = 0; i < 360; i++) { window.__wandStep(1); if (!fog.hidden(x)) seen++; if (fog.eyes.some(e => e.wand)) eyes++; }
          return { seen, eyes, kneels: !!him.char.anim.lockpick, there: S.of(him)?.there || '', order: S.of(him)?.order || '', others: S.squad().filter(m => m !== him).map(m => S.of(m)?.order || '-').join(' ') }; }));
        await shot(page, 'wand-mate-live'); } }
    if (want) line(R.knob === true && R.fog === true && R.wandOnYou === false && R.unasked === false && /wandLook\[KeyV\]/.test(R.rows || '') && R.high === 0 && R.hiddenBefore && L && L.sent && !/,/.test(L.sent) && !L.menuUp && L.live && L.kneels && /^looking under/.test(L.there) && L.seen > 0 && L.eyes === 360 && !/wandLook/.test(L.others) && !errors.length,
      'the room clear staged from that kit: nobody looks unordered; the door\'s menu lists the look on V with no digit; V sends the one man who carries it, he kneels at the door, his lens is a fog eye and shows the man behind it', `${JSON.stringify(R)} · ${JSON.stringify(L)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    else line(R.knob === false && R.rows !== undefined && !/wandLook/.test(R.rows) && R.unasked === false && L && !L.sent && !L.live && !errors.length,
      'under ?nowandmate: the switch off, the same door\'s menu has no such row, V sends nobody', `${JSON.stringify(R)} · ${JSON.stringify(L)}${errors.length ? ' · ERRORS ' + errors.join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== wand-page: FAILED ===' : '=== wand-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
