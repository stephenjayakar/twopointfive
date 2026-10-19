// THE SQUAD'S KIT DEALT OVER THE MEN WHO COME, ON THE REAL PAGE (src/game/kit.ts KITDEAL; tools/qa/kitdeal-check.ts asks the same of the table and a headless DOM):
// headless Chromium on the software WebGPU adapter (tools/qa/kitlent-page.cjs's recipe), an empty store.
//   PORT=5241 node tools/qa/kitdeal-page.cjs [outDir]        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   four    The pass's Team & kit screen as the page opens it, a team of four as issued: every teammate on the roster has something in his pouches,
//           the squad's line reads 3 stun, 2 charges, 2 frags, As issued is lit and no card is marked changed
//   deploy  Enter on that screen: the mission stages four men and the door tools count the same three, two and two
//   off     the same screen under ?nokitdeal: the Blue men's pouches read 0 / 4
//   more    KITDEAL.more, on that first screen: Red One's line names the breaching shotgun and Blue One's the dynamic hammer, nobody else's a tool, and
//           the staged mission's door tools have the big slot's row; under ?nokitmore no line names one and the squad's line reads the same
// exit 0 = all of it, with no page error · 1 = otherwise. Stills (the whole page) are written to outDir when one is given. Software adapter: not a GPU's picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', MISSION = process.env.MISSION || 'pass-four';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
if (OUT) fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const ready = async (page) => { await page.waitForFunction(() => !!window.__ready, null, { timeout: 900000 }).catch(() => { }); return page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; }); };   // (waits for the page's own script first: on a busy box a navigation commits long before it runs, and `await undefined` read as ready)
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await ready(page); if (fatal) errors.push('fatal: ' + fatal);
    await page.waitForTimeout(500);
    return { page, errors };
  };
  const roster = (page) => page.evaluate(() => { const t = (s) => document.querySelector(s)?.textContent || '';
    const men = [1, 2, 3, 4].map(i => ({ name: t(`#loadout .lo-slot[data-slot="${i}"] .lo-name`), pouch: t(`#loadout .lo-slot[data-slot="${i}"] .lo-pouch`), sum: t(`#loadout .lo-slot[data-slot="${i}"] .lo-sum`), chips: document.querySelectorAll(`#loadout .lo-slot[data-slot="${i}"] .lo-ic`).length, changed: !!document.querySelector(`#loadout .lo-slot[data-slot="${i}"] .lo-name.changed`), here: !!document.querySelector(`#loadout .lo-slot.in[data-slot="${i}"]`) }));
    return { men, pool: t('#loadout .lo-pool'), lit: [...document.querySelectorAll('#loadout .lo-kits .on')].map(b => b.textContent).join(',') }; });
  const say = (r) => r.men.map(m => `${m.name} ${m.pouch}${m.changed ? ' (changed)' : ''}`).join(' · ') + ` · ${r.pool} · lit: ${r.lit}`;
  const shot = async (page, name) => { if (OUT) await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 80)})`)); };

  // ── four, then deploy
  { const { page, errors } = await open(`loadout=${MISSION}`);
    const a = await roster(page); await shot(page, 'kitdeal-four');
    line(a.men.every(m => m.here && /^pouches [1-4] \/ 4$/.test(m.pouch) && m.chips >= 2 && !m.changed) && /3 stun · 2 charges · 2 frags/.test(a.pool) && /as issued/i.test(a.lit),
      'THE PASS\'S TEAM & KIT SCREEN, a team of four as issued, as the page opens it: every teammate has something in his pouches and its drawing on his roster card, the squad carries 3 stun, 2 charges, 2 frags, As issued is lit and nobody is marked changed', say(a));
    const tool = (m) => (/breaching shotgun/.test(m.sum) ? 'shotgun' : /dynamic hammer/.test(m.sum) ? 'hammer' : 'none'), tools = a.men.map(tool).join('/');
    line(tools === 'shotgun/none/hammer/none', 'A TOOL EACH PAIR: on that screen Red One\'s line names the breaching shotgun and Blue One\'s the dynamic hammer, and nobody else\'s a tool (nobody is marked changed for it: the line above)', `big slots by the roster's lines: ${tools} · Red One: ${a.men[0].sum} · Blue One: ${a.men[2].sum}`);
    await Promise.all([page.waitForNavigation({ timeout: 300000, waitUntil: 'commit' }), page.keyboard.press('Enter')]).catch(e => errors.push('deploy: ' + String(e).slice(0, 200)));   // (the mission's own page: `load` can be minutes away on the software adapter, and __ready below is what is waited for)
    const fatal = await Promise.race([ready(page), new Promise(r => setTimeout(() => r('the staged mission was not ready in 15 minutes'), 900000))]).catch(e => 'not ready: ' + String(e).slice(0, 200)); if (fatal) errors.push('fatal: ' + fatal);   // (the software adapter compiles the mission's pipelines slowly)
    const b = await page.evaluate(() => { const g = window.__game, T = g?.doorTools, men = (g?.guards || []).filter(x => x.team === 'operative'); return { url: location.search, state: window.__roomclear?.state ?? null, men: men.length, pool: T ? `${T.bangs} stun ${T.charges} charges ${T.frags} frags` : 'no door tools' }; }).catch(e => ({ url: '', state: null, men: 0, pool: String(e).slice(0, 200) }));
    await shot(page, 'kitdeal-deployed');
    line(b.men === 4 && b.pool === '3 stun 2 charges 2 frags', 'ENTER DEPLOYS: the mission stages the four and the door tools count the same three, two and two', `${b.url} · ${b.men} teammates on the floor · ${b.pool} · the mission's state: ${JSON.stringify(b.state)}`);
    { await page.evaluate(() => window.__runFrames(30)).catch(() => { }); const row = await page.evaluate(() => window.__game?.doorTools?.bigRow === true).catch(() => false);
      line(row, '… and the staged four have the big slot\'s row on a door\'s tools (somebody of the squad carries a tool)', `the door tools' big row: ${row}`); }
    line(errors.length === 0, 'no page error on the screen or the staged mission', errors.join(' | ') || 'none'); await page.close(); }

  // ── off
  { const { page, errors } = await open(`loadout=${MISSION}&nokitdeal`);
    const c = await roster(page);
    line(c.men[2].pouch === 'pouches 0 / 4' && c.men[3].pouch === 'pouches 0 / 4' && /3 stun · 2 charges · 2 frags/.test(c.pool), 'UNDER ?nokitdeal the same screen is the build before: the Blue men\'s pouches read empty, the squad\'s line the same', say(c));
    line(errors.length === 0, 'no page error under ?nokitdeal', errors.join(' | ') || 'none'); await page.close(); }

  // ── the key off
  { const { page, errors } = await open(`loadout=${MISSION}&nokitmore`);
    const c = await roster(page);
    line(c.men.every(m => !/breaching shotgun|dynamic hammer/.test(m.sum) && /^pouches [1-4] \/ 4$/.test(m.pouch) && !m.changed) && /3 stun · 2 charges · 2 frags/.test(c.pool) && /as issued/i.test(c.lit), 'UNDER ?nokitmore the same screen is the deal alone: every man still has his share in his pouches, nobody\'s line names a tool, the squad\'s line and the lit kit the same', `${say(c)} · Red One: ${c.men[0].sum}`);
    line(errors.length === 0, 'no page error under ?nokitmore', errors.join(' | ') || 'none'); await page.close(); }

  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 15000))]);   // (the software adapter's browser can hang on its way out: the verdict does not wait for it)
  console.log(failed ? '=== kitdeal-page: FAILURES above ===' : '=== kitdeal-page: ALL PASS ==='); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
