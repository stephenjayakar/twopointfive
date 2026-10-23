// A MAN WHO HAS DROPPED HIS GUN RUNS FOR IT NO MATTER WHAT, ON THE REAL PAGE (src/game/runner.ts RUNNER.anyway): boot the page in headless Chromium on the
// software WebGPU adapter (tools/qa/page-look.cjs's recipe) on the block's room clear, park every other man blind and deaf out of the way, put one rifleman
// where a recorded game's man stood (32.0, 4.9), hand his picture what that man's held — an enemy believed in the room's only doorway and one believed inside
// the room, neither true — and break him (window.__runner.break):
//   · as the page opens: his rifle AND the pistol off his thigh are on the floor, he runs for the outside by the room's door and the fire exit, and is gone;
//   · under ?runanyway=0: the rifle alone is on the floor and he goes to the corner and stays, as it was.
//   PORT=5231 node tools/qa/runanyway-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)        ONLY=on | off: that page alone
// exit 0 = both hold with no page error · 1 = otherwise.   The renderer is stubbed (rules, not pixels): what this cannot say is how any of it LOOKS.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['on', ''], ['off', 'runanyway=0']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(1500000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad=4&levelFile=block.json${q ? '&' + q : ''}`);
    const r = await page.evaluate(async () => {
      await window.__ready; window.__testVisible = true; window.__smoke.params.enabled = false; window.__engine.render = () => {}; await window.__runFrames(5);
      const g = window.__game, RN = window.__runner, PIC = window.__picture, HIS = [32.0, 0, 4.9], DOOR = [33.3, 0, 12.0], INSIDE = [29.8, 0, 8.3], FAR = [8.6, 0, 13.9];
      g.godMode = true; PIC.knobs.tellSecs = 1e9; PIC.knobs.shot = false;   // (nobody tells him anything but this script: a parked man's blind burst is no word to him)
      const hs = g.guards.filter(x => x.team === 'hostile' && x.state !== 'dead'), A = hs.find(x => x.weapon.def.drop === 'rifle') || hs[0], op = g.guards.find(x => x.team === 'operative');
      for (const o of g.guards) { if (o === A) continue; o.hold = true; o.pinned = true; o.dazzledUntil = 1e9; o.heardUpTo = 1e12; if (o.team === 'hostile') { o.char.pos = [5 + hs.indexOf(o), 0, 30]; o.char.vel = [0, 0, 0]; o.path = []; o.pathGoal = null; } }
      A.char.pos = [...HIS]; A.char.vel = [0, 0, 0]; A.path = []; A.pathGoal = null; A.script = null; A.dazzledUntil = 1e9; A.heardUpTo = 1e12; g.teleportPlayer(FAR); await window.__runFrames(5);
      const iA = g.guards.indexOf(A), id = A.char.id, out = { fatal: '', key: !!RN.knobs.anyway, rifleman: A.weapon.def.drop === 'rifle', broke: false, bold: false, low: false, lowAt: null, goneAt: NaN, here: true, rifles: 0, pistols: 0, stats: null };
      PIC.tell(iA, -1, DOOR); PIC.tell(iA, g.guards.indexOf(op), INSIDE);
      for (const k of Object.keys(RN.stats)) RN.stats[k] = 0;
      out.broke = !!RN.break(iA); const t0 = g.time;
      for (let i = 0; i < 100; i++) {   // 25 s, looked at four times a second
        await window.__runFrames(15); g.player.visibility = 0.02; const R = g.guards.includes(A) ? RN.of(g.guards.indexOf(A)) : null;
        if (R && R.bold) out.bold = true; if (R && R.phase === 'low') { out.low = true; out.lowAt = R.goal ? [R.goal[0], R.goal[2]] : null; }
        if (i === 12) { const mine = k => g.items.items.filter(it => it.kind === k && it.who === id).length; out.rifles = mine('rifle'); out.pistols = mine('pistol'); }   // (three seconds on)
        if (isNaN(out.goneAt) && (!g.guards.includes(A) || (R && R.phase === 'gone'))) { out.goneAt = g.time - t0; break; }
      }
      out.here = g.guards.includes(A); out.stats = { ...RN.stats }; out.fatal = document.getElementById('fatal')?.textContent || ''; return out;
    });
    const want = name === 'on', f = x => Number.isFinite(x) ? x.toFixed(1) : '—';
    const ok = !r.fatal && !errors.length && r.key === want && r.rifleman && r.broke && r.rifles === 1
      && (want ? r.pistols === 1 && r.bold && !r.here && r.goneAt < 25 : r.pistols === 0 && !r.bold && r.low && r.here && isNaN(r.goneAt));
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: key ${r.key ? 'on' : 'off'} · a rifleman (${r.rifleman}) broken (${r.broke}) with an enemy believed in the only doorway and one inside the room: three seconds on, of his on the floor ${r.rifles} rifle and ${r.pistols} pistol · ${r.low ? `low at (${r.lowAt ? r.lowAt.map(v => v.toFixed(1)).join(', ') : '—'})` : 'never low'} · the run past them ${r.bold ? 'taken' : 'not taken'} · ${r.here ? 'still on the floor 25 s on' : `gone ${f(r.goneAt)} s on`} (out ${r.stats && r.stats.out}, corner ${r.stats && r.stats.low})${r.fatal ? ` · FATAL ${r.fatal}` : ''}${errors.length ? ` · ${errors.length} page error(s): ${errors[0]}` : ''}`);
    await Promise.race([page.close(), new Promise(res => setTimeout(res, 5000))]);   // (a page on the software adapter can hang in its close: the lines are already said)
  }
  await Promise.race([browser.close(), new Promise(res => setTimeout(res, 5000))]);
  console.log(failed ? '=== runanyway-page: FAILED ===' : '=== runanyway-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
