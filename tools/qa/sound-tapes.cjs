// The replays that cover the game's sounds: recorded ON THE REAL PAGE by a scripted player (tools/qa/tapes/page-bot.ts — the Training lessons' own
// scripts, input only, plus two scripts for what no lesson reaches), saved where the page serves them (public/assets/replays/), and played back in the
// engine player to see that each still plays as recorded.
//
//   PORT=<dev server> node tools/qa/sound-tapes.cjs [name …]            record (all, or the named ones) and write the files + index.json
//   PORT=<dev server> node tools/qa/sound-tapes.cjs --check [name …]    play each kept file back on a fresh page: red if one parts from its recording
//   PORT=<dev server> node tools/qa/sound-tapes.cjs --dry name …        run the scripts and say what they did and played; nothing is written
//   (LINES=1 in front of a recording prints everything its script said)
//   node tools/qa/sound-tapes.cjs --cover                               which of the mixer's sounds each replay plays, and which none reaches (no page)
//
// RE-RECORD AFTER A CHANGE TO PLAY: a replay is the run's input, so a build that plays differently parts from it (the player says from when). Headless
// Chromium on the software adapter; nothing is drawn while a script runs. Exit 0 / 1, 2 = the tool died.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..'), DIR = path.join(ROOT, 'public/assets/replays'), INDEX = path.join(DIR, 'index.json');
const PORT = process.env.PORT || '5173', QUALITY = process.env.QUALITY || 'verylow';
const args = process.argv.slice(2), CHECK = args.includes('--check'), COVER = args.includes('--cover'), DRY = args.includes('--dry'), names = args.filter(a => !a.startsWith('--'));
const SEEDS = (process.env.SEEDS || '1,2,3').split(',').map(Number);
const TITLES = { 'train-move': 'Moving unseen', 'train-hands': 'Hands', 'train-lights': 'Lights, locks and devices', 'train-kit': 'Guns and the kit', 'train-orders': 'Orders and door tools', 'train-pairs': 'Two pairs, two doors', 'train-silent': 'Quiet, as two' };

/** a sound the mixer plays INSIDE another's own call (audio.ts hiss: the pop that starts a smoke can's hiss), which a page with no sound running (these are muted) never gets as far as asking for: it is filed with the sound that carries it */
const WITH = { smokeHiss: ['smokePop'] };
const readIndex = () => fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : { tapes: [] };
/** every name of the mixer's table (src/audio/sfx.ts SfxName) */
const sfxNames = () => { const s = fs.readFileSync(path.join(ROOT, 'src/audio/sfx.ts'), 'utf8'), a = s.indexOf('export type SfxName'), b = s.indexOf('\n\n', a);
  return [...s.slice(a, b).replace(/\/\/.*$/gm, '').matchAll(/'([A-Za-z0-9]+)'/g)].map(m => m[1]); };
function cover() {
  const X = readIndex(), all = sfxNames(), by = new Map(all.map(n => [n, []]));
  for (const T of X.tapes) for (const n of Object.keys(T.sounds)) (by.get(n) ?? by.set(n, []).get(n)).push(T.id);
  for (const T of X.tapes) console.log(`${T.id.padEnd(14)} ${String(Math.round(T.seconds)).padStart(4)} s  ${Object.keys(T.sounds).length} sounds: ${Object.keys(T.sounds).join(' ')}`);
  const none = all.filter(n => !by.get(n).length), odd = [...by.keys()].filter(n => !all.includes(n));
  console.log(`\n${all.length - none.length} of ${all.length} sounds are played by a replay.`);
  if (none.length) console.log(`in no replay: ${none.map(n => `${n}${X.why?.[n] ? ` (${X.why[n]})` : ''}`).join(' · ')}`);
  if (odd.length) console.log(`also asked for, made on the spot and not a row of the table: ${odd.join(' ')}`);
  return { all, none };
}
if (COVER) { cover(); process.exit(0); }

(async () => {
  const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node-tools/node_modules/playwright'); } })();
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tapes-')), botFile = path.join(tmp, 'bot.js');
  cp.execFileSync('bun', ['build', path.join(__dirname, 'tapes/page-bot.ts'), '--target', 'browser', '--format', 'iife', '--outfile', botFile], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
  const bot = fs.readFileSync(botFile, 'utf8');
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  let bad = 0;
  const open = async (query) => {
    const page = await ctx.newPage(), errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?${query}`, { timeout: 240000 });   // (the dev server bundles the tree at each load: slow beside other takes)
    await page.waitForFunction(() => !!window.__ready && !!window.__game && !!window.__audio, null, { timeout: 600000 });
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    return { page, errors };
  };
  try {
    const blank = await ctx.newPage(); await blank.goto('about:blank'); await blank.addScriptTag({ content: bot });
    const pages = await blank.evaluate(() => ({ names: window.__tapeBot.names, pages: window.__tapeBot.pages })); await blank.close();
    const todo = names.length ? names : pages.names;
    for (const n of todo) if (!pages.pages[n]) { console.log(`no script '${n}' (there are: ${pages.names.join(' ')})`); await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(2); }
    fs.mkdirSync(DIR, { recursive: true });
    const X = readIndex();

    // (a lesson's teammates can be shot: a seed whose run does not get to the script's end is tried again on the next, three at most)
    if (!CHECK) for (const name of todo) for (const seed of SEEDS) {
      const t0 = Date.now(), { page, errors } = await open(`paused&quality=${QUALITY}&mute&seed=${seed}&${pages.pages[name].query}`);
      await page.addScriptTag({ content: bot });
      const R = await page.evaluate((nm) => {
        const e = window.__engine; e.render = () => { e.world.upload(); }; window.__smoke.params.enabled = false;   // (nothing drawn, but the world packed as a draw packs it: the cursor's ray reads that list)
        window.__cam.rebuild?.();
        const r = window.__tapeBot.run(nm);
        const F = window.__replay.file('sounds');
        return { r, file: F ? JSON.stringify(F) : null, ticks: F?.rerun?.ticks ?? null, dead: F?.rerun?.dead ?? null, seconds: F?.seconds ?? 0, scn: window.__scenarios?.current?.()?.title ?? '', search: location.search };
      }, name);
      await page.close();
      const r = R.r, ok = r.code === 0 && R.file && R.ticks != null && !errors.length;
      for (const l of r.lines.slice(DRY || process.env.LINES ? 0 : ok ? -3 : -14)) console.log('    ' + l);
      if (!ok) { const last = seed === SEEDS[SEEDS.length - 1]; if (last) bad++; console.log(`- ${last ? 'FAIL' : 'again'} — ${name} (seed ${seed}): ${r.why || (R.dead ? `no run tape (${R.dead})` : errors[0] || 'no file')}`); continue; }
      const sounds = {}, order = []; for (const [f, n] of r.heard) { for (const m of [n, ...(WITH[n] ?? [])]) if (!(m in sounds)) sounds[m] = f; order.push(n); }
      if (DRY) { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name} (dry): ${r.secs} s, ${R.ticks} steps, ${(R.file.length / 1024).toFixed(0)} KB raw\n    ${Object.entries(sounds).map(([n, f]) => `${n}@${(f / 60).toFixed(0)}`).join(' ')}`); break; }
      const gz = zlib.gzipSync(Buffer.from(R.file), { level: 9 }), file = `${name}.json.gz`;
      fs.writeFileSync(path.join(DIR, file), gz);
      const row = { id: name, title: TITLES[name] || pages.pages[name].title || R.scn || name, file, seed, seconds: +r.secs.toFixed(1), steps: R.ticks, bytes: gz.length, asked: order.length, sounds };
      const X = readIndex();   // (read again at each write: two recorders may run side by side)
      X.tapes = [...X.tapes.filter(t => t.id !== name), row].sort((a, b) => pages.names.indexOf(a.id) - pages.names.indexOf(b.id));
      fs.writeFileSync(INDEX + '.tmp', JSON.stringify(X, null, 1) + '\n'); fs.renameSync(INDEX + '.tmp', INDEX);
      console.log(`- PASS — ${name}: ${r.secs} s of play, ${R.ticks} steps, ${Object.keys(sounds).length} sounds, ${(gz.length / 1024).toFixed(0)} KB (${((Date.now() - t0) / 1000).toFixed(0)} s to make)`);
      break;
    }

    if (CHECK) for (const name of todo) {
      const T = X.tapes.find(t => t.id === name); if (!T) { bad++; console.log(`- FAIL — ${name}: no replay kept (record it first)`); continue; }
      const { page, errors } = await open(`paused&quality=${QUALITY}&mute&playtape=assets/replays/${T.file}`);
      const st = await page.evaluate(async () => {
        if (!window.__tape) return null;
        const a = window.__audio, heard = [], play = a.play.bind(a); a.play = (n, ...r) => { heard.push(n); return play(n, ...r); };
        const e = window.__engine; e.render = () => { e.world.upload(); }; window.__smoke.params.enabled = false;
        const tick = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
        for (let i = 0; i < 4000 && !window.__tape.state.ended; i++) { window.__tape.run(240, false); await tick(); }
        const s = window.__tape.state; return { ended: s.ended, f: s.f, ticks: s.ticks, drift: s.drift, unjournaled: s.unjournaled, compared: s.compared, heard };
      });
      await page.close();
      const sounds = {}; if (st) for (const n of st.heard) for (const m of [n, ...(WITH[n] ?? [])]) sounds[m] = 1;
      const miss = Object.keys(T.sounds).filter(n => !sounds[n]);
      const ok = !!st && st.ended && !st.drift && st.unjournaled === 0 && st.heard.length === T.asked && !miss.length && !errors.length;
      if (!ok) bad++;
      console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${!st ? 'the page has no player (' + (errors[0] || 'no error') + ')' : `${st.f} of ${st.ticks} steps, ${st.compared} compared, ${st.drift ? `parted at step ${st.drift.f} (${st.drift.who}, ${st.drift.metres.toFixed(2)} m)` : 'as recorded'}, ${st.unjournaled} reads the tape does not have, ${st.heard.length} sounds asked (recorded ${T.asked})${miss.length ? ', not heard: ' + miss.join(' ') : ''}${errors.length ? ' · ' + errors[0] : ''}`}`);
    }
    if (!CHECK && !DRY) cover();
  } finally { await browser.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
  console.log(bad ? `\n=== sound-tapes: ${bad} FAILED ===` : `\n=== sound-tapes: ALL PASS ===`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
