// SAME SEED, SAME INPUTS, SAME FIGHT — THE REAL PAGE AGAINST THE HARNESS. Headless Chromium (V8) on the software WebGPU adapter plays a scripted stretch of a mission
// at a MIX OF FRAME TIMES (60, 120, 30 and 144 a second: the tape keeps each step's own), folding the raw float64 bits of the game after every step
// (`__digest.chain`, src/game/digest.ts). The page's own replay file is then handed to bun (JavaScriptCore), which walks a headless game through the tape
// (tools/qa/samefight-rerun.ts → rerun.ts) folding the same bits. PASS = every word equal: the fight the page played is the fight the tape plays, to the last
// bit, on another JavaScript engine with no GPU. That holds only under the game's own maths (src/math/exact.ts); SAMEFIGHT_BREAK=1 opens the page with ?noexact
// (each engine on its own sin and cos) and must FAIL.
//   PORT=5231 node tools/qa/samefight-page.cjs [--runs compound,rescue] [--keep dir]      (a dev server on that port: PORT=5231 bun run tools/serve.ts)
//   SAMEFIGHT_QUERY=cpusense …   the same with the senses on the CPU (src/game/sense.ts): the tape's GPU values are then not used at all — the re-run answers its own
//   senses and the tape's are only held against them — so the page's fight is its seed and its inputs and nothing else
// exit 0 = every run equal and no page error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawnSync } = require('node:child_process');
const { writeFileSync, mkdtempSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const ROOT = resolve(__dirname, '../..');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', BREAK = process.env.SAMEFIGHT_BREAK === '1', EXTRA = process.env.SAMEFIGHT_QUERY || '', DRAW = Math.max(1, Number(process.env.SAMEFIGHT_DRAW || 30) | 0);   // (a draw on the software adapter is seconds: one every 30 steps by default)
const VIEW = (process.env.SAMEFIGHT_VIEW || '960x540').split('x').map(Number);   // (SAMEFIGHT_VIEW=480x270: a smaller picture — the software adapter pays by the pixel, the game does not care)
const arg = k => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
// a run = a page query and a script: rows of [steps, steps a second, keys held, cursor (fraction of the view), buttons held (1 = fire)] — walk in, shoot, turn, walk on
const SCRIPT = [
  [60, 60, [], [0.5, 0.3], 0], [90, 60, ['KeyW'], [0.5, 0.25], 0], [48, 120, ['KeyW'], [0.6, 0.3], 1], [30, 30, ['KeyW', 'KeyD'], [0.7, 0.4], 1], [72, 144, ['KeyD'], [0.4, 0.3], 0],
  [90, 60, ['KeyW'], [0.5, 0.2], 1], [60, 60, ['KeyA'], [0.3, 0.5], 1], [60, 120, ['KeyW', 'KeyA'], [0.5, 0.3], 0], [120, 60, ['KeyW'], [0.55, 0.25], 1], [90, 60, ['KeyS'], [0.5, 0.7], 1],
  [120, 60, [], [0.5, 0.3], 1], [90, 30, ['KeyW'], [0.45, 0.3], 0], [180, 60, ['KeyW', 'KeyD'], [0.6, 0.35], 1], [120, 60, [], [0.5, 0.5], 0],
];
const RUNS = { compound: 'levelFile=compound.json&roomclear&squad4', rescue: 'rescue', night: 'solo' };
const picked = (arg('runs') || 'compound,rescue').split(',').filter(Boolean);
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, s) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}`); };
  const dir = arg('keep') || mkdtempSync(join(tmpdir(), 'samefight-'));
  console.log(`=== samefight-page: ${picked.length} run(s) on the real page (Chromium, software adapter) against a headless re-run of each one's tape${BREAK ? ' · SAMEFIGHT_BREAK: the page on ?noexact' : ''} ===`);
  for (const name of picked) {
    const q = RUNS[name]; if (!q) { line(false, `${name}: no such run (${Object.keys(RUNS).join(', ')})`); continue; }
    const page = await browser.newPage({ viewport: { width: VIEW[0], height: VIEW[1] }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    const t0 = Date.now(); if (process.env.SAMEFIGHT_SAY) page.on('console', m => { if (m.text().startsWith('[samefight]')) console.error(`  ${((Date.now() - t0) / 1000).toFixed(0)} s ${m.text()}`); });   // (SAMEFIGHT_SAY=1: where the page has got to, on stderr — the software adapter is slow)
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&seed=7&nokeep&${q}${BREAK ? '&noexact' : ''}${EXTRA ? '&' + EXTRA : ''}`);
    const P = await page.evaluate(async ({ script, every }) => {
      await window.__ready; try { window.__menu && window.__menu.close(); } catch { /* */ }
      console.log('[samefight] the page is up'); let row = 0;
      const g = window.__game, inp = window.__input, cv = document.getElementById('view'), C = window.__digest.chain(30);
      const before = { events: g.events.length, up: g.guards.filter(x => x.state !== 'dead').length };
      for (const [n, hz, keys, cur, buttons] of script) {
        inp.mouseX = cur[0] * cv.clientWidth; inp.mouseY = cur[1] * cv.clientHeight; if (buttons & ~inp.buttons) inp.clicked |= buttons & ~inp.buttons; inp.buttons = buttons;
        console.log(`[samefight] row ${++row} of ${script.length}`);
        for (let k = 0; k < n; k += every) { window.__runFrames(Math.min(every, n - k), 1 / hz, keys); await new Promise(r => setTimeout(r, 0)); }   // (a draw every `every` steps: the probe answers, the smoke runs — the GPU's values reach the game and its tape)
      }
      inp.buttons = 0; C.stop();
      const file = window.__replay.file('samefight'), reg = window.__knobs.registry();
      return { fatal: document.getElementById('fatal')?.textContent || '', words: C.words, steps: C.steps, file, seed: g.dice ? g.dice.seed : null, exact: reg.EXACT && reg.EXACT.on, sense: reg.SENSE ? reg.SENSE.cpu : undefined,
        gpuReads: g.sensors.stats.reads, fixed: g.seat.fixed, fixedCmds: g.seat.fixedCmds, checked: reg.CMDCHECK && reg.CMDCHECK.on, events: g.events.length - before.events, down: before.up - g.guards.filter(x => x.state !== 'dead').length, men: g.guards.length, time: g.time, playerUp: g.player.char.health > 0 };
    }, { script: SCRIPT, every: DRAW }).catch(e => ({ fatal: String(e && e.stack || e).slice(0, 600) }));
    await page.close();
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    if (P.fatal || !P.file) { line(false, `${name}: the page did not play (${P.fatal || 'no replay file: the buffer is off'})${errors.length ? ' · ' + errors.join(' ; ').slice(0, 400) : ''}`); continue; }
    if (P.checked) line(P.fixed === 0, `${name}: the page's own records are honest ones — the record check (src/game/cmd.ts) put ${P.fixed} thing(s) right in ${P.fixedCmds} record(s)`);
    line(!errors.length, `${name}: the page played ${P.steps} steps (${P.time.toFixed(1)} s of game, ${secs} s of wall) with no page error — seed ${P.seed}, ${P.men} men, ${P.events} events, ${P.down} down, own maths ${P.exact ? 'on' : 'OFF'}${P.sense === undefined ? '' : `, senses on the ${P.sense ? 'CPU' : 'GPU'}`}${errors.length ? ' — ' + errors.join(' ; ').slice(0, 500) : ''}`);
    const path = join(dir, `${name}.replay.json`); writeFileSync(path, JSON.stringify(P.file));
    const r = spawnSync('bun', ['run', 'tools/qa/samefight-rerun.ts', path, String(P.steps), '30'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, TPS_PROFILE: '', TPS_EXACT: '' } });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('SAMEFIGHT ')), H = l ? JSON.parse(l.slice(10)) : null;
    if (!H || H.refuse) { line(false, `${name}: the tape was not re-run — ${H ? H.refuse : (r.stderr || r.stdout || '').trim().split('\n').slice(-3).join(' / ').slice(0, 500)}`); continue; }
    let k = 0; while (k < P.words.length && k < H.words.length && P.words[k] === H.words[k]) k++;
    const same = P.words.length > 0 && P.words.length === H.words.length && k === P.words.length;
    if (H.ownSenses && H.ownSenses.on && H.ownSenses.differ) failed = true;
    line(same, `${name}: the tape re-run under bun is the page's fight to the bit — ${same ? `${P.words.length} words over ${P.steps} steps equal` : `${k} of ${P.words.length} words equal: the bits part in the half second ending at step ${(k + 1) * 30} (the re-run chained ${H.steps} steps of ${H.ticks})`} · held against the trace: ${H.compared} samples, worst ${Number(H.worst).toFixed(2)} m${H.drift ? `, drift ${H.drift}` : ''}${H.unjournaled ? ` · ${H.unjournaled} read(s) the page never made` : ''}${H.ownSenses && H.ownSenses.on ? ` · the re-run answered ${H.ownSenses.reads} reads itself, ${H.ownSenses.differ} not what the page's game had read` : ''}${H.warnings && H.warnings.length ? ` · ${H.warnings.length} note(s): ${H.warnings[0].slice(0, 160)}` : ''} (file: ${path})`);
  }
  await browser.close();
  console.log(failed ? '=== samefight-page: FAILED ===' : '=== samefight-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
