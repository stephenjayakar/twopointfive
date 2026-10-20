// A STEALTH MISSION'S KIT IS WHAT YOUR CARD STARTS AT THERE, ON THE REAL PAGE (src/game/kit.ts KITDEAL.stealth, src/ui/loadout.ts syncHand;
// tools/qa/kitstealth-check.ts asks the same of the kit table and a headless staging):
//   PORT=5237 node tools/qa/kitstealth-page.cjs [outDir]        (a dev server on that port: PORT=5237 bun run tools/serve.ts)
//   own     a quiet mission's Team & kit screen as the page opens it: your card there carries the mission's sponge rounds, cameras and wand as its own
//           rows, within its pouches, no tile is marked `lent` or reads the mission's word, and the store's card is the loud one, untouched
//   kept    one camera put back by hand: the store keeps a stealth card beside the loud one; the page opened again shows it; a loud mission's screen
//           on the same store shows the loud card
//   off     the same screen under ?nokitstealth: the tiles are the mission's again and the card carries none (the build before)
//   STEALTH_BREAK=1: `own` is opened under ?nokitstealth — MUST FAIL.
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the whole page) are written to outDir when one is given. Software adapter: not a GPU's picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', MISSION = process.env.MISSION || 'bazaar-quiet', LOUD = process.env.LOUD || 'room-clear-pair';
const BREAK = process.env.STEALTH_BREAK === '1' ? '&nokitstealth' : '', ONLY = (process.env.ONLY || '').split(',').filter(Boolean), part = name => !ONLY.length || ONLY.includes(name);   // (ONLY=own,loud,off: the parts to run — `loud` alone does not ask for the kept stealth card)
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const KIT = JSON.stringify({ v: 2, members: [{ weapon: 'rifle', smoke: 1, bangs: 1, frags: 1, shells: 1, wand: false, cams: 0 }] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q, plant) => {
    const page = await ctx.newPage(); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    if (plant) await page.addInitScript(k => { try { if (!localStorage.getItem('kitstealth.planted')) { localStorage.setItem('twopointsix.kit', k); localStorage.setItem('kitstealth.planted', '1'); } } catch { } }, KIT);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    await page.waitForTimeout(500);
    return { page, errors };
  };
  const read = (page) => page.evaluate(() => { const out = { tiles: {} }; for (const f of ['rings', 'cams', 'wand']) { const r = document.querySelector(`#loadout .kc[data-member="0"] .kc-row[data-field="${f}"]`);
      out.tiles[f] = r ? { lent: r.classList.contains('lent'), val: r.querySelector('.kc-val')?.textContent || '' } : null; }
    out.anyLent = !!document.querySelector('#loadout .kc-row.lent, .kc-row.lent'); out.text = (document.querySelector('#loadout') || document.body).textContent || '';
    const m = window.__kit.KIT.members[0], c = window.__kit.cost(0); out.card = { rings: m.rings, cams: m.cams, wand: !!m.wand, smoke: m.smoke, bangs: m.bangs, frags: m.frags, shells: m.shells }; out.cost = `${c.used}/${c.total}`; out.fits = c.used <= c.total;
    let st = null; try { st = JSON.parse(localStorage.getItem('twopointsix.kit') || 'null'); } catch { }
    const brief = k => (k ? { rings: k.rings || 0, cams: k.cams || 0, wand: !!k.wand, frags: k.frags || 0 } : null);
    out.store = { you: brief(st?.members?.[0]), stealth: brief(st?.stealth && typeof st.stealth === 'object' ? st.stealth : null) };
    return out; });
  const J = JSON.stringify, say = t => `card ${J(t.card)} · pouches ${t.cost} · tiles ${['rings', 'cams', 'wand'].map(f => `${f} '${t.tiles[f]?.val}'${t.tiles[f]?.lent ? ' lent' : ''}`).join(' · ')} · store: you ${J(t.store.you)} | stealth ${J(t.store.stealth)}`;
  const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 80)})`)); };
  const noLent = t => ['rings', 'cams', 'wand'].every(f => !t.tiles[f]?.lent) && !t.anyLent && !/mission[’']s/i.test(t.text);   // (the dense card keeps a gun's rows in its pop-up: a tile not on the page is not lent)

  // ── own
  if (part('own')) { const { page, errors } = await open(`loadout=${MISSION}${BREAK}`, true);
    const a = await read(page); await shot(page, 'kitstealth-own');
    line(noLent(a) && a.card.rings === 5 && a.card.cams >= 1 && a.card.wand && !a.card.frags && !a.card.shells && a.fits && a.store.you?.frags === 1 && !a.store.you?.rings && !a.store.you?.wand && !a.store.stealth,
      'A QUIET MISSION\'S TEAM & KIT SCREEN, as the page opens it: your card there carries the mission\'s sponge rounds, cameras and wand as its own rows, within its pouches; no tile is the mission\'s; the store\'s card is the loud one, untouched', say(a));
    // ── kept
    const set = await page.evaluate(() => window.__kit.set(0, 'cams', 1)); const b = await read(page);
    line(set === true && b.card.cams === 1 && b.store.stealth?.cams === 1 && b.store.stealth?.rings === 5 && b.store.you?.frags === 1 && !b.store.you?.cams, 'ONE CAMERA PUT BACK BY HAND: the store keeps a stealth card beside the loud one, which did not move', say(b));
    line(errors.length === 0, 'no page error on that screen', errors.join(' | ') || 'none'); await page.close(); }
  if (part('own')) { const { page, errors } = await open(`loadout=${MISSION}${BREAK}`, false);
    const c = await read(page);
    line(c.card.cams === 1 && c.card.rings === 5 && noLent(c), 'THE PAGE OPENED AGAIN: the stealth card as it was left', say(c));
    line(errors.length === 0, 'no page error opened again', errors.join(' | ') || 'none'); await page.close(); }
  if (part('loud')) { const { page, errors } = await open(`loadout=${LOUD}${BREAK}&oldfigure`, !part('own'));   // (&oldfigure: no second game for the door picture — on the software adapter it is minutes more a page)
    const d = await read(page); await shot(page, 'kitstealth-loud');
    line(d.card.frags === 1 && d.card.smoke === 1 && !d.card.rings && !d.card.cams && !d.card.wand && (!part('own') || d.store.stealth?.cams === 1), 'A LOUD MISSION\'S SCREEN ON THE SAME STORE: the loud card, and the stealth one still kept', say(d));
    line(errors.length === 0, 'no page error on the loud screen', errors.join(' | ') || 'none'); await page.close(); }

  // ── off
  if (part('off')) { await ctx.clearCookies(); const { page, errors } = await open(`loadout=${MISSION}&nokitstealth&kitdense=0`, true);   // (the store's loud card is as it was planted: nothing above wrote it)
    const e = await read(page); await shot(page, 'kitstealth-off');
    line(!!e.tiles.cams?.lent && /mission/i.test(e.tiles.cams.val) && !e.card.rings && !e.card.cams && !e.card.wand && e.card.frags === 1, 'UNDER ?nokitstealth the tiles are the mission\'s again and the card carries none of it (the build before)', say(e));
    line(errors.length === 0, 'no page error under ?nokitstealth', errors.join(' | ') || 'none'); await page.close(); }

  await browser.close();
  console.log(failed ? '=== kitstealth-page: FAILURES above ===' : '=== kitstealth-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
