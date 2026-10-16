// QUIET LOOK: a quiet mission (game/quiet.ts) on the REAL page in headless Chromium on the software WebGPU adapter (SwiftShader — no GPU needed): what the
// headless probes (tools/qa/quiet-probes.ts) cannot say — that the page's own bundle boots with the mission's module in it, that the query starts it there, that
// the missions list draws its groups. Three page loads, one at a time (two to four minutes each), PASS / FAIL lines, report.json.
//   node tools/qa/quiet-look.cjs <outDir> [level.json]      env: PORT (the dev server's, default 5199 — `PORT=5199 bun run tools/serve.ts` from this checkout) · QUALITY (verylow)
//                                                           ONLY=list,alone,two (default all) · STILLS=1 (a still of each: a paused page on the software adapter may never
//                                                           give one, and a shot that times out can hang the pages after it — off unless asked for)
//   list    the missions list off the start card: a heading per group, the quiet rows under theirs
//   alone   ?levelFile=<level>&quiet=7 — up, alone, Sam on the dealt start, the dealt men on the floor, the objective in the level's words, the camera on him
//   two     …&squad=1 — the same with ONE partner beside him
// (the camera ON the dealt start from the first frame is quiet-probes' line: here it has had ninety frames, and the aim lead is in the number)
// Exit 1 on a FAIL or a page error. The software adapter's smoke-pipeline console noise is passed over as tools/qa/missions-look.cjs does.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || 'quiet-look', LEVEL = process.argv[3] || 'quiet-yard.json';
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/, NOISE_MAX = 80;
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });
const BASE = `http://localhost:${PORT}/`, Q = `paused&quality=${QUALITY}&mute`;
const report = { checks: [], errors: [], noise: 0 };
const check = (ok, label, detail) => { report.checks.push({ ok: !!ok, label, detail }); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
function watch(page, name) { let n = 0;
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error' || /Failed to load resource/.test(x)) return; if (NOISE.test(x) && n < NOISE_MAX) { n++; report.noise++; } else report.errors.push(`${name} console: ${x.slice(0, 400)}`); });
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) report.errors.push(`${name} http ${r.status()}: ${r.url()}`); });
  page.on('pageerror', x => report.errors.push(`${name} pageerror: ${String(x && x.stack || x).slice(0, 600)}`)); }
// (a still is a nicety: on a loaded box the software adapter can take longer than the shot's own patience — said, never a FAIL)
const ONLY = (process.env.ONLY || 'list,alone,two').split(','), STILLS = process.env.STILLS === '1';
const still = async (page, name) => { if (!STILLS) return; try { await page.evaluate(() => window.__runFrames?.(2)); await page.screenshot({ path: path.join(outDir, `${name}.png`), timeout: 90000 }); } catch (e) { log(`${name}: no still (${String(e && e.message || e).split('\n')[0]})`); } };
const ready = page => page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  if (ONLY.includes('list')) { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); watch(page, 'list');
    await page.goto(BASE + '?' + Q + '&cards');
    await page.locator('#menu button', { hasText: 'Missions' }).waitFor({ state: 'attached', timeout: 30000 });
    await page.evaluate(() => [...document.querySelectorAll('#menu button')].find(x => x.textContent === 'Missions').click());
    log('list: waiting for the page (about a minute and a half on the software adapter)');
    const fatal = await ready(page); if (fatal) report.errors.push('list fatal: ' + fatal);
    await page.waitForTimeout(400);
    const s = await page.evaluate(() => { const r = document.getElementById('missions'), out = []; for (const el of r.querySelectorAll('.msec, .mrow')) out.push(el.classList.contains('msec') ? `# ${el.textContent}` : el.dataset.mission); return { on: r.classList.contains('on'), out }; });
    const heads = s.out.filter(x => x.startsWith('# ')), under = h => { const i = s.out.indexOf(h), j = s.out.findIndex((x, k) => k > i && x.startsWith('# ')); return i < 0 ? [] : s.out.slice(i + 1, j < 0 ? undefined : j); };
    check(s.on && heads.length >= 3 && under('# Quiet, alone').includes('solo-night') && under('# Quiet, as two').length >= 1 && under('# Raids').length >= 1, 'the missions list draws a heading per group with its rows under it', s.out.join(' · '));
    await still(page, 'list'); await page.close(); }
  for (const [name, extra, mates] of [['alone', '', 0], ['two', '&squad=1', 1]]) { if (!ONLY.includes(name)) continue;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); watch(page, name);
    await page.goto(BASE + `?levelFile=${LEVEL}&quiet=7${extra}&` + Q);
    log(`${name}: waiting for the page`);
    const fatal = await ready(page); if (fatal) report.errors.push(`${name} fatal: ` + fatal);
    const s = await page.evaluate(async () => { window.__menu?.close?.(); await window.__runFrames(90); const g = window.__game, q = window.__quiet, c = window.__cam, p = g.player.char.pos;
      return { on: q.on, summary: q.summary(), check: q.check(), staff: g.guards.filter(x => !x.unit).length, units: g.guards.filter(x => x.unit).length, patrol: g.quiet.patrol.length, stage: g.mission.stage,
        cam: Math.hypot(c.target[0] - p[0], c.target[2] - p[2]), calm: g.guards.every(x => x.state === 'patrol'), hud: document.getElementById('objective')?.textContent ?? '', msgs: g.messages.slice(-3).map(m => m.text),
        scn: window.__scenarios.current()?.entry?.id ?? null, sam: [p[0], p[2]], start: g.quiet.start_?.sam }; });
    check(s.on && s.staff === s.patrol && s.units === mates && s.stage === 'infiltrate' && s.calm && s.check.length === 0 && s.cam < 6 && !!s.scn && Math.hypot(s.sam[0] - s.start[0], s.sam[1] - s.start[2]) < 0.5 && !/server room|fire exit/i.test(s.msgs.join(' ')),
      `${name}: the query starts the quiet mission on the page — the dealt men on the floor, ${mates ? 'one partner' : 'nobody'} beside Sam, the shift calm, the camera with him, the level's own words`,
      `${s.summary} · staff ${s.staff}/${s.patrol} · units ${s.units} · stage ${s.stage} · camera ${s.cam.toFixed(2)} m off Sam · row ${s.scn} · floor faults ${s.check.length} · said: ${s.msgs.map(m => `'${m}'`).join(' ')}`);
    await still(page, name); await page.close(); }
  await browser.close();
  for (const e of report.errors) console.log(`- FAIL — page error: ${e}`);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 1));
  const bad = report.checks.filter(c => !c.ok).length + report.errors.length;
  console.log(`=== quiet-look: ${bad ? `${bad} FAIL` : 'ALL PASS'} · ${report.checks.length} checks · ${report.noise} adapter noise lines passed over · report in ${outDir} ===`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
