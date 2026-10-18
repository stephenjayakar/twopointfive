// WHAT A CARD WEIGHS, ON THE REAL PAGE (src/ui/kitCard.ts, the two bars; src/game/kitload.ts; tools/qa/kitload-check.ts asks the same of a headless DOM):
// headless Chromium on the software WebGPU adapter (tools/qa/wand-page.cjs's recipe), at 1280 × 720, the issued card planted in the store.
//   PORT=5237 node tools/qa/kitload-page.cjs [outDir]        (a dev server on that port: PORT=5237 bun run tools/serve.ts)
//   bars    a room clear's Team & kit screen as the page opens it (the one card it shows: yours): two bars, each inside the card, wide enough to read, with
//           no digit; your issued card's two fills end on their notch
//   step    your guns row stepped to the pistol alone: both fills grow past the notch
//   off     the same screen under ?nokitload: no bar is shown
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the whole page) are written to outDir when one is given. Software adapter: not a GPU's picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', MISSION = process.env.MISSION || 'room-clear-four';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const KIT = JSON.stringify({ v: 2, members: [{ weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, shells: 1, wand: false, cams: 0 }] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript((k) => { try { if (!sessionStorage.getItem('kitload.planted')) { localStorage.setItem('twopointsix.kit', k); sessionStorage.setItem('kitload.planted', '1'); } } catch { } }, KIT);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    await page.waitForTimeout(500);
    return { page, errors };
  };
  /** every card on the screen: its member, its box, and its bars — each bar's box, its track's, where the fill ends and the notch stands (px), its words */
  const cards = (page) => page.evaluate(() => [...document.querySelectorAll('#loadout .kc')].map(c => {
    const box = e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, shown = e => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
    return { member: c.getAttribute('data-member'), box: box(c), bars: [...c.querySelectorAll('.kc-bar')].filter(shown).map(b => {
      const t = b.querySelector('.kc-bar-t'), fill = t.querySelector('.fill'), gain = t.querySelector('.gain'), ref = t.querySelector('.ref'), loss = gain.classList.contains('loss');
      return { k: b.getAttribute('data-load'), score: +b.getAttribute('data-score'), box: box(b), track: box(t), fill: box(fill).w + (loss ? 0 : box(gain).w), gain: box(gain).w, loss, notch: box(ref).x + box(ref).w / 2 - box(t).x, text: b.textContent || '' }; }) }; }));
  const inside = (a, b) => a.x >= b.x - 1 && a.y >= b.y - 1 && a.x + a.w <= b.x + b.w + 1 && a.y + a.h <= b.y + b.h + 1;
  const say = (cs) => cs.map(c => `${c.member}: ${c.bars.map(b => `${b.k} ${b.fill.toFixed(0)}/${b.track.w.toFixed(0)} px, notch ${b.notch.toFixed(0)}`).join(', ') || 'no bar'}`).join(' · ');
  const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 80)})`)); };

  // ── bars
  { const { page, errors } = await open(`loadout=${MISSION}`);
    const a = await cards(page); await shot(page, 'kitload-bars'); const you = a.find(c => c.member === '0');
    line(a.length >= 1 && !!you && a.every(c => c.bars.length === 2 && c.bars[0].k === 'mob' && c.bars[1].k === 'con' && c.bars.every(b => inside(b.box, c.box) && b.track.w >= 40 && b.track.h >= 3 && !/[0-9]/.test(b.text))),
      'A ROOM CLEAR\'S TEAM & KIT SCREEN, as the page opens it: the card shows two bars, mobility then concealment, inside the card, a track wide enough to read, no digit', `${a.length} card(s) · ${say(a)}`);
    line(!!you && you.bars.every(b => Math.abs(b.fill - b.notch) <= 2 && b.fill > 4 && b.fill < b.track.w - 4), 'your issued card: each fill ends on its notch — the card the game is tuned on', you ? say([you]) : 'no card of yours');

    // ── step: the guns row's next (rifle → pistol)
    await page.evaluate(() => { const steps = document.querySelectorAll('#loadout .kc[data-member="0"] .kc-row[data-field="weapon"] .kc-step'); steps[steps.length - 1]?.click(); });
    await page.waitForTimeout(300); const b = await cards(page); await shot(page, 'kitload-step'); const now = b.find(c => c.member === '0');
    line(!!now && !!you && now.bars.length === 2 && now.bars.every((x, k) => x.fill > you.bars[k].fill + 4 && x.fill > x.notch + 4 && x.gain > 4 && !x.loss), 'YOUR GUNS ROW STEPPED to the pistol alone: both fills grow past the notch', now && you ? `${say([you])} → ${say([now])}` : 'no card of yours');
    line(errors.length === 0, 'no page error on that screen', errors.join(' | ') || 'none'); await page.close(); }

  // ── off
  { const { page, errors } = await open(`loadout=${MISSION}&nokitload`);
    const c = await cards(page);
    line(c.length >= 1 && c.every(x => x.bars.length === 0), 'UNDER ?nokitload the same screen shows no bar', say(c));
    line(errors.length === 0, 'no page error under ?nokitload', errors.join(' | ') || 'none'); await page.close(); }

  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 15000))]);   // (the software adapter's browser can hang on its way out: the verdict does not wait for it)
  console.log(failed ? '=== kitload-page: FAILURES above ===' : '=== kitload-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
