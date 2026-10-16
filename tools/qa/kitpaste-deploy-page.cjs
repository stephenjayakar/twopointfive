// A DEPLOY WITH A PASTED KIT, END TO END (ui/kitCard.ts KIT_CLIP, game/kit.ts kitPaste — the maintainer, 10-15: "we should have copy and paste for loadouts").
// The REAL page in headless Chromium on the software adapter (the mission has to boot, so this one wants WebGPU): four cards planted in the store by the big
// slot's own fields, C on Red One and V on Blue Two on Team & kit, then the Deploy button — a page load of the mission's own URL — and the mission is read:
// the four are staged, Blue Two's card in the mission is Red One's (the hammer in his big slot; his colours his own), the squad's count is the cards' sum,
// nothing fatal and no console error. SLOW: about eight minutes on a quiet four-core box (the software adapter compiles the pipelines twice).
//   node tools/qa/kitpaste-deploy-page.cjs      env: PORT (the dev server's, default 5199) · KITPASTE_BREAK=1 (the page opened ?nokitcopy: nothing is pasted, must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL. Nothing here has been seen on a GPU: the staged men are read off the kit table, not looked at.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199;
const BREAK = process.env.KITPASTE_BREAK === '1';
const KEY = 'twopointsix.kit';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|Failed to load resource/;
const CARDS = { v: 2, members: [{ smoke: 1, bangs: 1, frags: 1, shells: 1 }, { bangs: 2, charges: 1, frags: 1, big: 'hammer', suit: 'olive' }, { bangs: 1, charges: 1, frags: 1 }, { charges: 2 }, { suit: 'navy', trim: 'amber' }] };
const T = 900000, J = JSON.stringify;
let fails = 0;
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const carried = m => ({ weapon: m?.weapon, suppressed: m?.suppressed, light: m?.light, nvg: m?.nvg, bangs: m?.bangs, charges: m?.charges, frags: m?.frags, smoke: m?.smoke, big: m?.big, walls: m?.walls });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  // (planted once: the mission's page load must read what the loadout page SAVED, not this plant again)
  await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('planted')) { localStorage.setItem(k, v); sessionStorage.setItem('planted', '1'); } } catch { /* no store */ } }, [KEY, J(CARDS)]);
  const page = await ctx.newPage(); const errors = []; page.setDefaultTimeout(T);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  await page.goto(`http://localhost:${PORT}/?loadout=depot-four&paused&quality=verylow&mute${BREAK ? '&nokitcopy' : ''}`, { waitUntil: 'domcontentloaded', timeout: T });
  await page.waitForSelector('#missions.one.on #loadout .lo-slot.in', { state: 'attached' }); await page.waitForTimeout(1500);
  const press = sel => page.evaluate(s => document.querySelector(s).click(), sel);   // (the element's own click: this adapter paints too slowly for a wait on a still page)
  const stored = () => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').members ?? [], KEY);
  await press('#missions.one #loadout .lo-slot[data-slot="1"]'); await page.waitForTimeout(300); await page.keyboard.press('KeyC'); await page.waitForTimeout(300);
  await press('#missions.one #loadout .lo-slot[data-slot="4"]'); await page.waitForTimeout(300); const s0 = await stored(); await page.keyboard.press('KeyV'); await page.waitForTimeout(800);
  const s = await stored(), picture = await page.evaluate(() => !!document.querySelector('iframe.kv'));   // (the door picture behind the tiles, ui/kitView.ts: said, not asked — it is the kit figure's)
  check(J(carried(s[4])) === J(carried(s[1])) && s[4]?.big === 'hammer' && s[4]?.bangs === 2 && J(carried(s0[4])) !== J(carried(s[4])),
    'Team & kit: C on Red One (olive), V on Blue Two (navy, amber trim) — the store holds Red One\'s kit on him', `Blue Two before ${J(carried(s0[4]))} · after ${J(carried(s[4]))} · the door picture ${picture ? 'was up' : 'was not up'} under the paste`);
  const from = page.url();
  await press('#missions.one #loadout [data-act="deploy"]'); await page.waitForFunction(u => location.href !== u, from);
  check(/roomclear/.test(page.url()) && /squad4/.test(page.url()) && !/loadout=/.test(page.url()), 'Deploy is a page load of the mission\'s own URL', page.url());
  await page.waitForFunction(() => !!window.__ready && !!window.__kit);
  const R = await page.evaluate(async () => { await window.__ready; const K = window.__kit;
    return { fatal: document.getElementById('fatal')?.textContent || '', ops: (K.staged?.ops ?? []).map(g => g.callsign ?? g.name), cards: K.KIT.members, why: K.legal(), words: K.words(), pool: K.pool(4) }; });
  const sum = f => R.cards.slice(1).reduce((n, m) => n + (m[f] || 0), 0);
  check(!R.fatal && R.ops.length === 4 && R.why == null, 'the mission is up: four men staged, the squad a legal one, nothing fatal', `staged ${R.ops.join(', ')} · ${R.why ?? 'legal'} · fatal '${R.fatal}'`);
  check(J(carried(R.cards[4])) === J(carried(R.cards[1])) && R.cards[4]?.big === 'hammer' && /hammer/.test(R.words[4] ?? '') && R.cards[4]?.suit === 'navy' && R.cards[4]?.trim === 'amber' && R.cards[1]?.suit === 'olive',
    'in the mission Blue Two carries Red One\'s kit, the hammer in his big slot, in his own colours', `Red One: ${R.words[1]} · Blue Two: ${R.words[4]} (suit ${R.cards[4]?.suit}, trim ${R.cards[4]?.trim})`);
  check(R.pool.bangs === sum('bangs') && R.pool.charges === sum('charges') && R.pool.frags === sum('frags') && R.pool.bangs === 5,
    'the squad\'s count on the door tools is the four cards\' sum, the pasted one in it', `pool ${J(R.pool)} · cards ${sum('bangs')} stun, ${sum('charges')} charges, ${sum('frags')} frags`);
  check(errors.length === 0, 'no console or page error on either page', errors.join(' | ') || 'none');
  await browser.close();
  console.log(fails ? `\n=== kitpaste-deploy-page: ${fails} FAILED ===` : '\n=== kitpaste-deploy-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
