// A DEPLOY OFF THE TREE'S CARD, END TO END (src/game/kittree.ts KITTREE; kit.ts kitPlayer). The REAL page in headless Chromium on the software adapter (the
// mission has to boot, so this one wants WebGPU):
//   · Team & kit on a loud mission: the suppressor off your primary and the light off your card, by their own tiles, then the Deploy button — a page load of
//     the mission's own URL — and the mission is read: your long gun is the same gun with a bare muzzle, your sidearm still wears its own, there is no
//     sponge round in the launcher, and L switches nothing;
//   · a quiet mission as issued: the launcher holds the mission's five sponge rounds.
// SLOW: two mission boots, about eight minutes each on a quiet four-core box.
//   node tools/qa/kittree-deploy-page.cjs      env: PORT (the dev server's, default 5199) · KITTREE_BREAK=1 (the page opened ?nokittree: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL. Nothing here has been seen on a GPU: the player is read off the game, not looked at.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199;
const BREAK = process.env.KITTREE_BREAK === '1';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage|Failed to load resource/;
const T = 900000, J = JSON.stringify;
let fails = 0;
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errors = [];
  /** Team & kit on a mission with nothing kept on the machine, `change` run on it, Deploy pressed, the mission up: what the player carries */
  const deploy = async (mission, change) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); page.setDefaultTimeout(T);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
    await page.goto(`http://localhost:${PORT}/?loadout=${mission}&paused&quality=verylow&mute${BREAK ? '&nokittree' : ''}`, { waitUntil: 'domcontentloaded', timeout: T });
    await page.waitForSelector('#missions.one.on #loadout .lo-kit .kc', { state: 'attached' }); await page.waitForTimeout(1500);
    const press = sel => page.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);   // (the element's own click: this adapter paints too slowly for a wait on a still page)
    const tiles = await change(press, page);
    const from = page.url();
    await press('#missions.one #loadout [data-act="deploy"]'); await page.waitForFunction(u => location.href !== u, from);
    await page.waitForFunction(() => !!window.__ready && !!window.__game);
    const R = await page.evaluate(async () => { await window.__ready; const g = window.__game, pl = g.player, lit = () => !!(pl.rifle.lightOn || pl.pistol.lightOn);
      const before = lit(); window.__input.pressed.add('KeyL'); window.__runFrames(3); const after = lit();
      return { fatal: document.getElementById('fatal')?.textContent || '', url: location.search, long: { id: pl.rifle.def.id, name: pl.rifle.def.name, can: pl.rifle.def.suppressed, voice: pl.rifle.def.report.voice }, side: { id: pl.pistol.def.id, can: pl.pistol.def.suppressed },
        rings: pl.rifle.rings, shells: pl.rifle.shells, load: pl.rifle.attachment, hasRifle: pl.hasRifle, before, after }; });
    await ctx.close(); return { tiles, ...R };
  };
  const val = (page, f) => page.evaluate(x => document.querySelector(`#missions.one #loadout .lo-kit .kc-row[data-field="${x}"] .kc-val`)?.textContent ?? '', f);

  const loud = await deploy('depot-four', async (press, page) => {
    const a = await press('#missions.one #loadout .lo-kit .kc-gun[data-gun="primary"] .kc-row[data-field="suppressed"] .kc-step:last-of-type'); await page.waitForTimeout(300);
    const b = await press('#missions.one #loadout .lo-kit .kc-row[data-field="light"] .kc-step:last-of-type'); await page.waitForTimeout(300);
    return { pressed: a && b, can: await val(page, 'suppressed'), light: await val(page, 'light'), side: await val(page, 'sideCan'), sponge: await val(page, 'rings') }; });
  check(loud.tiles.pressed && /off/i.test(loud.tiles.can) && /none/i.test(loud.tiles.light) && /on/i.test(loud.tiles.side), 'Team & kit: the primary\'s suppressor tile reads off and the light none after a press on each; the sidearm\'s still on', J(loud.tiles));
  check(!loud.fatal && /roomclear/.test(loud.url) && loud.hasRifle && loud.long.can === false && !/suppressed/i.test(loud.long.name) && loud.side.can === true, 'in the mission: your long gun has a bare muzzle, your sidearm wears its own suppressor', `${loud.long.id} '${loud.long.name}' (${loud.long.voice}) + ${loud.side.id}${loud.side.can ? ' suppressed' : ' bare'} · fatal '${loud.fatal}'`);
  check(loud.rings === 0 && loud.load !== 'ring', 'a loud mission as issued: no sponge round in the launcher, the right button on a load you carry', `${loud.rings} sponge, ${loud.shells} × 40 mm, the tube on '${loud.load}'`);
  check(!loud.before && !loud.after, 'no light on your card: L switches nothing', `lit before ${loud.before}, after L ${loud.after}`);

  const quiet = await deploy('vault-quiet', async (_press, page) => ({ sponge: await val(page, 'rings') }));
  check(!quiet.fatal && quiet.rings === 5 && /5/.test(quiet.tiles.sponge) && quiet.long.can === true, 'a quiet mission as issued: the launcher holds the mission\'s five sponge rounds, as the tile said', `tile '${quiet.tiles.sponge}' · ${quiet.rings} in the launcher · ${quiet.url}`);
  check(quiet.after === true, '… and with the light on your card L switches it on', `lit before ${quiet.before}, after L ${quiet.after}`);

  check(errors.length === 0, 'no console or page error on any page', errors.join(' | ') || 'none');
  await browser.close();
  console.log(fails ? `\n=== kittree-deploy-page: ${fails} FAILED ===` : '\n=== kittree-deploy-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
