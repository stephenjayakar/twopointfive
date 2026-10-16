// THE SCORE'S LISTENING PAGE, driven for real: /music in headless Chromium. Every piece is clicked (the page must start it with no error on the console) and then RENDERED
// off line on the game's own master chain at calm, suspicious and firefight, and what comes out is measured: is it there, does it clip, is it as loud as the theme, does a
// handover click. The browser's output is muted: nothing here says what a piece SOUNDS like — that is a listener's call.
//   node tools/qa/music-page.cjs [--table]      env: PORT (the dev server's, default 5199), SECS (seconds rendered per take, default 40)      exit 0 = every check passed, 1 = a FAIL, 2 = the script died
// WHAT IS HELD, per piece and tension (levels from the fourth second on, at the mixer's default volumes):
//   there      no second quieter than −60 dBFS, the take's level between −45 and −12 dBFS RMS
//   no clip    the peak after the master compressor under 0.98, and before it (dry) under 1.4 (what the compressor is asked to hold); no DC offset
//   in step    within 4 dB of the theme at the same tension (a piece must not jump out of, or vanish from, the mix the theme was balanced in)
//   handover   every piece handing over to the next mid-take: sound throughout, no click (no sample-to-sample step over 0.5)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, SECS = +(process.env.SECS || 40);
let fails = 0;
const check = (ok, what, got) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${ok || got === undefined ? '' : `   (got ${JSON.stringify(got)})`}`); if (!ok) fails++; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 1 });
  const errs = []; page.on('pageerror', x => errs.push(String(x && x.stack || x).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${PORT}/music`);
  await page.waitForFunction(() => !!window.__music);
  const names = await page.evaluate(() => window.__music.names.slice());
  check(names.length >= 6 && (await page.locator('.row').count()) === names.length, `a row for every piece of the score (${names.length})`, names);
  // every row clicked: the context starts on the first, each click after cuts to its piece, and notes keep being asked for
  const live = [];
  for (let i = 0; i < names.length; i++) { await page.locator('.row .play').nth(i).click(); await page.waitForTimeout(1500); const s = await page.evaluate(() => window.__music.state()); live.push(s); }
  check(live.every((s, i) => s.running === 'running' && s.piece === names[i] && s.playing === i && (i === 0 || s.notes > live[i - 1].notes)), 'every row, clicked, plays its piece', live.map(s => `${s.piece}:${s.notes}`));
  await page.locator('.row .play').nth(names.length - 1).click(); await page.waitForTimeout(200);
  check((await page.evaluate(() => window.__music.state())).running === 'suspended', 'the playing row, clicked again, stops it');
  await page.locator('.row .mark').first().click();
  check(!(await page.locator('#copy').isHidden()) && (await page.locator('#out').inputValue()) === `${names[0]}: keep`, 'a mark shows the copy button with the mark to paste back');
  // the levels under the pieces (audio/setlist.ts): a row a level with its two pieces; the first's button plays that piece; a pairing changed joins the line to paste back
  { const levels = await page.evaluate(() => window.__music.levels.map(l => ({ key: l.key, title: l.title, names: l.names.slice() })));
    const shown = await page.locator('.lrow').evaluateAll(rs => rs.map(r => [...r.querySelectorAll('select')].map(s => s.value)));
    check(levels.length >= 30 && shown.length === levels.length && levels.every((l, i) => l.names[0] === shown[i][0] && l.names[1] === shown[i][1] && !l.names.includes(names[0])), `a row for every level with the two pieces written for it (${levels.length})`, levels.slice(0, 4).map(l => `${l.title}: ${l.names.join(', ')}`));
    const at = levels.findIndex(l => l.key === 'records'); await page.locator('.lrow').nth(at).locator('.play').first().click(); await page.waitForTimeout(1200);
    const s = await page.evaluate(() => window.__music.state()); check(s.running === 'running' && s.piece === levels[at].names[0], "a level's first button plays the piece that opens it", `${levels[at].title}: ${s.piece}`);
    const other = names.find((n, i) => i > 0 && !levels[at].names.includes(n)); await page.locator('.lrow').nth(at).locator('select').nth(1).selectOption(other); await page.waitForTimeout(600);
    const s2 = await page.evaluate(() => window.__music.state()), out = await page.locator('#out').inputValue();
    check(s2.piece === other && out.endsWith(`records: ${levels[at].names[0]}, ${other}`), 'a pairing changed plays the piece picked and joins the line to paste back', out);
    await page.locator('.lrow').nth(at).locator('.play').nth(1).click(); await page.waitForTimeout(200); }
  if (process.argv[2] && !process.argv[2].startsWith('--')) await page.screenshot({ path: process.argv[2] });

  const T = [0, 0.5, 1], rows = {};
  for (let i = 0; i < names.length; i++) { rows[names[i]] = []; for (const x of T) { const [wet, dry] = await page.evaluate(([i, x, s]) => Promise.all([window.__music.render(i, x, s), window.__music.render(i, x, s, { dry: true })]), [i, x, SECS]); rows[names[i]].push({ ...wet, dry: dry.peak }); } }
  if (process.argv.includes('--table')) for (const n of names) for (const r of rows[n]) console.log(`    ${n.padEnd(13)} x ${String(r.x).padEnd(3)} rms ${String(r.rms).padStart(6)} dB · 1 s ${String(r.quietest).padStart(6)}…${String(r.loudest).padStart(6)} · peak ${r.peak.toFixed(3)} (dry ${r.dry.toFixed(3)}) · centre ${String(r.centroid).padStart(5)} Hz · <120 Hz ${(r.low * 100).toFixed(0).padStart(2)}% · bands ${r.bands.map(b => String(b).padStart(3)).join(' ')} dB · step ${r.jump} · ${r.notes} notes`);
  for (const n of names) {
    const why = [];
    rows[n].forEach((r, k) => {
      if (r.quietest < -60) why.push(`x ${r.x}: a second at ${r.quietest} dB`);
      if (r.rms < -45 || r.rms > -12) why.push(`x ${r.x}: ${r.rms} dB RMS`);
      if (r.peak >= 0.98 || r.hot) why.push(`x ${r.x}: peak ${r.peak}`);
      if (r.dry >= 1.4) why.push(`x ${r.x}: dry peak ${r.dry}`);
      if (Math.abs(r.dc) > 0.003) why.push(`x ${r.x}: DC ${r.dc}`);
      const th = rows[names[0]][k]; if (Math.abs(r.rms - th.rms) > 4) why.push(`x ${r.x}: ${(r.rms - th.rms).toFixed(1)} dB off the theme`);
      if (r.ended !== n) why.push(`x ${r.x}: ended on ${r.ended}`);
    });
    check(!why.length, `${n}: there, unclipped and in step with the theme at calm, suspicious and firefight (${rows[n].map(r => r.rms + ' dB').join(' · ')})`, why);
  }
  const hand = [];
  for (let i = 0; i < names.length; i++) { const to = (i + 1) % names.length, r = await page.evaluate(([i, to]) => window.__music.render(i, 1, 30, { to, at: 8 }), [i, to]); if (r.ended !== names[to] || r.quietest < -60 || r.jump > 0.5 || r.peak >= 0.98) hand.push({ from: names[i], ...r }); }
  check(!hand.length, 'handover: every piece hands over to the next in a firefight with sound throughout and no click', hand);
  check(!errs.length, 'no error on the console', errs.slice(0, 4));
  await browser.close();
  console.log(fails ? `=== music-page: ${fails} FAILED ===` : '=== music-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
