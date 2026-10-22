// THE GAME'S OWN TEXT SIZE ON THE REAL PAGE (src/ui/textsize.ts): headless Chromium against a dev server, the screens walked at the sizes a play test was
// run at and the ones it broke at.
//   PORT=5199 node tools/qa/textsize-page.cjs [outDir]        (a dev server on that port: PORT=5199 bun run tools/serve.ts)
//   env: GPU=1 adds the pause card and the fight screen (the software WebGPU adapter under the page: one boot, minutes) · WAS=<port> a dev server of the
//        build before, to hold `?textsize=0` to it rectangle for rectangle · TEXTSIZE_BREAK=1 must FAIL (every page loaded with ?textsize=0)
//        SIZES=1600x900,1280x720@2:4 only those windows' screens (width x height, @ device pixels, : step)
// THE SCREENS (no adapter: the boot stops at 'No WebGPU adapter', its panel is hidden, and the title, the Play page and the options are plain DOM that is live
// from the first tick — tools/qa/startpage-look.cjs's recipe), at 3840 × 2160, 2560 × 1440 and 1280 × 720, and at two windows a 3840 × 2160 screen gives
// when the page is zoomed from the browser's menu (2560 × 1440 at 1.5 device pixels, 1920 × 1080 at 2):
//   the factor is the window's; every layer is drawn at it; on the title, every group of the mission select, Team & kit and the options' tabs no text is cut,
//   hangs out of its box or the window, or lies under something else; every @media rule asks for the layer's pixels.
// THE SETTING: the Options row steps it and the choice is kept across a page load; Ctrl / ⌘ with + − 0 step it and are taken from the browser, a bare key is
// not; Ctrl + wheel is taken from the browser; the smallest and largest step still cut no text at the smallest and largest window.
// THE SWITCH OFF (?textsize=0): no factor, no class, the rules as written, the keys the browser's — and with WAS, the same rectangles as the build before.
// GPU=1: the pause card (held to its own cut words at 1280 × 720, where the factor is 1) and the options over it at the three sizes; the kit, meters and objective inside the window; the ring over the same point of the
// picture whatever the size.
// exit 0 = every line PASS with no page error · 1 = otherwise. Layout only: nothing here has been seen on a GPU, and no picture is judged.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, WAS = process.env.WAS || '', GPU = process.env.GPU === '1', BREAK = process.env.TEXTSIZE_BREAK === '1', QUALITY = process.env.QUALITY || 'verylow', SIZES = process.env.SIZES || '', outDir = process.argv[2] || '';
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const report = { checks: [], errors: [] };
const check = (ok, label, detail = '') => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
const Q = (more = '') => `paused&quality=${QUALITY}&mute${BREAK || more === 'off' ? '&textsize=0' : ''}${more && more !== 'off' ? '&' + more : ''}`;
// the factor with nothing chosen is written out again here (the window over 1920 × 1080, 1 to 3); a step's is asked of the page's own table (`__textsize.want`,
// which tools/qa/textsize-check.ts holds to written numbers)
const r2 = x => Math.round(x * 100) / 100, autoFor = (w, h) => r2(Math.max(1, Math.min(3, w / 1920, h / 1080)));
const wantOf = (page, w, h, i) => page.evaluate(([w, h, i]) => window.__textsize.want(w, h, i ?? window.__textsize.table.base), [w, h, i ?? null]);
const tableOf = page => page.evaluate(() => ({ n: window.__textsize.table.steps.length, base: window.__textsize.table.base }));
const scaled = (text, z) => z === 1 ? text : text.replace(/\(\s*((?:min|max)-(?:width|height))\s*:\s*([\d.]+)px\s*\)/g, (_m, f, n) => `(${f}: ${r2(parseFloat(n) * z)}px)`);
const near = (a, b, e = 0.011) => Math.abs(a - b) <= e;

// ── in the page ──
/** every piece of text under `sel` that is cut: scrolled out of a clipping box of its own, outside the window, outside the nearest box that clips, or with
 *  something else drawn over its middle */
const CUT = (sel) => {
  const roots = [...document.querySelectorAll(sel)]; if (!roots.length) return [{ cls: sel, txt: '', why: 'not in the page' }];
  const out = [], shown = e => { const b = e.getBoundingClientRect(), cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.01; };
  const ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 0);
  for (const root of roots) for (const e of root.querySelectorAll('*')) {
    if (!ownText(e) || e.closest('.mstore, .mread, [aria-hidden="true"], iframe, option')) continue;
    let hid = false; for (let p = e; p && p !== document.body; p = p.parentElement) if (!shown(p)) { hid = true; break; } if (hid) continue;
    const scroller = (() => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/auto|scroll/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return p; } return null; })();
    if (scroller) e.scrollIntoView({ block: 'center' });
    const cs = getComputedStyle(e), why = [], t = { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 };
    for (const n of e.childNodes) { if (n.nodeType !== 3 || !n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const b of rg.getClientRects()) { if (!(b.width > 0 && b.height > 0)) continue; t.left = Math.min(t.left, b.left); t.top = Math.min(t.top, b.top); t.right = Math.max(t.right, b.right); t.bottom = Math.max(t.bottom, b.bottom); } }
    if (!(t.right > t.left && t.bottom > t.top)) continue;
    if (/hidden|clip/.test(cs.overflowX) && e.scrollWidth > e.clientWidth + 1) why.push(`its own box, across (${e.scrollWidth} in ${e.clientWidth})`);
    if (/hidden|clip/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) why.push(`its own box, down (${e.scrollHeight} in ${e.clientHeight})`);
    if (t.right > innerWidth + 1 || t.bottom > innerHeight + 1 || t.left < -1 || t.top < -1) why.push(`outside the window (${Math.round(t.left)},${Math.round(t.top)} to ${Math.round(t.right)},${Math.round(t.bottom)})`);
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const ps = getComputedStyle(p), cx = /hidden|clip|auto|scroll/.test(ps.overflowX), cy = /hidden|clip|auto|scroll/.test(ps.overflowY); if (!cx && !cy) continue; const b = p.getBoundingClientRect();
      if (cx && (t.right > b.right + 1.5 || t.left < b.left - 1.5)) why.push(`outside .${String(p.className).split(' ')[0] || p.id}, across`);
      if (cy && (t.bottom > b.bottom + 1.5 || t.top < b.top - 1.5)) why.push(`outside .${String(p.className).split(' ')[0] || p.id}, down`); }
    if (!why.length) { const x = (t.left + t.right) / 2, y = (t.top + t.bottom) / 2, top = document.elementFromPoint(x, y);
      if (top && top !== e && !e.contains(top) && !top.contains(e) && getComputedStyle(e).pointerEvents !== 'none' && getComputedStyle(top).pointerEvents !== 'none') why.push(`under .${String(top.className).split(' ')[0] || top.id || top.tagName}`); }
    if (why.length) out.push({ cls: String(e.className).split(' ')[0] || e.tagName, txt: e.textContent.trim().slice(0, 28), why: why.join(', ') });
  }
  return out;
};
/** the factor as the page has it, and as each layer in the page is really drawn */
const STATE = () => { const T = window.__textsize, root = document.documentElement;
  return { hook: !!T, on: !!T?.on, zoom: T?.zoom ?? null, step: T?.step ?? null, cls: root.classList.contains('tsz'), tz: root.style.getPropertyValue('--tz'), kept: localStorage.getItem('twopointsix.textsize'),
    layers: (T?.layers ?? []).map(s => document.querySelector(s)).filter(e => e && e.getClientRects().length > 0).map(e => [e.id, e.currentCSSZoom ?? 1]), inner: [innerWidth, innerHeight, devicePixelRatio] }; };
/** every @media rule: as written, as it asks now, and whether it holds now (as written = the module's own record; with the switch off, its text) */
const MEDIA = () => { const kept = window.__textsize?.on ? window.__textsize.media() : null; if (kept) return kept.map(([own, now]) => [own, now, matchMedia(now).matches]);
  const out = []; const walk = rules => { for (const r of rules) { if (r instanceof CSSMediaRule) out.push([r.media.mediaText, r.media.mediaText, matchMedia(r.media.mediaText).matches]); if (r.cssRules) walk(r.cssRules); } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { /* */ } } return out; };
/** the rectangles of everything that carries text under `sel` (for the build-before comparison) */
const RECTS = (sel) => [...document.querySelectorAll(sel)].flatMap(root => [...root.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !e.closest('.op-row[data-text]')).map(e => { const b = e.getBoundingClientRect(); return `${String(e.className).split(' ')[0] || e.tagName}:${e.textContent.trim().slice(0, 12)}:${b.left.toFixed(1)},${b.top.toFixed(1)},${b.width.toFixed(1)},${b.height.toFixed(1)}:${getComputedStyle(e).fontSize}`; }));
const says = list => list.length ? list.slice(0, 6).map(c => `${c.cls} '${c.txt}' ${c.why}`).join(' · ') + (list.length > 6 ? ` · and ${list.length - 6} more` : '') : 'none';

function watch(page, name, gpu) {
  page.on('pageerror', e => { if (!gpu && /WebGPU|adapter/i.test(String(e))) return; report.errors.push(`${name}: ${String(e).slice(0, 300)}`); log('PAGE ERROR', String(e).slice(0, 200)); });
  page.on('console', m => { if (m.type() !== 'error') return; const t = m.text(); if (NOISE.test(t) || /Failed to load resource|Failed to fetch/.test(t) || (!gpu && /WebGPU|adapter/i.test(t))) return; report.errors.push(`${name}: ${t.slice(0, 300)}`); log('console error', t.slice(0, 200)); });
}
const still = (page, name) => outDir ? page.screenshot({ path: path.join(outDir, name), timeout: 60000 }).then(() => true, e => { log('no still', name, String(e).split('\n')[0].slice(0, 100)); return false; }) : Promise.resolve(false);

/** one window: boot the page with no adapter and walk the screens */
async function screens(browser, W, H, dpr, opt = {}) {
  const tag = `${W}×${H}${dpr !== 1 ? ` at ${dpr} device pixels` : ''}${opt.step != null ? `, step ${opt.step}` : ''}`, name = `${W}x${H}${dpr !== 1 ? `@${dpr}` : ''}${opt.step != null ? `-s${opt.step}` : ''}`;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
  await ctx.addInitScript(([step]) => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); try { if (step != null && !sessionStorage.getItem('ts-set')) { sessionStorage.setItem('ts-set', '1'); if (step === 1) localStorage.removeItem('twopointsix.textsize'); else localStorage.setItem('twopointsix.textsize', String(step)); } } catch { /* */ } }, [opt.step ?? null]);
  const page = await ctx.newPage(); watch(page, name, false);
  const boot = async () => { await page.goto(`http://localhost:${PORT}/?${Q()}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(600); };
  await boot();
  const want = opt.step == null ? autoFor(W, H) : await wantOf(page, W, H, opt.step), s = await page.evaluate(STATE);
  check(s.on && s.cls && near(s.zoom, want) && near(parseFloat(s.tz), want) && s.layers.some(([id]) => id === 'menu') && s.layers.every(([, z]) => near(z, want)), `${tag}: the factor is the window's (${want}) and every layer on the screen is drawn at it`,
    `page says ${s.zoom} (--tz ${s.tz || 'unset'}, class ${s.cls}) · layers ${s.layers.map(([id, z]) => `${id} ${r2(z)}`).join(' ')}`);
  const cut = {};
  cut.title = await page.evaluate(CUT, '#menu'); await still(page, `title-${name}.png`);
  await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(1500);
  const groups = await page.evaluate(() => [...document.querySelectorAll('#missions .msec')].map(h => h.getAttribute('data-head')));
  cut.missions = []; let cards = 0;
  for (const g of groups) { await page.click(`#missions .msec[data-head="${g}"]`); await page.waitForTimeout(350);
    cards += await page.evaluate(() => [...document.querySelectorAll('#missions .mgrid .mrow')].filter(a => a.getClientRects().length).length);
    for (const c of await page.evaluate(CUT, '#missions')) cut.missions.push({ ...c, cls: `${g} › ${c.cls}` });
    if (g === 'Raids') { await page.evaluate(() => document.querySelector('#missions .mgrid')?.scrollTo(0, 0)); await page.waitForTimeout(150); await still(page, `missions-${name}.png`); } }
  // every card's name and tags inside its own card (a line of cards squeezed shorter than its captions hung them out under the next line's pictures)
  const mediaList = await page.evaluate(MEDIA);
  const hung = await page.evaluate(() => [...document.querySelectorAll('#missions .mgrid .mrow')].filter(a => a.getClientRects().length).flatMap(a => { const b = a.getBoundingClientRect(); return [...a.querySelectorAll('.mtitle, .tag')].filter(e => { const t = e.getBoundingClientRect(); return t.height > 0 && (t.bottom > b.bottom + 1 || t.top < b.top - 1); }).map(e => `${a.dataset.mission} ${e.className.split(' ')[0]}`); }));
  const sheet = await page.evaluate(() => { const t = document.querySelector('#missions .mst'), d = document.querySelector('#missions .mbrief, #missions .mtext, #missions .msub'); const b = t?.getBoundingClientRect(); return { title: t?.textContent ?? '', inWin: !!b && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, px: b ? b.height : 0 }; });
  await page.click('#missions [data-act="kit"], #missions .sp-next').catch(() => {}); await page.waitForTimeout(900);
  const onKit = await page.evaluate(() => document.getElementById('missions')?.classList.contains('pane-loadout') ?? false);
  cut.kit = onKit ? await page.evaluate(CUT, '#missions') : [{ cls: 'page', txt: '', why: 'Team & kit did not open' }]; await still(page, `kit-${name}.png`);
  await boot();
  await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].find(b => /^Options/.test(b.textContent))?.click()); await page.waitForSelector('#options.on', { timeout: 10000 });
  cut.options = [];
  for (const tab of ['graphics', 'controls']) { await page.click(`#options .op-tab[data-tab="${tab}"]`); await page.waitForTimeout(250); for (const c of await page.evaluate(CUT, '#options')) cut.options.push({ ...c, cls: `${tab} › ${c.cls}` }); if (tab === 'graphics') await still(page, `options-${name}.png`); }
  const media = [...mediaList, ...await page.evaluate(MEDIA)], z = (await page.evaluate(STATE)).zoom;
  // (a rule as written asks the LAYER: it is asked of the window at its px × the factor, and holds exactly when the layer's own size passes it as written)
  const holds = t => [...t.matchAll(/\((min|max)-(width|height):\s*([\d.]+)px\)/g)].every(([, mm, wh, n]) => { const v = (wh === 'width' ? W : H) / z; return mm === 'max' ? v <= +n + 0.01 : v >= +n - 0.01; });
  const sized = media.filter(([own]) => /-(width|height):/.test(own)), wrong = sized.filter(([own, now, m]) => now !== scaled(own, z) || (!/,/.test(own) && m !== holds(own)));
  await ctx.close();
  const all = [...cut.title.map(c => ({ ...c, cls: `title › ${c.cls}` })), ...cut.missions, ...cut.kit.map(c => ({ ...c, cls: `Team & kit › ${c.cls}` })), ...cut.options.map(c => ({ ...c, cls: `options › ${c.cls}` }))];
  check(all.length === 0 && hung.length === 0 && sheet.inWin && cards >= 20, `${tag}: no text is cut on the title, the mission select (${groups.length} groups, ${cards} cards), Team & kit or the options, and every card's name and tags are inside its card`,
    `cut: ${says(all)} · hung out of a card: ${hung.slice(0, 6).join(', ') || 'none'} · the sheet's title '${sheet.title}' ${Math.round(sheet.px)} px tall, in the window ${sheet.inWin}`);
  check(sized.length >= 12 && wrong.length === 0, `${tag}: every @media rule in the page asks for the layer's pixels`, `${sized.length} rules, factor ${z}${wrong.length ? ` · wrong: ${wrong.slice(0, 4).map(([own, now]) => `${own} asked as ${now}`).join(' | ')}` : ''}`);
  return { name, cut: all, hung };
}

/** the setting: the keys, the row, the kept choice */
async function setting(browser) {
  const W = 3840, H = 2160, ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); });
    window.__seen = []; addEventListener('keydown', e => window.__seen.push(['key', e.key, e.ctrlKey || e.metaKey, e.defaultPrevented])); addEventListener('wheel', e => window.__seen.push(['wheel', e.deltaY, e.ctrlKey, e.defaultPrevented]), { passive: true }); });
  const page = await ctx.newPage(); watch(page, 'setting', false);
  const boot = async () => { await page.goto(`http://localhost:${PORT}/?${Q()}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(500); };
  await boot(); await page.evaluate(() => localStorage.removeItem('twopointsix.textsize')); await boot();
  const z = async () => (await page.evaluate(STATE)), { n: N, base: BASE } = await tableOf(page), LAST = N - 1, zoomFor = (w, h, i) => i === BASE ? autoFor(w, h) : wantOf(page, w, h, i);
  let at = BASE; const then = d => at = d === 0 ? BASE : Math.max(0, Math.min(LAST, at + d)), E = [then(1), then(1), then(1), then(1), then(-1), then(0)];
  const walk = []; const press = async k => { await page.keyboard.press(k); await page.waitForTimeout(120); const s = await z(); walk.push(`${k} → step ${s.step}, ${s.zoom}`); return s; };
  const a = await z(), up1 = await press('Control+Equal'), up2 = await press('Meta+Equal'), up3 = await press('Control+Shift+Equal'), up4 = await press('Control+Equal'), dn = await press('Control+Minus'), zero = await press('Control+Digit0'), bare = await press('Equal'), bare2 = await press('Minus');
  const seen = await page.evaluate(() => window.__seen.filter(x => x[0] === 'key' && !/^(Control|Meta|Shift)$/.test(x[1])));
  check(a.step === BASE && [up1, up2, up3, up4, dn, zero].every((s, i) => s.step === E[i]) && up4.step === LAST && up3.zoom > up1.zoom && zero.kept === null && bare.step === BASE && bare2.step === BASE && near(up1.zoom, await zoomFor(W, H, E[0])) && near(up3.zoom, await zoomFor(W, H, E[2])) && near(zero.zoom, autoFor(W, H)),
    'Ctrl or ⌘ with + and − step the size (and stop at the last step), with 0 it is the window\'s again and nothing is kept; a bare key steps nothing', walk.join(' · '));
  check(seen.length === 8 && seen.slice(0, 6).every(x => x[2] && x[3]) && seen.slice(6).every(x => !x[2] && !x[3]), 'those six chords are taken from the browser (no page zoom), the two bare keys are not', seen.map(x => `${x[2] ? 'chord ' : ''}${x[1]}:${x[3] ? 'taken' : 'left'}`).join(' '));
  await page.mouse.move(W / 2, H / 2); await page.keyboard.down('Control'); await page.mouse.wheel(0, 120); await page.keyboard.up('Control'); await page.waitForTimeout(150); await page.mouse.wheel(0, 120); await page.waitForTimeout(150);
  const wheel = await page.evaluate(() => window.__seen.filter(x => x[0] === 'wheel')), afterWheel = await z();
  check(wheel.length === 2 && wheel[0][2] && wheel[0][3] && !wheel[1][2] && !wheel[1][3] && afterWheel.step === BASE, 'Ctrl + wheel over a menu is taken from the browser and steps nothing; a plain wheel is left alone', wheel.map(x => `${x[2] ? 'Ctrl + ' : ''}wheel:${x[3] ? 'taken' : 'left'}`).join(' ') + ` · step ${afterWheel.step}`);
  // the row
  await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].find(b => /^Options/.test(b.textContent))?.click()); await page.waitForSelector('#options.on', { timeout: 10000 });
  await page.click('#options .op-tab[data-tab="graphics"]'); await page.waitForTimeout(200);
  const row = () => page.evaluate(() => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label')?.textContent === 'Text size'); if (!r) return null; const bs = [...r.querySelectorAll('.op-opt')];
    return { n: bs.length, on: bs.findIndex(b => b.classList.contains('on')), labels: bs.map(b => b.textContent).join(''), px: bs.map(b => Math.round(b.getBoundingClientRect().height)), font: bs.map(b => parseFloat(getComputedStyle(b).fontSize)), words: r.querySelector('.op-val')?.textContent ?? '' }; });
  const r0 = await row();
  const clickOpt = async i => { await page.evaluate(i => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label')?.textContent === 'Text size'); r?.querySelectorAll('.op-opt')[i]?.click(); }, i); await page.waitForTimeout(150); return [await z(), await row()]; };
  const [s4, r4] = await clickOpt(LAST), [s0, rr0] = await clickOpt(0);
  await page.keyboard.press('Control+Equal'); await page.waitForTimeout(150); const rk = await row(), sk = await z();
  check(!!r0 && r0.n === N && r0.on === BASE && r0.labels === 'A'.repeat(N) && r0.font.every((f, i) => i === 0 || f > r0.font[i - 1]) && r0.words === '' && s4.step === LAST && r4?.on === LAST && s4.kept === String(LAST) && near(s4.zoom, await zoomFor(W, H, LAST)) && s4.zoom > autoFor(W, H) && s0.step === 0 && rr0?.on === 0 && near(s0.zoom, await zoomFor(W, H, 0)) && s0.zoom < autoFor(W, H) && rk?.on === 1 && sk.kept === null,
    'the Options row, live while the page boots: the letter at each size and no words, the step in force lit; a click steps the size and keeps it; the keys move the lit one under an open screen',
    r0 ? `${r0.n} choices '${r0.labels}' at ${r0.font.join(' ')} px, lit ${r0.on} · click the last: step ${s4.step}, ${s4.zoom}, kept '${s4.kept}' · the first: ${s0.zoom} · Ctrl + then: lit ${rk.on}, kept ${sk.kept}` : 'no Text size row');
  await clickOpt(LAST - 1); await boot(); const back = await z();
  check(back.step === LAST - 1 && back.kept === String(LAST - 1) && near(back.zoom, await zoomFor(W, H, LAST - 1)) && back.zoom > autoFor(W, H), 'the choice is kept across a page load', `after the load: step ${back.step}, ${back.zoom} (kept '${back.kept}')`);
  await page.evaluate(() => localStorage.removeItem('twopointsix.textsize')); await ctx.close();
}

/** ?textsize=0: the page as it was */
async function off(browser) {
  const W = 3840, H = 2160, mk = async port => { const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); window.__seen = []; addEventListener('keydown', e => window.__seen.push([e.key, e.defaultPrevented])); try { localStorage.setItem('twopointsix.textsize', '4'); } catch { /* */ } });
    const page = await ctx.newPage(); watch(page, `off:${port}`, false);
    await page.goto(`http://localhost:${port}/?${Q('off')}`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(600);
    const title = await page.evaluate(RECTS, '#menu'), s = await page.evaluate(STATE), t1 = await page.evaluate(() => getComputedStyle(document.querySelector('#menu .t1')).fontSize);
    await page.keyboard.press('Control+Equal'); const keys = await page.evaluate(() => window.__seen.filter(x => x[0] === '='));
    await page.click('#menu .actions button.primary'); await page.waitForSelector('#missions.one.on', { timeout: 20000 }); await page.waitForTimeout(1500);
    await page.click('#missions .msec[data-head="Raids"]'); await page.waitForTimeout(400);
    const list = await page.evaluate(RECTS, '#missions'), media = await page.evaluate(MEDIA); if (port === PORT) await still(page, `missions-${W}x${H}-off.png`);
    await page.goto(`http://localhost:${port}/?${Q('off')}`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#menu .actions button', { timeout: 60000 }); await page.waitForTimeout(400);
    await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].find(b => /^Options/.test(b.textContent))?.click()); await page.waitForSelector('#options.on', { timeout: 10000 });
    await page.click('#options .op-tab[data-tab="controls"]'); await page.waitForTimeout(200); const opts = await page.evaluate(RECTS, '#options');
    await page.click('#options .op-tab[data-tab="graphics"]'); await page.waitForTimeout(200); const hasRow = await page.evaluate(() => [...document.querySelectorAll('#options .op-label')].some(x => x.textContent === 'Text size'));
    await ctx.close(); return { title, list, opts, media, s, t1, keys, hasRow }; };
  const mine = await mk(PORT);
  const asks = mine.media.filter(([, t]) => /-(width|height):\s*[\d.]+px/.test(t)).map(([, t]) => +/([\d.]+)px/.exec(t)[1]);
  check(!mine.s.on && !mine.s.cls && mine.s.tz === '' && mine.s.layers.every(([, z]) => z === 1) && mine.t1 === '100px' && mine.keys.length === 1 && mine.keys[0][1] === false && !mine.hasRow && asks.every(n => Number.isInteger(n) && n <= 1500),
    '?textsize=0 (a step kept on this machine): no factor, no class, every layer at 1, the title at its old 100 px, the rules as written, Ctrl + left to the browser, no row in the options',
    `on ${mine.s.on} · class ${mine.s.cls} · --tz '${mine.s.tz}' · layers ${[...new Set(mine.s.layers.map(([, z]) => z))].join(' ')} · title ${mine.t1} · Ctrl + ${mine.keys.map(k => k[1] ? 'taken' : 'left').join(' ')} · widest rule ${Math.max(...asks)} px · row ${mine.hasRow}`);
  if (WAS) { const was = await mk(WAS); const same = k => mine[k].length === was[k].length && mine[k].every((x, i) => x === was[k][i]), diff = k => { const i = mine[k].findIndex((x, j) => x !== was[k][j]); return i < 0 ? '' : ` (first: ${mine[k][i]} was ${was[k][i]})`; };
    check(same('title') && same('list') && same('opts') && mine.title.length > 5 && mine.list.length > 40 && mine.opts.length > 40, `?textsize=0 at ${W}×${H}: every piece of text on the title, the mission select and the options' Controls is where the build before has it, at the same size`,
      `title ${mine.title.length} of ${was.title.length}${diff('title')} · mission select ${mine.list.length} of ${was.list.length}${diff('list')} · controls ${mine.opts.length} of ${was.opts.length}${diff('opts')}`); }
  else log('(no WAS=<port>: the switch-off page is not held to the build before)');
}

/** GPU=1: the pause card and the fight screen, one boot on the software adapter */
async function fight() {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: GPU_FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }), page = await ctx.newPage(); watch(page, 'fight', true);
  log('booting the solo night on the software adapter (minutes)');
  await page.goto(`http://localhost:${PORT}/?solo&${Q()}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; }).catch(e => String(e));
  if (fatal) { report.errors.push('fight: ' + fatal.slice(0, 300)); await browser.close(); return; }
  log('ready');
  // the game stepped with no frame drawn (the HUD is filled by the step, not by the picture)
  const STEP = n => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { window.__menu?.close?.(); for (let i = 0; i < n; i++) window.__runFrames(1, 1 / 60); } finally { e.render = real; } };
  const HUD = () => { const box = id => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? [b.left, b.top, b.right, b.bottom] : null; };
    const ids = ['equip', 'meters', 'objective', 'lcol'], rects = Object.fromEntries(ids.map(i => [i, box(i)])), out = ids.filter(i => rects[i] && (rects[i][0] < -1 || rects[i][1] < -1 || rects[i][2] > innerWidth + 1 || rects[i][3] > innerHeight + 1));
    const over = (a, b) => a && b && a[0] < b[2] - 1 && b[0] < a[2] - 1 && a[1] < b[3] - 1 && b[1] < a[3] - 1;
    const ret = document.querySelector('#overlay .reticle'), rb = ret?.getBoundingClientRect(), font = parseFloat(getComputedStyle(document.querySelector('#equip .name') ?? document.body).fontSize) * (document.getElementById('equip')?.currentCSSZoom ?? 1);
    return { shown: ids.filter(i => rects[i]), out, clash: over(rects.equip, rects.meters) ? ['equip over meters'] : [], ring: rb && rb.width > 0 ? [(rb.left + rb.right) / 2, (rb.top + rb.bottom) / 2, rb.width] : null, font, mouse: [window.__input.mouseX, window.__input.mouseY] }; };
  // (the card's own cut words at 1280 × 720, where the factor is 1 and the page is the build before: the run tally's long labels end in an ellipsis there)
  let asWas = null; const key = c => `${c.cls} '${c.txt}'`;
  for (const [W, H] of [[1280, 720], [2560, 1440], [3840, 2160]]) {
    await page.setViewportSize({ width: W, height: H });
    // (the resize event waits for a frame, and a frame of this picture on the software adapter can take a minute: after two the check sends the event itself and says so)
    const came = await page.waitForFunction(w => Math.abs(window.__textsize.zoom - w) < 0.011, autoFor(W, H), { timeout: 120000, polling: 500 }).then(() => true, () => false);
    if (!came) await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.mouse.move(Math.round(W * 0.62), Math.round(H * 0.44)); await page.evaluate(STEP, 3);
    if (!await page.evaluate(() => !!document.querySelector('#overlay .reticle')?.getClientRects().length)) { await page.keyboard.press('Digit1'); await page.evaluate(STEP, 40); }   // (the ring is the drawn gun's: 1 draws the pistol on either board — E does not while empty hands are a slot)
    const want = autoFor(W, H), s = await page.evaluate(STATE), h = await page.evaluate(HUD), cutHud = await page.evaluate(CUT, '#equip, #meters, #objective');
    await page.evaluate(() => window.__textsize.set(window.__textsize.table.steps.length - 1)); await page.evaluate(STEP, 2); const big = await page.evaluate(HUD), bigZ = (await page.evaluate(STATE)).zoom;
    await page.evaluate(() => window.__textsize.set(null)); await page.evaluate(STEP, 2);
    const ringMoved = h.ring && big.ring ? Math.hypot(h.ring[0] - big.ring[0], h.ring[1] - big.ring[1]) : NaN;
    check(near(s.zoom, want) && h.shown.includes('equip') && h.shown.includes('meters') && h.out.length === 0 && h.clash.length === 0 && cutHud.length === 0 && near(h.font, 12 * want, 0.3),
      `fight screen ${W}×${H}: the kit, the meters and the objective are drawn at the window's factor (${want}), inside the window, none over another, no text cut`,
      `factor ${s.zoom}${came ? '' : ' (no resize event in two minutes: sent by the check)'} · shown ${h.shown.join(' ')} · out of the window: ${h.out.join(' ') || 'none'} · ${h.clash.join(' ') || 'no clash'} · a kit name ${h.font.toFixed(1)} px on the glass · cut: ${says(cutHud)}`);
    check(h.ring && big.ring && ringMoved <= 1.5 && big.ring[2] > h.ring[2] * 1.05 === bigZ > s.zoom * 1.05, `fight screen ${W}×${H}: the ring is over the same point of the picture at the largest step (${bigZ}) as at none`,
      h.ring && big.ring ? `ring at ${h.ring.slice(0, 2).map(Math.round)} then ${big.ring.slice(0, 2).map(Math.round)} (${ringMoved.toFixed(2)} px apart), ${h.ring[2].toFixed(1)} then ${big.ring[2].toFixed(1)} px wide · cursor ${h.mouse.map(Math.round)}` : `no ring (${JSON.stringify(h.ring)} ${JSON.stringify(big.ring)})`);
    await still(page, `fight-${W}x${H}.png`);
    await page.evaluate(() => { window.__menu.openRun ? window.__menu.openRun() : window.__menu.open('pause'); }); await page.waitForTimeout(300);
    await still(page, `pause-${W}x${H}.png`);
    const cutAll = await page.evaluate(CUT, '#menu'); if (!asWas) asWas = new Set(cutAll.map(key));
    const cutPause = cutAll.filter(c => !asWas.has(key(c)));
    await page.evaluate(() => [...document.querySelectorAll('#menu .actions button')].find(b => /^Options/.test(b.textContent))?.click()); await page.waitForTimeout(300);
    const cutOpt = []; const upOpt = await page.evaluate(() => document.getElementById('options')?.classList.contains('on') ?? false);
    for (const tab of ['graphics', 'audio', 'game', 'controls']) { if (!upOpt) break; await page.evaluate(t => document.querySelector(`#options .op-tab[data-tab="${t}"]`)?.click(), tab); await page.waitForTimeout(200); for (const c of await page.evaluate(CUT, '#options')) cutOpt.push({ ...c, cls: `${tab} › ${c.cls}` }); }
    await page.keyboard.press('Escape'); await page.waitForTimeout(150);
    check(cutPause.length === 0 && upOpt && cutOpt.length === 0, `pause card ${W}×${H}: no text is cut on the card that the build before does not cut at 1280 × 720, and none on any tab of the options over it`, `card: ${says(cutPause)}${asWas.size ? ` (as the build before: ${[...asWas].join(', ')})` : ''} · options: ${upOpt ? says(cutOpt) : 'did not open'}`);
    await page.evaluate(() => window.__menu.close());
  }
  await browser.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  if (SIZES) { for (const t of SIZES.split(',')) { const m = /^(\d+)x(\d+)(?:@([\d.]+))?(?::(\d))?$/.exec(t.trim()); if (m) await screens(browser, +m[1], +m[2], +(m[3] ?? 1), m[4] ? { step: +m[4] } : {}); } }
  else {
    for (const [W, H, dpr] of [[3840, 2160, 1], [2560, 1440, 1], [1280, 720, 1], [2560, 1440, 1.5], [1920, 1080, 2]]) await screens(browser, W, H, dpr);
    for (const [W, H, step] of [[3840, 2160, 4], [1280, 720, 4], [1280, 720, 0]]) await screens(browser, W, H, 1, { step });
    await setting(browser);
    await off(browser);
  }
  await browser.close();
  if (GPU) await fight();
  const bad = report.checks.filter(c => !c.ok).length;
  if (report.errors.length) console.log(`PAGE ERRORS (${report.errors.length}):\n  ${[...new Set(report.errors)].slice(0, 8).join('\n  ')}`);
  if (outDir) fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`=== textsize-page: ${bad || report.errors.length ? `FAIL (${bad} of ${report.checks.length} lines${report.errors.length ? `, ${report.errors.length} page errors` : ''})` : `ALL PASS (${report.checks.length} lines)`}${GPU ? '' : ' · the pause card and the fight screen need GPU=1'} ===`);
  process.exit(bad || report.errors.length ? 1 : 0);
})().catch(e => { console.error('FAILED', e); process.exit(1); });
