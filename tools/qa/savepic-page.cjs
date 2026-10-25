// A SAVE'S PICTURE ON THE REAL PAGE (src/render/savepic.ts; the switch is src/host/savepic.ts SAVEPIC): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe), the office as the page opens it. A save by hand is written, the frame after it drawn, and the picture waited for.
//   PORT=5199 node tools/qa/savepic-page.cjs      (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   on    the page as it opens: the switch reads on and the canvas is one a pass may sample; the picture is NOT there when the frame's own task ends (it
//         was not taken inside it), it is there once the GPU has handed the small target back, it is the size asked for, not flat, and it is the picture
//         the old road takes of the same frame (the mean difference a channel under 10 of 255: two filters and a JPEG apart); a second save, with the
//         camera turned to another view, has its OWN picture (its own frame's, and further from the first frame than from its own) and the first save
//         still reads the first frame's; a card laid with a save's tile still plain shows the picture on that same tile once it arrives; a late picture
//         that comes to nothing (the device refusing the pass, stood in by __save.picLose) puts the page on the old road and that save's picture is the
//         next frame's; no page error
//   off   the same page under ?savepic=0: the switch reads off, the canvas is configured as it always was, and the picture is there when the frame's own
//         task ends — taken the old way, nothing handed to the late road
// exit 0 = both, with no page error · 1 = otherwise. SAVEPIC_BREAK=1 opens the `on` page with the switch off: it must fail.
// What this cannot say: how long either road holds the page's thread on a GPU. The software adapter is not one; the stall the late road is for (the page
// waiting for the GPU to hand a whole frame back) has only been measured on the maintainer's machine, and the late road has never run on a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', BREAK = process.env.SAVEPIC_BREAK === '1';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// in the page: a save by hand, the frame after it drawn, and — in the same task, as the old road does — the canvas drawn into a 2D one of the picture's size
const SAVE = (label) => {
  const r = window.__save.save(label); if (!r || !r.ok) return { err: `save refused: ${r && r.why}` };
  window.__runFrames(1, 1 / 60);
  const cv = document.querySelector('canvas'), S = window.__save, now = S.pictureOf(r.info);
  const W = 256, H = Math.max(9, Math.round(W * cv.height / Math.max(1, cv.width)));
  const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; c2.getContext('2d').drawImage(cv, 0, 0, W, H);
  (window.__pics ??= {})[label] = { info: r.info, old: c2.getContext('2d').getImageData(0, 0, W, H).data };
  return { key: r.info.key, inTask: !!now, W, H, pic: S.pic() };
};
// in the page: wait for the late road to hand everything back, then read the slot's picture against the old road's of the same frame
const READ = async (label) => {
  const S = window.__save, P = window.__pics[label], dev = window.__engine.device;
  for (let i = 0; i < 200 && S.pic().pending > 0; i++) { await dev.queue.onSubmittedWorkDone(); await new Promise(r => setTimeout(r, 20)); }
  const url = S.pictureOf(P.info); if (!url) return { pic: S.pic(), there: false };
  const first = window.__pics.first.old;
  const im = new Image(); await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = url; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const cx = c.getContext('2d'); cx.drawImage(im, 0, 0);
  const d = cx.getImageData(0, 0, im.width, im.height).data, o = P.old; let sum = 0, sq = 0, diff = 0, far = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { const v = d[i + k]; sum += v; sq += v * v; if (o.length === d.length) diff += Math.abs(v - o[i + k]); if (first.length === d.length) far += Math.abs(v - first[i + k]); n++; }
  const mean = sum / n;
  return { pic: S.pic(), there: true, w: im.width, h: im.height, kb: +(url.length / 1024).toFixed(1), mean: +mean.toFixed(1), dev: +Math.sqrt(Math.max(0, sq / n - mean * mean)).toFixed(1), diff: o.length === d.length ? +(diff / n).toFixed(2) : -1, fromFirst: first.length === d.length ? +(far / n).toFixed(2) : -1, url: url.slice(0, 24) };
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errs = []; let ok = true;
  const open = async (extra) => {
    const page = await (await browser.newContext({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 })).newPage(); page.setDefaultTimeout(0);
    page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || /error:|Invalid/.test(m.text())) errs.push(m.text().slice(0, 300)); });
    const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${extra}`; log(url); await page.goto(url);
    const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); const g = window.__game; g.godMode = true; g.playerInvisible = true; g.aiEnabled = false; window.__save.clear(); window.__runFrames(2, 1 / 60); await window.__engine.device.queue.onSubmittedWorkDone();
      for (let i = 0; i < 600 && window.__save.pic().canvasRead && !window.__save.pic().late; i++) await new Promise(r => setTimeout(r, 100));   // (the small pass is built off the boot's books: a save before it is ready takes the old road, by design — the check waits for it)
      return { pipes: window.__boot.pipelines, pic: window.__save.pic() }; });
    log('booted', JSON.stringify(boot)); return { page, boot };
  };
  { // the page as it opens (under the break: with the switch off, which must fail every line that says the late road took it)
    const { page, boot } = await open(BREAK ? '&savepic=0' : '');
    const a = await page.evaluate(SAVE, 'first'); log('a save, the frame after it drawn:', JSON.stringify(a));
    const ra = a.err ? null : await page.evaluate(READ, 'first'); log('its picture:', JSON.stringify(ra));
    await page.evaluate(() => { const p = window.__game.player.char.pos; window.__stage({ look: [p[0], 1, p[2]], yaw: 2.4, pitch: 0.7, dist: 7 }); });   // (another view of the room: the second save's frame is not the first's)
    const b = await page.evaluate(SAVE, 'second'); const rb = b.err ? null : await page.evaluate(READ, 'second'); log('a second save, the camera turned:', JSON.stringify(b), JSON.stringify(rb));
    const again = a.err ? null : await page.evaluate(READ, 'first');
    // a card up when the picture arrives: the save, its frame and the pause card in one task — the tile is laid plain and is the same node when it has its picture
    const card = await page.evaluate(async () => { const S = window.__save, M = window.__menu, dev = window.__engine.device;
      const r = S.save('third'); if (!r || !r.ok) return { err: `save refused: ${r && r.why}` };
      window.__runFrames(1, 1 / 60); M.openRun();
      const all = [...document.querySelectorAll('.saves .tile')], tile = all.find(t => t.dataset.save === `${r.info.key}@${r.info.savedAt}`), plain = !!tile && !tile.style.backgroundImage;
      for (let i = 0; i < 200 && S.pic().pending > 0; i++) { await dev.queue.onSubmittedWorkDone(); await new Promise(r => setTimeout(r, 20)); }
      const got = !!tile && tile.isConnected && tile.style.backgroundImage.length > 100; M.close();
      return { tiles: all.length, found: !!tile, plain, got, pic: S.pic() }; });
    log('a save with the pause card opened in its frame:', JSON.stringify(card));
    // a late picture that comes to nothing: the old road from there, and that save's picture is the next frame's
    const lose = await page.evaluate(async () => { const S = window.__save; S.picLose();
      const r = S.save('fourth'); if (!r || !r.ok) return { err: `save refused: ${r && r.why}` };
      window.__runFrames(1, 1 / 60); const inTask = !!S.pictureOf(r.info); await new Promise(r => setTimeout(r, 50));
      const late = S.pic().late, before = !!S.pictureOf(r.info); window.__runFrames(1, 1 / 60);
      return { inTask, late, before, there: !!S.pictureOf(r.info), pic: S.pic() }; });
    log('a late picture that came to nothing:', JSON.stringify(lose));
    const good = boot.pipes.failed === 0 && boot.pic.late && boot.pic.canvasRead && !a.err && !a.inTask && !!ra && ra.there && ra.w === a.W && ra.h === a.H && ra.dev > 2 && ra.diff >= 0 && ra.diff < 10 && ra.pic.taken === 1 && ra.pic.lost === 0 && ra.pic.pending === 0
      && !b.err && !!rb && rb.there && rb.pic.taken === 2 && rb.pic.lost === 0 && rb.diff >= 0 && rb.diff < 10 && rb.fromFirst > rb.diff + 3 && b.key !== a.key && !!again && again.there && again.diff >= 0 && again.diff < 10
      && !card.err && card.found && card.plain && card.got && !lose.err && !lose.inTask && !lose.late && !lose.before && lose.there;
    log(`on: the late road up ${boot.pic.late} · not taken inside the frame's task ${!a.inTask} · there once the GPU handed it back ${!!ra && ra.there} · ${ra ? `${ra.w}×${ra.h}, spread ${ra.dev}, ${ra.diff} of 255 a channel from the old road's picture of the same frame` : '—'} · two taken, none lost ${!!rb && rb.pic.taken === 2 && rb.pic.lost === 0} · the second save's is its own frame's (${rb ? `${rb.diff} from its own, ${rb.fromFirst} from the first` : '—'}) and the first still reads the first's (${again ? again.diff : '—'}) · a card laid before the picture shows it on the same tile ${!!card.got && !!card.plain} · a late picture lost: the old road from there and the picture the next frame's ${!lose.late && !!lose.there && !lose.before} — ${good ? 'PASS' : 'FAIL'}`);
    ok = ok && good; await page.close();
  }
  if (!BREAK) { // the switch off: the picture as it was taken
    const { page, boot } = await open('&savepic=0');
    const a = await page.evaluate(SAVE, 'first'); const ra = a.err ? null : await page.evaluate(READ, 'first'); log('off, a save:', JSON.stringify(a), JSON.stringify(ra));
    const good = boot.pipes.failed === 0 && !boot.pic.late && !boot.pic.canvasRead && !a.err && a.inTask && !!ra && ra.there && ra.w === a.W && ra.h === a.H && ra.dev > 2 && ra.diff >= 0 && ra.diff < 10 && ra.pic.taken === 0 && ra.pic.pending === 0;
    log(`off: the switch reads off and the canvas is as it was ${!boot.pic.late && !boot.pic.canvasRead} · taken inside the frame's task ${a.inTask} · nothing handed to the late road ${!!ra && ra.pic.taken === 0} — ${good ? 'PASS' : 'FAIL'}`);
    ok = ok && good; await page.close();
  }
  log('errors:', errs.length, JSON.stringify(errs.slice(0, 8)));
  ok = ok && errs.length === 0;
  log(ok ? 'PASS' : 'FAIL'); await browser.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
