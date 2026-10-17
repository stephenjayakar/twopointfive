// A MAN'S CONDITION ON THE REAL PAGE (src/game/condition.ts, the looks in character.ts): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the four-man room clear staged, nobody's senses on.
//   PORT=5241 node tools/qa/condition-page.cjs [outDir]        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   on     the page opens with the switch on; a teammate, a defender and the player marked hurt (the stamp a burst leaves) and folded: each figure is dealt
//          the hurt look and the fold, the panel's line names all three
//   legs   the hurt player with Shift and W held never sprints; the mark taken off him, the same keys are a sprint
//   mark   a stunned teammate carries no '✹' (his forearm over his eyes says it); a stunned defender stood beside Sam still does
//   off    the same page with ?nocondition: the switch is off, the same stamps deal no figure anything, the panel's line reads 'off'
// exit 0 = all four, with no page error · 1 = otherwise. With an outDir, a still of the page with the three men hurt is written there.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad4&freshstart=0&nocutboxes${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== condition-page: the real page deals a hurt man his look, takes his sprint, and with ?nocondition does neither ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  // the staging both pages share: three men stamped as a burst leaves them, a few frames, what each figure was dealt
  const stage = () => {
    const g = window.__game, e = window.__engine, real = e.render; window.__menu.close(); window.__smoke.params.enabled = false;
    const step = (n, keys = []) => { e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, keys); } finally { e.render = real; } };
    step(30); g.aiEnabled = false; g.godMode = false;
    const mate = g.guards.find(x => x.team === 'operative' && x.state !== 'dead'), foe = g.guards.find(x => x.team !== 'operative' && !x.civ && x.state !== 'dead'), pl = g.player;
    for (const m of [mate, foe, pl]) { m.hurtAt = g.time; m.staggerUntil = g.time + 2; }
    step(3); const an = m => ({ hurt: m.char.anim.hurt, fold: m.char.anim.foldToo, clutch: +m.char.anim.clutch.toFixed(2) });
    window.__cd = { g, step, mate, foe, pl };
    return { on: window.__knobs.registry().CONDITION.on, moves: window.__knobs.registry().MOVES?.on, men: [an(mate), an(foe), an(pl)], names: [mate.callsign, foe.callsign], summary: g.conditionSummary() };
  };
  // --- the page as it opens
  const A = await open('');
  const a = await A.page.evaluate(stage);
  line(a.on === true && a.men.every(m => m.hurt === 1 && m.fold === true) && /you [a-z ]*hurt/.test(a.summary) && a.names.every(n => new RegExp(`${n} [a-z ]*hurt`).test(a.summary)) && !A.errors.length,
    'the page opens with the switch on: a teammate, a defender and the player stamped hurt and folded are each dealt the hurt look and the fold, and the panel names all three',
    `CONDITION.on ${a.on} · MOVES.on ${a.moves} · figures ${JSON.stringify(a.men)} · '${a.summary}' · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
  if (OUT) {   // a few real frames (seconds each on the software adapter), then the page as it stands
    await A.page.evaluate(async () => { const dev = window.__engine.device, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < 3; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await tick(); } }).catch(() => { });
    await A.page.screenshot({ path: path.join(OUT, 'condition-hurt.png'), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 120)})`));
  }
  const b = await A.page.evaluate(() => { const { g, step, pl } = window.__cd; const drive = () => { pl.staggerUntil = -1; pl.dazzledUntil = -1; step(2); let sprint = 0; for (let i = 0; i < 60; i++) { step(1, ['KeyW', 'ShiftLeft']); if (pl.sprinting) sprint++; } step(10); return sprint; };
    const at = [...pl.char.pos]; const hurt = drive(); g.teleportPlayer([at[0], 0, at[2]]); const was = pl.hurtAt; pl.hurtAt = -1; const sound = drive(); pl.hurtAt = was; g.teleportPlayer([at[0], 0, at[2]]); return { hurt, sound }; });
  line(b.hurt === 0 && b.sound > 20 && !A.errors.length, 'the hurt player with Shift and W held never sprints; the mark off him, the same keys from the same spot are a sprint',
    `sprint frames of 60: hurt ${b.hurt} · sound ${b.sound} · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
  const c = await A.page.evaluate(() => { const { g, step, mate, foe, pl } = window.__cd;
    const stars = () => [...document.querySelectorAll('.marker')].filter(el => el.style.display !== 'none' && (el.textContent || '').includes('✹')).length;
    const fog = g.fogOfWar, hid = fog.hidden; fog.hidden = () => false; const was = [...foe.char.pos], at = pl.char.pos;
    foe.char.pos[0] = at[0] + 2; foe.char.pos[2] = at[2]; foe.char.vel[0] = foe.char.vel[2] = 0;
    for (const x of g.guards) x.dazzledUntil = -1; mate.state = 'patrol'; mate.dazzledUntil = g.time + 5; step(3); const own = stars();
    foe.state = 'patrol'; foe.dazzledUntil = g.time + 5; step(3); const both = stars();
    fog.hidden = hid; foe.char.pos[0] = was[0]; foe.char.pos[2] = was[2]; mate.dazzledUntil = foe.dazzledUntil = -1; return { own, both, dazzle: window.__knobs.registry().MOVES?.dazzle }; });
  line(c.own === 0 && c.both === 1 && !A.errors.length, 'a stunned teammate carries no \'✹\' on the page; a stunned defender beside Sam does',
    `'✹' marks shown: the teammate stunned ${c.own} · the defender stunned too ${c.both} · MOVES.dazzle ${c.dazzle} · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
  await A.page.close();
  // --- the same page with the switch off
  const B = await open('&nocondition');
  const d = await B.page.evaluate(stage);
  line(d.on === false && d.men.every(m => m.hurt === 0 && m.fold === false) && d.summary === 'condition ▸ off' && !B.errors.length,
    '?nocondition: the switch is off, the same stamps deal no figure anything, and the panel\'s line reads off',
    `CONDITION.on ${d.on} · figures ${JSON.stringify(d.men)} · '${d.summary}' · errors ${JSON.stringify(B.errors.slice(0, 3))}`);
  await browser.close();
  console.log(`=== condition-page: ${failed ? 'FAIL' : 'ALL PASS'} ===`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(`- FAIL — the page check ran\n    ${String(e && e.stack || e).slice(0, 600)}`); process.exit(1); });
