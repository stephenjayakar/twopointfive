// A TUTORIAL STEP'S CARD AND ARROW on the real page (ui/railcard.ts, game/rails.ts card() / arrow()): what the headless check cannot see.
//   PORT=<port> [CDP=<port>] [OUT=<dir>] [ONLY=arrow] node tools/qa/railcard-page.cjs [level, default tut-sky]
// (ONLY=arrow: the fifth alone, for a page whose cards have been read already — a card is shown once a page.)
// The first step of the level that carries an `explain` is brought up (the lesson's index set, as rails-check does), and then:
//   1. the card is up in the middle with its heading and words, a key in brackets drawn as a key;
//   2. the page's OWN loop, let run under it, does not move the game's clock;
//   3. a game key pressed under it closes nothing; Enter closes it, is not left in the game's keys, and the loop then runs the world again;
//   4. the step's checkpoint put back: the same step is up again and its card is not (read once on this page); the mission started again: the same;
//   5. a `toward` put on the step: the mark is drawn as the arrow, turned; taken off: the ring again.
// Headless Chromium on the software adapter: stepped with __runFrames(n, dt, keys, 'none'), which draws nothing; a picture reads one drawn frame back
// (tut-page.cjs's way). Nothing here is a GPU's picture. exit 0 = all hold · 1 = one does not.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), PORT = process.env.PORT || 5199, OUT = process.env.OUT || '/tmp', name = process.argv[2] || 'tut-sky';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
let bad = 0; const check = (ok, what, how) => { if (!ok) bad++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}\n    ${how}`); };
const run = (page, n) => page.evaluate(n => window.__runFrames(n, 1 / 60, [], 'none'), n);

(async () => {
  const steps = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', `${name}.json`), 'utf8')).scenarios.lesson.steps, k = steps.findIndex(s => !!s.explain);
  if (k < 0) { console.log(`${name}: no step carries a card`); process.exit(1); }
  const held = process.env.CDP;
  const browser = held ? await chromium.connectOverCDP(`http://127.0.0.1:${held}`) : await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = held ? browser.contexts()[0].pages()[0] : await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
  const errors = []; page.on('pageerror', x => errors.push(String(x && x.stack || x).slice(0, 300)));
  if (!held) await page.goto(`http://localhost:${PORT}/?roomclear&squad4&levelFile=${name}.json&paused&quality=verylow&mute&nocutboxes`, { timeout: 600000 });
  await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__runFrames(3, 1 / 60, [], 'none'); });
  const shot = async tag => { const f = path.join(OUT, `railcard-${tag}.png`);
    await page.evaluate(async () => { const dev = window.__engine.device, y = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < 2; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await y(); }
      window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return;
      if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
      for (let i = 3; i < fr.data.length; i += 4) fr.data[i] = 255;
      const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
      const v = document.getElementById('view'), r = v.getBoundingClientRect(); let im = document.getElementById('__still'); if (!im) { im = document.createElement('img'); im.id = '__still'; v.parentNode.insertBefore(im, v); }
      im.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:0;`; im.src = c2.toDataURL('image/png'); await im.decode(); v.style.visibility = 'hidden'; });
    try { await page.screenshot({ path: f, timeout: 60000 }); } catch (e) { return `(no picture: ${String(e).slice(0, 60)})`; }
    finally { await page.evaluate(() => { document.getElementById('view').style.visibility = ''; document.getElementById('__still')?.remove(); }); }
    return f; };
  const card = () => page.evaluate(() => { const e = document.getElementById('railcard'), g = window.__game; return { on: !!e && e.classList.contains('on'), h: e?.querySelector('h2')?.textContent || '', p: [...(e?.querySelectorAll('p') ?? [])].map(x => x.textContent).join(' / '), caps: e?.querySelectorAll('p kbd').length ?? 0, said: !!g.rails.card(), i: g.lesson.i, t: g.time, enter: window.__input.pressed.has('Enter') || window.__input.keys.has('Enter') }; });
  const live = n => page.evaluate(async n => { const g = window.__game, t0 = g.time; window.__pauseLoop = false; await new Promise(res => { let c = 0; const f = () => { if (++c > n) res(); else requestAnimationFrame(f); }; requestAnimationFrame(f); }); window.__pauseLoop = true; return +(g.time - t0).toFixed(4); }, n);
  const bring = () => page.evaluate(k => { window.__game.lesson.i = k; window.__runFrames(6, 1 / 60, [], 'none'); }, k);

  const ARROW = process.env.ONLY === 'arrow';
  await bring();
  if (!ARROW) {
  // 1. up, with its words
  const C = await card();
  check(C.on && C.said && C.i === k && !!C.p && (!steps[k].explain.title || C.h.toLowerCase() === steps[k].explain.title.toLowerCase()), `step ${k + 1} '${steps[k].id}' comes up on its card: a heading and its words in the middle`, `"${C.h}": ${C.p} · key caps in it ${C.caps}`);
  log('picture', await shot('card'));
  // 2. the page's own loop holds the world under it
  const under = await live(3);
  check(under === 0, 'the page\'s own loop, let run for three frames under the card, does not move the game\'s clock', `moved ${under} s`);
  // 3. a game key closes nothing; Enter closes it and is no game key; the world runs again
  await page.waitForTimeout(450); await page.keyboard.press('KeyW'); const W = await card(); await page.keyboard.press('Enter'); const D = await card(), after = await live(3);
  check(W.on && !D.on && !D.enter && after > 0, 'a game key under the card closes nothing; Enter closes it and is not left among the game\'s keys; the loop then runs the world again', `after W: card ${W.on ? 'up' : 'gone'} · after Enter: card ${D.on ? 'up' : 'gone'}, Enter in the game's keys ${D.enter} · three frames after moved the clock ${after} s`);
  // 4. read once on this page: the checkpoint put back, the mission started again
  const back = await page.evaluate(k => { const g = window.__game, ck = g.saves.newest(true, g.mission.stats.elapsed), why = ck ? g.saves.loadInStep(g, ck.key) : 'no checkpoint on the shelf'; window.__runFrames(8, 1 / 60, [], 'none'); return { why: why ?? 'ok', label: ck?.label ?? '' }; }, k);
  const B = await card(); await page.evaluate(() => { window.__game.restartEncounter(); window.__runFrames(6, 1 / 60, [], 'none'); }); await bring(); const A = await card();
  check(B.i === k && B.said && !B.on && A.i === k && A.said && !A.on, 'a card read is not shown again on this page: not with its step\'s checkpoint put back, not with the mission started again', `put back (${back.why}${back.label ? `, '${back.label}'` : ''}): step ${B.i + 1}, the step says a card ${B.said}, drawn ${B.on} · the mission again: step ${A.i + 1}, says ${A.said}, drawn ${A.on}`);
  }
  // 5. the arrow (the view first rides to the mark: at the picture's edge the mark is the ring that says 'that way')
  await run(page, 300);
  const mark = () => page.evaluate(() => { const m = document.querySelector('.objmark'); return { cls: m?.className ?? '', turn: m?.style.getPropertyValue('--turn') ?? '', shown: !!m && m.style.display !== 'none' }; });
  const M0 = await mark(); await page.evaluate(k => { const T = window.__game.level.scenarios.lesson.steps[k]; T.toward = [T.at[0] + 3, T.at[1], T.at[2] + 3]; window.__runFrames(3, 1 / 60, [], 'none'); }, k); const M1 = await mark();
  log('picture', await shot('arrow'));
  await page.evaluate(k => { delete window.__game.level.scenarios.lesson.steps[k].toward; window.__runFrames(3, 1 / 60, [], 'none'); }, k); const M2 = await mark();
  check(M0.shown && !/arrow/.test(M0.cls) && /arrow/.test(M1.cls) && /deg$/.test(M1.turn) && !/arrow/.test(M2.cls), 'a step\'s `toward` draws its mark as an arrow turned toward the place, and without it the ring', `without: "${M0.cls}" · with: "${M1.cls}" turned ${M1.turn} · taken off: "${M2.cls}"`);
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(bad ? `=== railcard-page: ${bad} FAILED ===` : '=== railcard-page: ALL PASS ===');
  if (!held) await browser.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
