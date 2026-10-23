// THE CAMERA RUNNING ITSELF, ON THE REAL PAGE (src/host/autocam.ts, host/loop.ts, host/findme.ts, ui/findme.ts): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the page as it opens, its own Options screen clicked and its own keyboard and mouse events sent.
//   PORT=5241 node tools/qa/autocam-page.cjs     (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   row      Options > Game has the Auto camera row, Off on a fresh machine with nothing kept, and no row for the double tap of its own
//   on       a real double tap of the camera's key puts the mode on (kept in the page's store) and the view comes round to where he looks
//   frames   with the mode on the mouse carried across the screen moves the look-at nowhere; with it off the look-at follows the cursor as it always did
//   off      the key held + a real drag of the mouse gives the view back (the store keeps nothing) and that drag turns the view
//   walk     on again by the double tap; the key held with a walk key down gives it back too
//   sway     the mode on and a walk across the view: the yaw leans that way frame by frame, never faster than its cap, and is home again when he stops
//            (AUTOCAM.sway; the lines above run with it parked off, and this one with nobody counted as in his line, so that a guard who happens to stand
//            in the open at the start decides nothing)
//   kept     the row flipped on is kept over a reload; Reset to defaults puts it off
//   tune     (AUTOCAM.tune; the lines above run under `?autotune=0`, the camera as built, where the section must not be) the page as it opens: a real
//            double tap's swing comes round eased, frame by frame; Options >
//            Game has the auto camera's own section, Gentle lit with nothing kept and the table on gentle's numbers; Free clicked is the numbers as built
//            and is kept; a row slid is the player's own over the mode (it stays lit and its line says so) and is kept; both hold over a reload; Reset puts Gentle back and keeps nothing.
//            Then the soft lock (AUTOCAM.lock; the lines above run under `?autolock=0` too): with the mode on, a man who is not onto him is stood at the end
//            of a clear line and he is put 9 m and then 3 m from him: the camera is metres nearer at 3 m and never moves by a step.
//            ONLY=tune runs this part alone.
//   THE CAMERA'S KEY is read from the page (`__keys.camCap()`), as findme-page.cjs reads it. exit 0 = all of it with no page error · 1 = otherwise.
//   The verdict is the page's DOM, its store and the camera's numbers: nothing here judges a picture, and none of it has been seen on a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const LS = 'twopointsix.autocam', LS_TUNE = 'twopointsix.autotune', ONLY = process.env.ONLY || '';

const STEP = (n) => window.__runFrames(n, 1 / 60, [], false);
const WALK = (n) => window.__runFrames(n, 1 / 60, ['KeyW'], false);
const OPEN = () => { window.__menu.open('pause'); const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent.trim() === 'Options'); if (!b) return 'no Options button on the pause card'; b.click();
  const t = document.querySelector('#options .op-tab[data-tab="game"]'); if (!t) return 'no Game tab'; t.click(); return ''; };
const ROWS = () => Object.fromEntries([...document.querySelectorAll('#options .op-row')].map(r => [r.querySelector('.op-label').textContent, r.querySelector('.op-switch') ? r.querySelector('.op-switch').textContent : '']));
const FLIP = (label) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); if (!r) return `no row ${label}`; r.querySelector('.op-switch').click(); return ''; };
const RESET = () => { const b = document.querySelector('#options [data-act="reset"]'); if (!b) return 'no Reset'; b.click(); return ''; };
const SHUT = () => { document.querySelector('#options [data-act="back"]')?.click(); window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; const K = window.__knobs.registry().AUTOCAM; window.__swayWas = K.sway; K.sway = false; };
// in the page: n frames one at a time with these keys held, and how the yaw went
const SWAY = ([keys, n]) => { const c = window.__cam, y0 = c.yaw; let most = 0, far = 0, prev = y0, first = 0; for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 60, keys, i % 60 === 59 ? false : 'none'); const s = Math.abs(c.yaw - prev); if (!first && s > 0) first = s; most = Math.max(most, s); far = Math.max(far, Math.abs(c.yaw - y0)); prev = c.yaw; } return { yaw: c.yaw, most, far, first }; };
// in the page: a man who is not onto him at the end of a clear line (found once), every other guard out of the picture, he `m` metres from him, `n` frames one
// at a time with the man put back before each (a man on a round walks it with the AI off): where the camera is, and the most it moved in a frame
const LOCK = ([m, n]) => { const g = window.__game, c = window.__cam; g.fogOfWar.hidden = () => false; let L = window.__lockT;
  if (!L) { for (const gd of g.guards) { if (gd.state === 'dead' || gd.civ || gd.held || gd.team === 'operative') continue; const q = gd.char.pos;
      for (let i = 0; i < 16 && !L; i++) { const a = i * Math.PI / 8, dx = Math.sin(a), dz = Math.cos(a); let clear = true; for (let s = 0.5; s <= 9.5 && clear; s += 0.5) { if (s >= 2 && g.col.nav.isBlocked(q[0] + dx * s, q[2] + dz * s)) clear = false; for (const h of [1.3, 0.4]) if (g.col.segmentBlocked([q[0], h, q[2]], [q[0] + dx * s, h, q[2] + dz * s])) clear = false; } if (clear) L = { gd, at: [q[0], q[2]], dir: [dx, dz] }; }
      if (L) break; }
    if (!L) return null; window.__lockT = L; }
  const pin = () => { for (const o of g.guards) { if (o === L.gd) { o.char.pos[0] = L.at[0]; o.char.pos[2] = L.at[1]; o.state = 'patrol'; } else if (o.team !== 'operative') { o.char.pos[0] = L.at[0] - L.dir[0] * 60; o.char.pos[2] = L.at[1] - L.dir[1] * 60; } } };
  pin(); g.teleportPlayer([L.at[0] + L.dir[0] * m, 0, L.at[1] + L.dir[1] * m]); let most = 0, prev = NaN;
  for (let i = 0; i < n; i++) { pin(); window.__runFrames(1, 1 / 60, [], i % 60 === 59 ? false : 'none'); if (i > 1) most = Math.max(most, Math.abs(c.desiredDistance - prev)); prev = c.desiredDistance; }
  const P = g.player.char.pos; return { d: c.desiredDistance, most, dist: Math.hypot(P[0] - L.at[0], P[2] - L.at[1]), on: window.__knobs.registry().AUTOCAM.lock }; };
// the auto camera's own section as Options shows it, and the table and the store under it
const TUNE = () => { const K = window.__knobs.registry().AUTOCAM, rows = [...document.querySelectorAll('#options .op-row')], by = l => rows.find(x => x.querySelector('.op-label').textContent === l), val = l => { const r = by(l); return r ? r.querySelector('.op-val').textContent : null; }, seg = by('Camera turning'), last = by('Start zooming in from') || by('Stay on the squad');
  // (the pointer onto the mode's row from another: the foot shows its line as it now reads)
  if (last) last.dispatchEvent(new Event('mouseenter')); if (seg) seg.dispatchEvent(new Event('mouseenter')); const line = (document.querySelector('#options .op-desc') || {}).textContent || '';
  let seen = false; if (last) { last.scrollIntoView({ block: 'center' }); const b = last.getBoundingClientRect(); seen = b.height > 0 && b.top >= 0 && b.bottom <= window.innerHeight; }
  return { labels: rows.map(r => r.querySelector('.op-label').textContent), secs: [...document.querySelectorAll('#options .op-sec')].map(x => x.textContent), lit: seg ? [...seg.querySelectorAll('.op-opt.on')].map(b => b.textContent).join() : null, speed: val('Turn speed'), fight: val('Turn in a fight'), wall: by('Turn when a wall hides you') ? by('Turn when a wall hides you').querySelector('.op-switch').textContent : null,
    line, swingSpeed: val('Swing speed'), tune: K.tune, cap: K.turnCap, swingCap: K.swingCap, ahead: K.restAhead, fightMax: K.swayFightMax, move: K.swayMove, kept: localStorage.getItem('twopointsix.autotune'), seen }; };
const PICK = (word) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === 'Camera turning'); const b = r && [...r.querySelectorAll('.op-opt')].find(x => x.textContent === word); if (!b) return `no ${word} on Camera turning`; b.click(); return ''; };
const SLIDE = ([label, v]) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label), i = r && r.querySelector('input.op-range'); if (!i) return `no slider on ${label}`; i.value = String(v); i.dispatchEvent(new Event('input', { bubbles: true })); return ''; };
const VIEW = () => { const g = window.__game, c = window.__cam, f = c.planarBasis().fwd, a = g.player.char.aimYaw, p = g.player.char.pos;
  return { yaw: c.yaw, aim: a, dot: f[0] * Math.sin(a) + f[2] * Math.cos(a), lead: Math.hypot(c.desired[0] - p[0], c.desired[2] - p[2]), look: [c.desired[0], c.desired[2]], kept: localStorage.getItem('twopointsix.autocam'), fatal: (document.querySelector('#fatal') || {}).textContent || '' }; };

(async () => {
  let red = 0; const check = (ok, what, detail = '') => { if (!ok) red++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); };
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultTimeout(900000); page.setDefaultNavigationTimeout(900000);   // (a boot on the software adapter is minutes, and the reload is a second one)
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const plain = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute`, url = `${plain}&autotune=0&autolock=0`, wait = ms => new Promise(r => setTimeout(r, ms));   // (`url`: the camera as built, for the lines as built)
  const boot = async (again, to = url) => { if (again) await page.reload(); else await page.goto(to); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 20); };
  const dist = (a, b) => Math.hypot(a.look[0] - b.look[0], a.look[1] - b.look[1]);
  try {
   if (ONLY !== 'tune') {
    log(url); await boot(false); log('booted');
    const cap = await page.evaluate(() => (window.__keys && window.__keys.camCap ? window.__keys.camCap() : 'Ctrl')), KEY = cap === 'Ctrl' ? 'Control' : cap;
    const twice = async () => { await wait(500); await page.keyboard.press(KEY, { delay: 40 }); await wait(60); await page.keyboard.press(KEY, { delay: 40 }); await page.evaluate(STEP, 90); return page.evaluate(VIEW); };
    // row
    let e = await page.evaluate(OPEN); if (e) throw new Error(e);
    const a = await page.evaluate(ROWS), k0 = await page.evaluate(k => localStorage.getItem(k), LS);
    check(a['Auto camera'] === 'Off' && !(`Double tap ${cap}` in a) && k0 === null && !('Camera turning' in a), 'Options > Game has the Auto camera row, Off with nothing kept, no row for the double tap of its own, and under ?autotune=0 none of the tuning\'s', `Auto camera: ${a['Auto camera']} · kept ${k0} · the camera's key ${cap} · a Camera turning row ${'Camera turning' in a ? 'IS THERE' : 'is not there'}`);
    await page.evaluate(SHUT); await page.evaluate(STEP, 10);
    // frames, the mode off: the look-at follows the cursor
    await page.mouse.move(150, 300); await page.evaluate(STEP, 60); const f0 = await page.evaluate(VIEW);
    await page.mouse.move(880, 300); await page.evaluate(STEP, 60); const f1 = await page.evaluate(VIEW);
    // on
    await page.mouse.move(300, 520); await page.evaluate(STEP, 40); const hs = await page.evaluate(VIEW);   // (the mouse to one side of him: he faces it, and it is not ahead of the view)
    let t1 = hs; for (let tries = 0; tries < 3 && t1.kept !== '1'; tries++) t1 = await twice();
    check(hs.kept === null && t1.kept === '1' && t1.yaw !== hs.yaw && t1.dot > 0.98, `a real double tap of ${cap} puts the mode on, kept in the page's store, and the view comes round to where he looks`,
      `kept ${hs.kept} → ${t1.kept} · the view was ${(Math.acos(Math.max(-1, Math.min(1, hs.dot))) * 180 / Math.PI).toFixed(0)}° off his facing, now ${(Math.acos(Math.max(-1, Math.min(1, t1.dot))) * 180 / Math.PI).toFixed(1)}°`);
    // frames, the mode on: the mouse carried across the screen moves the look-at nowhere it would not have gone
    await page.mouse.move(150, 300); await page.evaluate(STEP, 60); const g0 = await page.evaluate(VIEW);
    await page.mouse.move(880, 300); await page.evaluate(STEP, 60); const g1 = await page.evaluate(VIEW);
    check(dist(f0, f1) > 0.5 && dist(g0, g1) < 0.05 && g1.kept === '1', 'with the mode on the mouse carried across the screen moves the look-at nowhere; with it off the look-at followed the cursor',
      `off: the look-at moved ${dist(f0, f1).toFixed(2)} m with the mouse · on: ${dist(g0, g1).toFixed(3)} m, ${g1.lead.toFixed(2)} m from his feet`);
    // off: the key held + a drag
    await page.mouse.move(400, 300); await page.evaluate(STEP, 30); const v0 = await page.evaluate(VIEW);
    await page.keyboard.down(KEY); await page.mouse.move(450, 300); await page.mouse.move(500, 300); await page.keyboard.up(KEY); await page.evaluate(STEP, 2); const v1 = await page.evaluate(VIEW);
    check(v0.kept === '1' && v1.kept === null && v1.yaw !== v0.yaw, `${cap} held + a real drag of the mouse gives the view back, and that drag turns the view`, `kept ${v0.kept} → ${v1.kept} · yaw ${(v1.yaw - v0.yaw).toFixed(4)} rad`);
    // walk: on again, then the key held with a walk key
    let w0 = v1; for (let tries = 0; tries < 3 && w0.kept !== '1'; tries++) w0 = await twice();
    await page.keyboard.down(KEY); await page.evaluate(WALK, 30); await page.keyboard.up(KEY); await page.evaluate(STEP, 2); const w1 = await page.evaluate(VIEW);
    check(w0.kept === '1' && w1.kept === null, `on again by the double tap; ${cap} held with a walk key down gives the view back too`, `kept ${w0.kept} → ${w1.kept}`);
    // sway: on again, the sway as the page had it, a walk across the view and a stop
    const K = await page.evaluate(() => { const K = window.__knobs.registry().AUTOCAM; K.sway = window.__swayWas; K.fightM = 0; K.turn = false; return { sway: K.sway, cap: K.swayRate / 60, move: K.swayMove }; });
    let s0 = w1; for (let tries = 0; tries < 3 && s0.kept !== '1'; tries++) s0 = await twice();
    const s1 = await page.evaluate(SWAY, [['KeyD'], 150]), s2 = await page.evaluate(SWAY, [[], 540]);
    check(K.sway === true && s0.kept === '1' && s1.far > 0.04 && s1.far <= K.move + 1e-6 && s1.most <= K.cap + 1e-9 && s2.most <= K.cap + 1e-9 && Math.abs(s2.yaw - s0.yaw) < 1e-3,
      'the mode on and a walk across the view: the yaw leans that way frame by frame, never faster than its cap, and is home again nine seconds after he stops',
      `the page opens with the sway ${K.sway ? 'on' : 'OFF'} · two and a half seconds across the view: the yaw leans ${(s1.far * 180 / Math.PI).toFixed(1)}° at the most, ${(s1.most / K.cap * 100).toFixed(0)}% of the cap in a frame · stopped: ${(Math.abs(s2.yaw - s0.yaw) * 180 / Math.PI).toFixed(4)}° from where it was`);
    await page.evaluate(() => { const K = window.__knobs.registry().AUTOCAM; K.fightM = 22; K.turn = true; });
    // kept: the row, a reload, Reset
    e = await page.evaluate(OPEN); if (e) throw new Error(e); e = await page.evaluate(FLIP, 'Auto camera'); if (e) throw new Error(e);
    if ((await page.evaluate(ROWS))['Auto camera'] !== 'On') { e = await page.evaluate(FLIP, 'Auto camera'); if (e) throw new Error(e); }   // (the walk above left the mode on: the first click put it off)
    const r1 = await page.evaluate(ROWS), k1 = await page.evaluate(k => localStorage.getItem(k), LS);
    log('reloading'); await boot(true); e = await page.evaluate(OPEN); if (e) throw new Error(e);
    const r2 = await page.evaluate(ROWS), k2 = await page.evaluate(k => localStorage.getItem(k), LS);
    e = await page.evaluate(RESET); if (e) throw new Error(e); const r3 = await page.evaluate(ROWS), k3 = await page.evaluate(k => localStorage.getItem(k), LS);
    check(r1['Auto camera'] === 'On' && k1 === '1' && r2['Auto camera'] === 'On' && k2 === '1' && r3['Auto camera'] === 'Off' && k3 === null, 'the row flipped on is kept over a reload; Reset to defaults puts it off',
      `flipped: ${r1['Auto camera']}, kept ${k1} · after a reload: ${r2['Auto camera']}, kept ${k2} · after Reset: ${r3['Auto camera']}, kept ${k3}`);
   }
    // tune: the page as it opens
    { const D = 180 / Math.PI, near = (a, b) => Math.abs(a - b) < 1e-6, WANT = ['Camera turning', 'Turn when a wall hides you', 'Turn to face the door ahead', 'Turn speed', 'Wait before it turns', 'Time between turns', 'Turn in a fight', 'Lean when you move sideways', 'Lean speed', 'Swing when you double tap', 'Swing speed', 'Framing', 'Framing speed', 'Zoom', 'Zoom speed', 'Stay on the squad', 'Zoom in when you sneak up', 'Start zooming in from'];
      log(plain); await boot(false, plain); log('booted, the page as it opens');
      // …and its double tap: the swing eased, frame by frame
      { const cap = await page.evaluate(() => (window.__keys && window.__keys.camCap ? window.__keys.camCap() : 'Ctrl')), KEY = cap === 'Ctrl' ? 'Control' : cap;
        let e0 = await page.evaluate(OPEN); if (e0) throw new Error(e0);   // (as the lines above begin: the pause card's Options, then both put away — whatever card the page opened under is gone, and the camera's key is the camera's)
        const top = await page.evaluate(() => { document.querySelector('#options [data-act="back"]')?.click(); window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; return window.__knobs.registry().AUTOCAM.swingCap / 60; });
        await page.evaluate(STEP, 10);
        await page.mouse.move(300, 520); await page.evaluate(STEP, 40); const hs = await page.evaluate(VIEW);
        let sw = null, v = hs; for (let tries = 0; tries < 3 && v.kept !== '1'; tries++) { await wait(500); await page.keyboard.press(KEY, { delay: 40 }); await wait(60); await page.keyboard.press(KEY, { delay: 40 }); sw = await page.evaluate(SWAY, [[], 300]); v = await page.evaluate(VIEW); }
        check(hs.kept === null && v.kept === '1' && sw && top > 0 && sw.first > 0 && sw.first < 0.1 * top && sw.most <= top * (1 + 1e-6) && v.dot > 0.98,
          `the page as it opens: a real double tap of ${cap} puts the mode on and the view comes round to where he looks eased, from rest and never over the swing's top speed in a frame`,
          sw ? `the view was ${(Math.acos(Math.max(-1, Math.min(1, hs.dot))) * D).toFixed(0)}° off his facing, now ${(Math.acos(Math.max(-1, Math.min(1, v.dot))) * D).toFixed(1)}° · the first frame ${(sw.first / top * 100).toFixed(1)}% of the top speed's step (${(top * 60 * D).toFixed(0)}° a second), the most ${(sw.most / top * 100).toFixed(0)}%` : 'the double tap was not taken');
        // …and the soft lock, the mode still on: a man who is not onto him, 9 m off and then 3 m off
        log('the soft lock'); const l9 = await page.evaluate(LOCK, [9, 150]), l3 = l9 && await page.evaluate(LOCK, [3, 240]), on = (await page.evaluate(VIEW)).kept === '1';
        check(!!l9 && !!l3 && on && l9.on === true && Math.abs(l9.dist - 9) < 0.3 && Math.abs(l3.dist - 3) < 0.3 && l3.d < l9.d - 2 && l3.most > 0 && l3.most < 0.03 * l9.d && l9.most < 0.03 * l9.d,
          'the page as it opens, the mode on: put 3 m from a man who is not onto him the camera is metres nearer than at 9 m, and it never moves by a step (under 3% of its distance in a frame)',
          l9 && l3 ? `at ${l9.dist.toFixed(1)} m from him the camera is ${l9.d.toFixed(2)} m off, at ${l3.dist.toFixed(1)} m ${l3.d.toFixed(2)} m · the most it moves in a frame ${(Math.max(l9.most, l3.most) * 100).toFixed(1)} cm · the mode ${on ? 'still on' : 'WENT OFF'}` : 'no guard with a clear line of 9.5 m on this floor'); }
      let e2 = await page.evaluate(OPEN); if (e2) throw new Error(e2); const t0 = await page.evaluate(TUNE), missing = WANT.filter(l => !t0.labels.includes(l));
      check(!missing.length && t0.secs.includes('Auto camera · trying out') && t0.lit === 'Gentle' && t0.tune === true && near(t0.cap * D, 30) && t0.ahead === false && near(t0.fightMax * D, 15) && t0.move === 0 && t0.speed === '30° a second' && t0.swingSpeed === '180° a second' && near(t0.swingCap * D, 180) && t0.fight === '15°' && t0.wall === 'On' && t0.kept === null && t0.seen && /leans a little toward a fight/.test(t0.line),
        'the page as it opens: Options > Game has the auto camera\'s own section, Gentle lit with nothing kept, the table on gentle\'s numbers, and its last row can be scrolled to',
        `rows missing: ${missing.join(', ') || 'none'} (${t0.labels.length} rows on the tab) · lit: ${t0.lit} · turn speed '${t0.speed}' (${(t0.cap * D).toFixed(1)}° a second in the table), in a fight '${t0.fight}', for a wall ${t0.wall}, for the door ahead ${t0.ahead} · kept ${t0.kept} · the last row on screen once scrolled to ${t0.seen}`);
      e2 = await page.evaluate(PICK, 'Free'); if (e2) throw new Error(e2); const t1 = await page.evaluate(TUNE);
      e2 = await page.evaluate(SLIDE, ['Turn in a fight', 20]); if (e2) throw new Error(e2); e2 = await page.evaluate(SLIDE, ['Turn speed', 40]); if (e2) throw new Error(e2);
      const t2 = await page.evaluate(TUNE);
      check(t1.lit === 'Free' && t1.cap === 0 && t1.ahead === true && t1.speed === 'Quick' && /"mode":"free"/.test(t1.kept || '') && near(t2.fightMax * D, 20) && near(t2.cap * D, 40) && t2.lit === 'Free' && /You've changed some of the settings/.test(t2.line) && t2.speed === '40° a second' && t2.fight === '20°' && /swayFightMax/.test(t2.kept || '') && /turnCap/.test(t2.kept || ''),
        'Free clicked is the numbers as built and is kept; two rows slid are the player\'s own over it (the mode\'s line says so) and are kept',
        `Free: lit ${t1.lit}, turn speed '${t1.speed}', for the door ahead ${t1.ahead}, kept ${t1.kept} · slid: in a fight '${t2.fight}', turn speed '${t2.speed}', lit '${t2.lit}', its line '${t2.line}', kept ${t2.kept}`);
      log('reloading'); await boot(true); e2 = await page.evaluate(OPEN); if (e2) throw new Error(e2); const t3 = await page.evaluate(TUNE);
      e2 = await page.evaluate(RESET); if (e2) throw new Error(e2); const t4 = await page.evaluate(TUNE);
      check(near(t3.fightMax * D, 20) && near(t3.cap * D, 40) && t3.ahead === true && t3.lit === 'Free' && /You've changed some of the settings/.test(t3.line) && t3.fight === '20°' && t4.lit === 'Gentle' && !/You've changed/.test(t4.line) && near(t4.cap * D, 30) && t4.ahead === false && near(t4.fightMax * D, 15) && t4.kept === null,
        'the mode and the rows hold over a reload; Reset to defaults puts Gentle back and keeps nothing',
        `after a reload: in a fight '${t3.fight}', turn speed '${t3.speed}', for the door ahead ${t3.ahead}, lit '${t3.lit}' · after Reset: lit ${t4.lit}, turn speed '${t4.speed}', in a fight '${t4.fight}', kept ${t4.kept}`); }
    const fatal = (await page.evaluate(VIEW)).fatal;
    check(!errs.length && !fatal, 'no page error, no console error, nothing on the fatal card', errs.length ? errs.slice(0, 4).join(' | ') : fatal);
  } catch (err) { red++; console.log(`- FAIL — the run stopped: ${String(err).slice(0, 400)}`); }
  await browser.close();
  console.log(red ? `\nautocam-page: FAIL (${red})` : '\nautocam-page: ALL PASS'); process.exit(red ? 1 : 0);
})();
