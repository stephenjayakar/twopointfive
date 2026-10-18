// HOW A RESCUE ENDS, ON THE REAL PAGE (src/game/rescueend.ts RESCUEEND, src/game/rescueflush.ts RESCUEFLUSH): headless Chromium on the software WebGPU
// adapter (tools/qa/page-look.cjs's recipe), the registry's rescue as the page deals it on Hard, Sam alone (squad=0), unseen and unhurt.
//   PORT=5231 node tools/qa/rescueend-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   on    both switches are up in the page's own registry; the room's men put down and the room stood in for 20 s does NOT end the run and the objective
//         asks for the way out or a clear; a hostage in reach offers 'on your feet — with me', the row and one Space get them all up; walked to the way
//         in, the run ends 'rescued' with the hostages out
//   clear the same page: every man of theirs put down ends it 'rescued', building cleared, with nobody led
//   off   ?norescueend&norescueflush: both switches down, no row on a hostage, and the 15 s hold ends the run as it did
// exit 0 = all of it, with no page error · 1 = otherwise. The software adapter draws nothing worth judging: this is the page's code path, not its picture.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const MISSION = 'levelFile=registry.json&rescue&difficulty=hard&pick=registry&seed=7&squad=0';   // (no teammates: with the pair on the floor the men left are shot inside the 20 s and the run is won cleared — which is the rule, and not what the first page asks)
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  const open = async (q) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`);
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    // (the software adapter draws a frame in seconds: the game is STEPPED with the renderer stubbed to the world's upload)
    await page.evaluate(() => {
      const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
      window.__reStep = (n, keys) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } };
      window.__reUp = (l) => l.filter(x => x.state !== 'dead');
      /** the room's own men put down, Sam made unseen and unhurt and stood in the room's middle */
      window.__reTake = () => { const g = window.__game, R = g.rescue, B = R.bounds; g.playerInvisible = true; g.godMode = true;
        for (const c of R.cast()) if (c.inRoom) window.__killGuard(g.guards.indexOf(c.gd));
        g.teleportPlayer([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]); };
      /** Sam stood 1.2 m from a hostage on a side with clear floor to her: her row, or null */
      window.__reRow = (h) => { const g = window.__game, p = h.char.pos; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.teleportPlayer([p[0] + Math.sin(a) * 1.2, 0, p[2] + Math.cos(a) * 1.2]); window.__reStep(2);
        const it = g.interactables.find(x => x.guard === h && x.inReach); if (it) return it; } return null; };
      /** Sam walked (moved a step a frame along the nav path) to a point, the game stepped under him */
      window.__reWalk = (to) => { const g = window.__game, R = g.rescue; let q = [...g.player.char.pos];
        for (const w of g.col.nav.findPath(g.player.char.pos, to, 12000) ?? [to]) { const n = Math.max(1, Math.ceil(flat(q, w) / (2.4 / 60)));
          for (let i = 1; i <= n && !R.result; i++) { g.teleportPlayer([q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n]); window.__reStep(1); } q = [...w]; } };
    });
    return { page, errors };
  };

  { // ── on: not before, the row, out
    const { page, errors } = await open(MISSION);
    const A = await page.evaluate(() => { const g = window.__game, R = g.rescue, K = window.__knobs.registry(); window.__smoke.params.enabled = false; window.__reStep(60); window.__reTake(); window.__reStep(20 * 60);
      return { staged: !!R?.active, end: K.RESCUEEND?.on, flush: K.RESCUEFLUSH?.on, state: R.state, result: R.result?.state ?? null, theirs: window.__reUp(R.hostiles).length, objective: R.objective()?.text ?? '' }; });
    line(A.staged && A.end === true && A.flush === true, 'the registry\'s rescue is staged and both switches are up in the page\'s registry', `staged ${A.staged} · RESCUEEND.on ${A.end} · RESCUEFLUSH.on ${A.flush}`);
    line(A.state === 'secured' && A.result === null && A.theirs > 0 && /bring them out, or clear the building/.test(A.objective), 'the room taken and stood in for 20 s does not end the run; the objective asks for the way out or a clear',
      `state ${A.state} · result ${A.result ?? 'none'} · theirs alive ${A.theirs} · "${A.objective}"`);
    const B = await page.evaluate(() => { const g = window.__game, R = g.rescue, up = window.__reUp(R.hostages), it = window.__reRow(up[0]); const sel = g.selectVerb('guard', 'lead');
      const rows = (it?.verbs ?? g.nearby?.verbs ?? []).map(v => v.text ?? v.verbText ?? '').filter(Boolean); window.__reStep(1, ['Space']); window.__reStep(2);
      return { row: it ? `${it.line1}` : null, rows, sel: !!sel, led: up.filter(h => h.civ.lead === g.player.char).length, n: up.length, objective: R.objective()?.text ?? '' }; });
    line(B.row !== null && B.led === B.n && B.n > 0 && /the way you came in/.test(B.objective), 'a hostage in reach has a row; it and one Space get every living hostage following Sam; the objective points at the way out',
      `row ${B.row ? `"${B.row}"` : 'none'} · led ${B.led} of ${B.n} · "${B.objective}"`);
    const C = await page.evaluate(() => { const g = window.__game, R = g.rescue; window.__reWalk(R.ending.out); for (let i = 0; i < 30 && !R.result; i++) window.__reStep(30);
      return { result: R.result?.state ?? null, why: R.result?.why ?? '', theirs: window.__reUp(R.hostiles).length }; });
    line(C.result === 'rescued' && /out/.test(C.why) && C.theirs > 0, 'walked to the way in with men of theirs still up, the run ends: rescued, the hostages out', `${C.result ?? 'no result'} — "${C.why}" · theirs alive ${C.theirs}`);
    line(errors.length === 0, 'no page error on that page', errors.join(' · ') || 'none'); await page.close(); }

  { // ── clear
    const { page, errors } = await open(MISSION);
    const A = await page.evaluate(() => { const g = window.__game, R = g.rescue; window.__smoke.params.enabled = false; window.__reStep(60); window.__reTake(); window.__reStep(120);
      const before = R.result?.state ?? null; for (const h of R.hostiles) if (h.state !== 'dead') window.__killGuard(g.guards.indexOf(h)); window.__reStep(4 * 60);
      return { before, result: R.result?.state ?? null, why: R.result?.why ?? '', led: R.ending.led }; });
    line(A.before === null && A.result === 'rescued' && /cleared/.test(A.why) && A.led === false, 'every man of theirs put down, nobody led: the run ends rescued, the building cleared', `before ${A.before ?? 'none'} · ${A.result ?? 'no result'} — "${A.why}" · led ${A.led}`);
    line(errors.length === 0, 'no page error on that page', errors.join(' · ') || 'none'); await page.close(); }

  { // ── off
    const { page, errors } = await open(`${MISSION}&norescueend&norescueflush`);
    const A = await page.evaluate(() => { const g = window.__game, R = g.rescue, K = window.__knobs.registry(); window.__smoke.params.enabled = false; window.__reStep(60); window.__reTake(); window.__reStep(5 * 60);
      const row = window.__reRow(window.__reUp(R.hostages)[0]); const B = R.bounds; g.teleportPlayer([(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2]); for (let i = 0; i < 50 && !R.result; i++) window.__reStep(30);
      return { end: K.RESCUEEND?.on, flush: K.RESCUEFLUSH?.on, row: !!row, result: R.result?.state ?? null, why: R.result?.why ?? '', theirs: window.__reUp(R.hostiles).length }; });
    line(A.end === false && A.flush === false && !A.row && A.result === 'rescued' && A.theirs > 0, '?norescueend&norescueflush: both switches down, no row on a hostage, the held room ends the run as it did', `RESCUEEND.on ${A.end} · RESCUEFLUSH.on ${A.flush} · row ${A.row} · ${A.result ?? 'no result'} — "${A.why}" · theirs alive ${A.theirs}`);
    line(errors.length === 0, 'no page error on that page', errors.join(' · ') || 'none'); await page.close(); }

  await browser.close();
  console.log(`\n=== rescueend-page: ${failed ? 'FAILED' : 'ALL PASS'} ===`); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
