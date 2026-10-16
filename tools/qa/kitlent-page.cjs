// WHAT A MISSION HANDS YOU, ON THE REAL PAGE (src/ui/kitCard.ts `lent`, src/ui/loadout.ts lentNow; tools/qa/kitlent-check.ts asks the same of a headless DOM):
// headless Chromium on the software WebGPU adapter (tools/qa/wand-page.cjs's recipe), a card that carries no wand and no cameras planted in the store.
//   PORT=5237 node tools/qa/kitlent-page.cjs [outDir]        (a dev server on that port: PORT=5237 bun run tools/serve.ts)
//   lent    a quiet mission's Team & kit screen as the page opens it: the cameras tile and the wand tile are marked `lent` and read the mission's word;
//           the store's card was never written
//   nofog   the same screen with the fog choice kept on its bottom rung (the store's twopointsix.quietfog = off): both are empty tiles
//   off     the same screen under ?nokitlent: both tiles read the card alone
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the whole page) are written to outDir when one is given. Software adapter: not a GPU's picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', MISSION = process.env.MISSION || 'bazaar-quiet';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const KIT = JSON.stringify({ v: 2, members: [{ weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, shells: 1, wand: false, cams: 0 }] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q, fog) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript(([k, f]) => { try { if (!sessionStorage.getItem('kitlent.planted')) { localStorage.setItem('twopointsix.kit', k); if (f) localStorage.setItem('twopointsix.quietfog', f); sessionStorage.setItem('kitlent.planted', '1'); } } catch { } }, [KIT, fog || '']);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    await page.waitForTimeout(500);
    return { page, errors };
  };
  const tiles = (page) => page.evaluate(() => { const out = {}; for (const f of ['cams', 'wand']) { const r = document.querySelector(`#loadout .kc[data-member="0"] .kc-row[data-field="${f}"]`);
    out[f] = r ? { lent: r.classList.contains('lent'), idle: r.classList.contains('idle'), val: r.querySelector('.kc-val')?.textContent || '', title: r.title || '', note: r.querySelector('.kc-note')?.textContent || '' } : null; }
    let card = null; try { card = JSON.parse(localStorage.getItem('twopointsix.kit') || 'null')?.members?.[0] ?? null; } catch { }
    return { ...out, card: card && { wand: !!card.wand, cams: card.cams || 0 } }; });
  const say = (t) => ['cams', 'wand'].map(f => `${f} '${t[f]?.val}'${t[f]?.lent ? ' lent' : ''}${t[f]?.idle ? ' idle' : ''}`).join(' · ') + ` · the store's card ${JSON.stringify(t.card)}`;
  const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 80)})`)); };

  // ── lent
  { const { page, errors } = await open(`loadout=${MISSION}`);
    const a = await tiles(page); await shot(page, 'kitlent-lent');
    line(!!a.cams && !!a.wand && a.cams.lent && /mission/.test(a.cams.val) && a.wand.lent && /mission/.test(a.wand.val) && !!a.cams.title && !/none/i.test(a.wand.note) && !a.card?.wand && !a.card?.cams,
      'A QUIET MISSION\'S TEAM & KIT SCREEN, as the page opens it: the cameras tile and the wand tile read the mission\'s word and are marked lent; the card in the store carries neither', `${say(a)} · the wand's line '${a.wand?.note}'`);
    line(errors.length === 0, 'no page error on that screen', errors.join(' | ') || 'none'); await page.close(); }

  // ── nofog
  { const { page, errors } = await open(`loadout=${MISSION}`, 'off');
    const b = await tiles(page);
    line(!!b.cams && !b.cams.lent && !b.wand.lent && !/mission/.test(b.cams.val + b.wand.val) && !b.card?.wand && !b.card?.cams, 'THE FOG KEPT ON ITS BOTTOM RUNG: the same screen shows both as empty tiles, the card untouched', say(b));
    line(errors.length === 0, 'no page error with the fog off', errors.join(' | ') || 'none'); await page.close(); }

  // ── off
  { const { page, errors } = await open(`loadout=${MISSION}&nokitlent`);
    const c = await tiles(page);
    line(!!c.cams && !c.cams.lent && !c.wand.lent && !/mission/.test(c.cams.val + c.wand.val), 'UNDER ?nokitlent the same screen reads the card alone', say(c));
    line(errors.length === 0, 'no page error under ?nokitlent', errors.join(' | ') || 'none'); await page.close(); }

  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 15000))]);   // (the software adapter's browser can hang on its way out: the verdict does not wait for it)
  console.log(failed ? '=== kitlent-page: FAILURES above ===' : '=== kitlent-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
