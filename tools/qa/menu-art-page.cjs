// THE PLAY PAGE'S PICTURES ON THE REAL PAGE (src/ui/kitFigure.ts, menuStills.ts, planArt.ts): headless Chromium on the software WebGPU adapter
// (tools/qa/page-look.cjs's recipe). startpage-look.cjs runs with no adapter, so the cast never loads there and the 3D man is never drawn: this does.
//   PORT=5199 node tools/qa/menu-art-page.cjs [outDir]      (a dev server on that port: PORT=5199 bun run tools/serve.ts; ~4 min)
//   figure   Team & kit shows the picked man (a canvas with data-fig), inside the window at 1270 x 790 and 1000 x 800; a kit row changes the man
//            (data-word = a word over his posed points and paints: the picture itself moves every frame, he breathes), another man picked
//            changes it, his light settles (data-pass climbs), and the picture moves while the man stays the same
//   cards    the Mission step asks for the key art (assets/menu/*.jpg) and every card of the open group has a picture on it
//   onefile  the same page marked as the one-file build is (meta tps-one-page): nothing under assets/menu is asked for, every card still has a
//            picture (the menu's own drawn plan), and it is not the key art
// exit 0 = all of it, with no page error · 1 = otherwise · 2 = the script died. ONLY=figure|cards|onefile = that part alone. Stills go to outDir when given.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const md5 = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);
if (OUT) fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) bad++; };

(async () => {
  const browser = await chromium.launch({ headless: true, args: FLAGS });
  // a page on the Mission step; `one` = marked as the one-file build before any script of the page runs
  const open = async (W, H, one, extra = '') => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.addInitScript(one => {
      addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); });
      if (!one) return;
      const mark = () => { if (!document.head) return false; const m = document.createElement('meta'); m.name = 'tps-one-page'; m.content = '1'; document.head.appendChild(m); return true; };
      if (!mark()) new MutationObserver((_, o) => { if (mark()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
    }, one);
    const page = await ctx.newPage(), asked = [];
    page.on('pageerror', e => { console.log('  PAGE ERROR', String(e).slice(0, 300)); bad++; });
    page.on('request', r => { if (r.url().includes('/assets/menu/')) asked.push(r.url().split('/').pop()); });
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${extra}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#menu .actions button', { timeout: 240000 }); await page.waitForTimeout(700);
    await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on'); await page.waitForTimeout(3000);
    return { ctx, page, asked };
  };
  const shot = async (page, n) => { if (OUT) await page.screenshot({ path: path.join(OUT, `menu-art-${n}.png`), timeout: 240000 }); };
  // the cards drawn in the open group: [mission id, a hash of its picture, how many different colours are on it]
  const cards = page => page.evaluate(() => [...document.querySelectorAll('#missions .mgrid .mrow:not(.shut)')].map(r => {
    const c = r.querySelector('canvas'); if (!c || !c.width) return [r.getAttribute('data-mission'), '', 0];
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 37) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return [r.getAttribute('data-mission'), c.toDataURL(), seen.size];
  }));

  let art = null;
  if (!ONLY || ONLY === 'cards' || ONLY === 'onefile') {
    console.log('cards · 1270x790');
    const { ctx, page, asked } = await open(1270, 790, false);
    art = await cards(page); await shot(page, 'cards');
    if (!ONLY || ONLY === 'cards') {
      check(asked.includes('stills.json') && asked.some(f => f.endsWith('.jpg')), `the key art is asked for (${asked.length} files under assets/menu)`);
      check(art.length > 0 && art.every(c => c[2] > 40), `every card of the open group has a picture (${art.length} cards, fewest colours ${Math.min(...art.map(c => c[2]))})`);
    }
    await ctx.close();
  }
  if (!ONLY || ONLY === 'onefile') {
    console.log('onefile · 1270x790');
    const { ctx, page, asked } = await open(1270, 790, true);
    const plan = await cards(page); await shot(page, 'onefile');
    check(await page.evaluate(() => !!document.querySelector('meta[name="tps-one-page"]')), 'the page is marked as the one-file build is');
    check(asked.length === 0, `nothing under assets/menu is asked for (${asked.length})`);
    check(plan.length > 0 && plan.every(c => c[2] > 4), `every card still has a picture (${plan.length} cards, fewest colours ${plan.length ? Math.min(...plan.map(c => c[2])) : 0})`);
    check(!!art && plan.length === art.length && plan.every((c, i) => c[0] === art[i][0] && md5(c[1]) !== md5(art[i][1])), 'the same cards, and none of them is the key art (the drawn plan)');
    await ctx.close();
  }
  if (!ONLY || ONLY === 'figure') for (const [W, H] of [[1270, 790], [1000, 800]]) {
    console.log(`figure · ${W}x${H}`);
    const { ctx, page } = await open(W, H, false, '&oldfigure');   // (the STANDING man is this part's question: `?oldfigure` keeps him on a mission whose level stages the team at its door instead — src/ui/kitView.ts)
    const fig = () => page.evaluate(() => { const c = document.querySelector('#missions .onefig canvas'); return c ? { word: c.getAttribute('data-word') || '', pass: +c.getAttribute('data-pass') || 0, px: c.toDataURL() } : { word: '', pass: 0, px: '' }; });
    const hash = () => fig().then(f => f.word);
    // his word once it is no longer `was` (a new man is drawn only after his first pass of light: a fixed sleep reads the old word on a slow adapter), or `was` after `ms`
    const changed = (was, ms) => page.waitForFunction(was => { const c = document.querySelector('#missions .onefig canvas'); return !!c && (c.getAttribute('data-word') || '') !== was; }, was, { timeout: ms }).then(hash, () => was);
    await page.keyboard.press('Enter');
    const there = await page.waitForSelector('#missions .onefig canvas[data-fig]', { timeout: 240000 }).then(() => true, () => false);
    check(there, 'Team & kit draws the picked man');
    if (there) {
      await page.waitForTimeout(500); let h = await hash(); const a = await fig();
      await page.waitForFunction(() => +document.querySelector('#missions .onefig canvas').getAttribute('data-pass') >= 8, null, { timeout: 120000 }).catch(() => {});
      const b = await fig(); await page.waitForTimeout(700); const c = await fig(); await shot(page, `figure-${W}x${H}`);
      check(b.pass >= 8 && b.word === a.word, `his light settles (pass ${a.pass} to ${b.pass})`);
      check(c.word === b.word && md5(c.px) !== md5(b.px), 'he moves at rest: the picture changes, the man does not');
      const fold = await page.evaluate(() => { const c = document.querySelector('#missions .onefig canvas').getBoundingClientRect(); return { top: c.top, bottom: c.bottom, w: c.width, h: c.height, doc: document.documentElement.scrollHeight, win: innerHeight }; });
      check(fold.w > 60 && fold.h > 60 && fold.top >= 0 && fold.bottom <= H + 1 && fold.doc <= fold.win + 1, `he is inside the window (${Math.round(fold.w)} x ${Math.round(fold.h)} at y ${Math.round(fold.top)}, page ${fold.doc} of ${fold.win})`);
      if (W === 1270) {
        const fields = await page.evaluate(() => [...document.querySelectorAll('.kc[data-member="0"] .kc-row')].map(r => r.getAttribute('data-field'))), moved = [];
        for (const f of fields) {
          await page.evaluate(f => { const b = document.querySelector(`.kc[data-member="0"] .kc-row[data-field="${f}"] .kc-step:last-of-type`); if (b) b.click(); }, f);
          const n = await changed(h, 6000); if (n !== h) { moved.push(f); h = n; }
        }
        check(moved.length > 0, `a kit row changes him (${moved.join(', ') || 'none'} of ${fields.join(', ')})`);
        const mate = await page.evaluate(() => { const r = document.querySelector('#loadout .lo-slot[data-slot="1"]'); if (!r) return false; r.click(); return true; });
        const n = await changed(h, 30000); await shot(page, 'figure-mate');
        check(mate && n !== h, 'another man picked is another figure');
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(bad ? `=== menu-art-page: FAIL (${bad}) ===` : '=== menu-art-page: ALL PASS ===');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('DIED', e.message); process.exit(2); });
