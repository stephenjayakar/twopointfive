// A SNATCH ENDS IN THE VAN, ON THE REAL PAGE (src/game/snatchout.ts): headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe),
// the snatch opened as the list opens it with the four.
//   PORT=5241 node tools/qa/snatchout-page.cjs [outDir]        (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   on     the page opens with the switch on: the level's van is the rule's, the man tied with men of theirs still up is not the end and the objective row
//          says where to take him; his row is the word; led to the van's doors he is in it and the mission is won
//   off    the same page with ?nosnatchout: no van is ruled, no word on him
// exit 0 = both, with no page error · 1 = otherwise. With an outDir, a still of the page at the van once it is won is written there. HALF=on|off runs one
// (a boot on the software adapter is minutes on a loaded machine). The picture itself is a person's to judge: this reads state, not pixels.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', HALF = process.env.HALF || '';
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const URL = extra => `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&levelFile=snatch.json&roomclear&squad4&difficulty=hard${extra}`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== snatchout-page: on the real page the snatch is won with the man in the van; with ?nosnatchout it is the snatch as it was ===');
  const open = async extra => { const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(URL(extra));
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors }; };
  const still = async (page, name) => { if (!OUT) return;   // a few real frames (seconds each on the software adapter), then the page as it stands
    await page.evaluate(async () => { const dev = window.__engine.device, tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < 3; i++) { window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await tick(); } }).catch(() => { });
    await page.screenshot({ path: path.join(OUT, name), timeout: 120000 }).catch(e => console.log(`    (no still: ${String(e).slice(0, 120)})`)); };
  // the man tied where he sits (Sam set down beside him, nobody hurt), the word, then both set down short of the van and left to walk the last steps
  const play = () => {
    const g = window.__game, e = window.__engine, real = e.render, S = g.snatch, X = S.out, out = {};
    const step = (n, until) => { e.render = () => { e.world.upload(); }; try { for (let i = 0; i < n; i += 6) { window.__runFrames(6, 1 / 60, []); if (until && until()) return true; } } finally { e.render = real; } return !!(until && until()); };
    const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    g.godMode = true; step(6);
    out.on = window.__snatch.out.on; out.ruled = X.ruled; out.van = X.van ? [...X.van] : null; out.start = [...g.player.char.pos];
    for (const h of g.guards) if (h.team === 'hostile') h.hold = true;
    const p = S.man.char.pos; g.teleportPlayer([p[0] - 1.6, 0, p[2] + 0.3]);
    if (!step(240, () => S.handsUp || S.tied)) { g.teleportPlayer([p[0] + 1.6, 0, p[2] - 0.3]); step(240, () => S.handsUp || S.tied); }
    out.tied = step(420, () => S.tied); out.endTied = S.end; out.up = g.guards.filter(h => h.team === 'hostile' && h.state !== 'dead').length;
    out.row = (S.objective() || {}).text || null;
    g.teleportPlayer([p[0] - 1.2, 0, p[2] + 0.2]); step(18);
    out.verbs = (g.nearby || []).filter(r => r.guard === S.man && r.verb).map(r => r.verb);
    out.word = X.ruled ? X.word(g.player.char) : false; step(30);
    out.led = !!X.lead;
    if (X.ruled && X.van) { const V = X.van; S.man.char.pos[0] = V[0] + 4.5; S.man.char.pos[2] = V[2] - 0.6; g.teleportPlayer([V[0] + 1.4, 0, V[2] - 0.5]); step(900, () => !!S.end); }
    out.end = S.end; out.why = S.why; out.inAt = X.inAt; out.clear = g.roomClear.end || null;
    return out;
  };
  if (HALF !== 'off') {
    const A = await open('');
    const a = await A.page.evaluate(play);
    line(a.on === true && a.ruled && !!a.van && a.tied && !a.endTied && a.up > 0 && /van/.test(a.row || '') && a.verbs.includes('lead') && a.word && a.led && a.end === 'won' && a.inAt >= 0 && a.clear !== 'taken' && !A.errors.length,
      'the page opens with the switch on: tied with men of theirs up is not the end, the row says where to take him, the word is on him, and led to the van he is in it and it is won',
      `SNATCHOUT.on ${a.on} · van ${JSON.stringify(a.van)} from a start at ${JSON.stringify((a.start || []).map(v => +v.toFixed(1)))} · tied ${a.tied} with ${a.up} of theirs up (end ${a.endTied}) · row "${a.row}" · his rows ${JSON.stringify(a.verbs)} · word ${a.word}, led ${a.led} · end ${a.end} "${a.why}" (the room clear: ${a.clear ?? 'running'}) · errors ${JSON.stringify(A.errors.slice(0, 3))}`);
    await still(A.page, 'snatchout-won.png');
    await A.page.close();
  }
  if (HALF !== 'on') {
    const B = await open('&nosnatchout'); const b = await B.page.evaluate(play);
    line(b.on === false && !b.ruled && b.tied && !b.verbs.includes('lead') && !b.word && b.end !== 'won' && !B.errors.length, 'the same page with ?nosnatchout: no van is ruled and there is no word on him',
      `SNATCHOUT.on ${b.on} · ruled ${b.ruled} · tied ${b.tied} · row "${b.row}" · his rows ${JSON.stringify(b.verbs)} · end ${b.end} · errors ${JSON.stringify(B.errors.slice(0, 3))}`);
    await B.page.close();
  }
  await browser.close();
  console.log(`=== snatchout-page: ${failed ? 'FAIL' : 'ALL PASS'} ===`); process.exit(failed ? 1 : 0);
})();
