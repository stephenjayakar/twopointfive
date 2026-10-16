// THE SHIPPED PROFILE, HELD TO THE PAGE (src/host/profile.ts): boot the real page in headless Chromium on the software WebGPU adapter with no flag but the ones
// automation needs, read every knob table, Game.tune and the sandbox flags off it (window.__knobs), stand the harness up under TPS_PROFILE=shipped on the same
// query, and compare row for row. Zero rows may differ: a difference is a switch the page plays one way and the "as shipped" runs test another.
//   node tools/qa/shipped-page.cjs [name=query ...]      default: plain='' and compound='levelFile=compound.json&roomclear&squad4'
//   env: PORT (the dev server's, default 5199 — `PORT=5199 bun run tools/serve.ts` from this checkout) · OUT (a folder to keep the dumps in)
// The page's profile is this browser's: a fresh one, so nothing a machine has kept (localStorage) is in the comparison — that is the stand the profile means.
// ~3 minutes a page on the software adapter. Exit 0 = every page equals its harness stand, 1 = rows differ (printed) or a page did not boot.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const jobs = process.argv.slice(2).map(a => { const i = a.indexOf('='); return i < 0 ? { name: a, query: '' } : { name: a.slice(0, i), query: a.slice(i + 1) }; });
if (!jobs.length) jobs.push({ name: 'plain', query: '' }, { name: 'compound', query: 'levelFile=compound.json&roomclear&squad4' });
const PORT = process.env.PORT || 5199, OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'shipped-page-'));
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(OUT, { recursive: true });

// in the page — keep `spell` in step with tools/qa/stand-dump.ts
const DUMP = async () => {
  await window.__ready;
  const spell = v => typeof v === 'number' && !Number.isFinite(v) ? `#${v}` : v === undefined ? '#undefined' : typeof v === 'function' ? '#fn' : Array.isArray(v) ? v.map(spell)
    : v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.keys(v).map(k => [k, spell(v[k])])) : v !== null && typeof v === 'object' ? `#${v.constructor && v.constructor.name}` : v;
  const g = window.__game;
  return { url: location.href, tables: spell(window.__knobs.registry()), tune: spell(g.tune), flags: { godMode: g.godMode, aiEnabled: g.aiEnabled, infiniteAmmo: g.infiniteAmmo, quietUtility: g.quietUtility, touring: g.touring } };
};

(async () => {
  let red = 0;
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  for (const job of jobs) {
    const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();   // (a context of its own: an empty store)
    const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
    page.on('response', r => { if (r.status() >= 400) log(`  (${r.status()} ${r.url()})`); });
    const url = `http://localhost:${PORT}/?${job.query ? job.query + '&' : ''}paused&quality=verylow&mute`;
    log(`${job.name}: ${url}`);
    let dump;
    try { await page.goto(url); dump = await page.evaluate(DUMP); }
    catch (e) { console.log(`- FAIL — ${job.name}: the page did not come ready — ${String(e).slice(0, 300)}${errs.length ? ` · ${errs[0]}` : ''}`); red++; await page.close(); continue; }
    await page.close();
    const pageFile = path.join(OUT, `${job.name}.page.json`), standFile = path.join(OUT, `${job.name}.shipped.json`);
    fs.writeFileSync(pageFile, JSON.stringify(dump, null, 1));
    const st = spawnSync('bun', ['run', path.join(__dirname, 'stand-dump.ts'), '--profile', 'shipped', '--query', job.query, '--out', standFile], { encoding: 'utf8' });   // (--profile: the shipped stand whatever this shell exported)
    if (st.status !== 0) { console.log(`- FAIL — ${job.name}: the harness stand failed — ${(st.stderr || '').slice(-300)}`); red++; continue; }
    const df = spawnSync('bun', ['run', path.join(__dirname, 'stand-dump.ts'), '--diff', pageFile, standFile], { encoding: 'utf8' });
    const rows = (df.stdout || '').trim().split('\n').filter(l => l && !/ rows differ$/.test(l));
    if (df.status === 0) console.log(`- PASS — ${job.name}: the page and the harness under TPS_PROFILE=shipped stand on the same switches (${Object.keys(dump.tables).length} tables, Game.tune, the sandbox flags: no row differs)`);
    else { red++; console.log(`- FAIL — ${job.name}: ${rows.length} rows differ (row · the page · the shipped stand)`); for (const r of rows) console.log(`    ${r.replace(/\t/g, ' · ')}`); }
    if (errs.length) console.log(`  (${errs.length} page errors, the first: ${errs[0]})`);
  }
  await browser.close();
  log(`dumps in ${OUT}`);
  process.exit(red ? 1 : 0);
})();
