// LOOK STILLS OF THE CAST — the real game page in headless Chromium on the software WebGPU adapter (SwiftShader), every kind of person the game puts on a level,
// at the play camera's distance and close up. Re-runnable against another tree for a before / after pair: same seed, same staging, same camera, same call
// sequence from a fresh boot.
//   PORT=5311 OUT=/some/dir node look-stills.cjs
//   env: PORT (the dev server serving the tree, default 5311) · OUT (where the PNGs + report.json go, default ./look-out) · SIZE (960x540) · QUALITY (high)
//        · QUERY (more of the page's query on every boot, e.g. QUERY=look=plain for the cast as it was before the look: one served tree gives the before / after pair)
//        · SET=fast | yard (a smaller set: see below) · SEED (7) · FRAMES (drawn frames per still, default 20) · SETTLE (simulated seconds, undrawn, after each staging, default 1)
//        · ONLY=name,name (draw only these stills; the page's other stills are still STAGED AND STEPPED, undrawn, so a still's simulation state does not depend
//          on which of its neighbours were drawn) · PAGES=squad,staff,nocharmats (boot only these pages, in this order)
// THREE PAGES, each one fresh boot (?paused&quality=…&mute + its query), one at a time:
//   squad       roomclear=1&squad4   Sam + his four teammates + the scenario's five defenders (no civilians, no response team in a scenario)
//                 top-squad-vs-defenders · close-operators · close-defenders · top-night
//   staff       (the plain night)    Sam + the shift's three (two of them marked `trained` + the response element's tints and carbine BEFORE the first step =
//                                    the responder outfit; the third the staff's defender outfit) + the two civilians
//                 top-responders-civilians · close-responders · close-civilians
//   nocharmats  nocharmats           the staff page again, only close-civilians drawn → civ-nocharmats (the flat placeholder colours, same staging to the step)
// Every still: <name>.png (the frame read back, no HUD) + <name>-x3.png (the men cropped and scaled ×3, nearest neighbour) + a row in report.json (query, seed,
// staging, frames, wall time, who stands where on screen and in what, GPU / page errors). The 'lit' stills switch the lobby's two ceiling panels on and put every
// hand torch out; 'night' is the level as authored with the torches as the game rules them. AI off, god mode, the fog of war off, the smoke solver off (the
// software adapter cannot run it — its 15 pipelines failing at boot are counted as `noise`, not errors).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');

const PORT = process.env.PORT || 5311;
const OUT = process.env.OUT || path.join(process.cwd(), 'look-out');
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'high';
const SEED = Number(process.env.SEED || 7);
const FRAMES = Number(process.env.FRAMES || 20);
const SETTLE = Number(process.env.SETTLE || 1);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/; const NOISE_MAX = 80;
const LIB = fs.readFileSync(path.join(__dirname, 'looklib.js'), 'utf8');
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);

// ---- the cameras (FollowCamera.pin, verbatim) and the floor: the lobby, under its two ceiling panels (8, 18.5) and (8, 21.5)
const TOP = { look: [8.0, 0, 18.2], yaw: -0.3839724354387525, pitch: 0.9599310885968813, dist: 21 };   // the follow camera's own yaw / pitch (55°) / distance at boot (camera.ts), looked at the group
const CLOSE = { look: [8.0, 0.95, 17.6], yaw: 0, pitch: 0.42, dist: 6.4 };                             // low and near from the south: a 1.8 m man ≈ 295 px of 540
const closeRow = (names) => names.map((who, k) => ({ who, pos: [+(8.0 - 1.1 * (names.length - 1) / 2 + 1.1 * k).toFixed(2), 17.6], yaw: k % 2 ? -0.55 : 0.55 }));   // 3/4 front, alternately left and right
const SQUAD_TOP = [
  { who: 'Sam', pos: [5.6, 17.4], yaw: 0.3 }, { who: 'Red One', pos: [6.8, 17.4], yaw: -0.6 }, { who: 'Red Two', pos: [8.0, 17.4], yaw: 2.6 }, { who: 'Blue One', pos: [9.2, 17.4], yaw: 1.2 }, { who: 'Blue Two', pos: [10.4, 17.4], yaw: -1.9 },
  { who: 'Tango 1', pos: [7.4, 19.0], yaw: 0.0 }, { who: 'Tango 2', pos: [8.6, 19.0], yaw: -2.4 }, { who: 'Tango 3', pos: [9.8, 19.0], yaw: 1.7 } ];   // eight: every man in frame casts a shadow (the proxy budget)
const STAFF_TOP = [
  { who: 'Sam', pos: [5.6, 17.4], yaw: 0.3 }, { who: 'Kowalski', pos: [6.8, 17.4], yaw: -0.6 }, { who: 'Novak', pos: [8.0, 17.4], yaw: 2.6 }, { who: 'Reyes', pos: [9.2, 17.4], yaw: 1.2 },
  { who: 'Marta', pos: [7.4, 19.0], yaw: 0.0 }, { who: 'Owen', pos: [8.6, 19.0], yaw: -2.4 } ];
const STAFF = { trained: ['Kowalski', 'Novak'], carbine: true };
const STAFF_STILLS = [
  { name: 'top-responders-civilians', light: 'lit', pin: TOP, men: STAFF_TOP },
  { name: 'close-responders', light: 'lit', pin: CLOSE, men: closeRow(['Kowalski', 'Novak', 'Reyes']) },   // (Reyes: the shift's own outfit beside the two, for the difference)
  { name: 'close-civilians', light: 'lit', pin: CLOSE, men: closeRow(['Marta', 'Owen']) } ];
const PAGES = [
  { page: 'squad', query: 'roomclear=1&squad4', prep: {}, stills: [
    { name: 'top-squad-vs-defenders', light: 'lit', pin: TOP, men: SQUAD_TOP },
    { name: 'close-operators', light: 'lit', pin: CLOSE, men: closeRow(['Sam', 'Red One', 'Red Two', 'Blue One', 'Blue Two']) },
    { name: 'close-defenders', light: 'lit', pin: CLOSE, men: closeRow(['Tango 1', 'Tango 2', 'Tango 3', 'Tango 4', 'Tango 5']) },
    { name: 'top-night', light: 'night', pin: TOP, men: SQUAD_TOP } ] },
  { page: 'staff', query: '', prep: STAFF, stills: STAFF_STILLS },
  { page: 'nocharmats', query: 'nocharmats', prep: STAFF, stills: STAFF_STILLS.map(s => s.name === 'close-civilians' ? { ...s, name: 'civ-nocharmats' } : { ...s, never: true }) },
];
// SET=fast (the set that fits a box with no spare cores: two boots, four stills, run at QUALITY=medium FRAMES=8 by run-look.sh)
if (process.env.SET === 'fast') PAGES.splice(0, PAGES.length,
  { page: 'squad', query: 'roomclear=1&squad4', prep: {}, stills: [
    { name: 'top-squad-vs-defenders', light: 'lit', pin: TOP, men: SQUAD_TOP },
    { name: 'close-operators', light: 'lit', pin: CLOSE, men: closeRow(['Sam', 'Red One', 'Red Two', 'Blue One', 'Blue Two']) },
    { name: 'close-defenders', light: 'lit', pin: CLOSE, men: closeRow(['Tango 1', 'Tango 2', 'Tango 3', 'Tango 4', 'Tango 5']) } ] },
  { page: 'staff', query: '', prep: STAFF, stills: [
    { name: 'close-staff-civilians', light: 'lit', pin: CLOSE, men: closeRow(['Kowalski', 'Novak', 'Reyes', 'Marta', 'Owen']) } ] });   // two responders · a shift guard · the cleaner · the worker
// SET=yard (the men against the LOOK's ground, not the office floor: one boot of the compound at midday, one still over its west yard — Sam, the four and three
// defenders on the dust between the shed and the garage; the names are read off the roster, a level's defenders are not always 'Tango n')
const YARD = { look: [7.0, 0, 14.3], yaw: TOP.yaw, pitch: TOP.pitch, dist: TOP.dist };
const YARD_SPOTS = { ops: [[4.9, 15.3, 0.3], [6.1, 15.3, -0.6], [7.3, 15.3, 2.6], [8.5, 15.3, 1.2], [9.7, 15.3, -1.9]], foes: [[5.0, 13.2, 0.0], [6.2, 13.2, -2.4], [7.4, 13.2, 1.7]] };   // (clear of the garage wall's midday shadow to the south and of the well)
if (process.env.SET === 'yard') PAGES.splice(0, PAGES.length,
  { page: 'yard', query: 'levelFile=compound.json&roomclear=1&squad4&hour=midday', prep: {}, park: [33, 0, 7], stills: [{ name: 'yard-squad-vs-defenders', light: 'day', pin: YARD, auto: YARD_SPOTS }] });
const autoMen = (roster, spots) => { const ops = ['Sam', ...roster.filter(r => r.team === 'operative').map(r => r.name)], foes = roster.filter(r => r.team === 'hostile').map(r => r.name);
  return [...spots.ops.map((p, k) => ({ who: ops[k], pos: [p[0], p[1]], yaw: p[2] })), ...spots.foes.map((p, k) => ({ who: foes[k], pos: [p[0], p[1]], yaw: p[2] }))].filter(m => m.who); };
const PARK_SAM = [33, 0, 7];   // (the storage room, behind three walls of either camera: a man not in a still is not in its light either)

fs.mkdirSync(OUT, { recursive: true });
const reportPath = path.join(OUT, 'report.json');
let report = []; try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch { /* first run into this folder */ }
const fileRow = (R) => { report = report.filter(r => r.name !== R.name); report.push(R); fs.writeFileSync(reportPath, JSON.stringify(report, null, 1)); };

function crop(name, cap) {   // the men, ×3 (nearest neighbour: the pixels as rendered, bigger)
  const xs = cap.boxes.flatMap(b => [b.feet[0], b.head[0]]), ys = cap.boxes.flatMap(b => [b.feet[1], b.head[1]]), m = Math.round(0.35 * Math.max(...cap.boxes.map(b => b.px)));
  const x0 = Math.max(0, Math.min(...xs) - m), y0 = Math.max(0, Math.min(...ys) - m), x1 = Math.min(cap.w, Math.max(...xs) + m), y1 = Math.min(cap.h, Math.max(...ys) + m);
  const geo = `${x1 - x0}x${y1 - y0}+${x0}+${y0}`;
  execFileSync('convert', [path.join(OUT, name + '.png'), '-crop', geo, '+repage', '-filter', 'point', '-resize', '300%', path.join(OUT, name + '-x3.png')]);
  return geo;
}

(async () => {
  const want = (process.env.PAGES ? process.env.PAGES.split(',') : PAGES.map(p => p.page)).map(n => PAGES.find(p => p.page === n)).filter(Boolean)
    .filter(p => !ONLY || p.stills.some(s => !s.never && ONLY.includes(s.name)));
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let bad = 0;
  for (const P of want) {
    const errors = []; let noise = 0;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('console', m => { const t = m.type(), x = m.text(); if (t === 'log' && x.startsWith('LOOK ')) { log('   ', x.slice(5)); return; } if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return;
      if (/Failed to load resource/.test(x)) return;
      if (NOISE.test(x) && noise < NOISE_MAX) noise++; else errors.push(`${t}: ${x.slice(0, 400)}`); });
    page.on('requestfailed', r => errors.push(`request failed: ${r.url()} — ${r.failure()?.errorText ?? '?'}`));
    page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`http ${r.status()}: ${r.url()}`); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 600)));
    const query = `paused&quality=${QUALITY}&mute${P.query ? '&' + P.query : ''}${process.env.QUERY ? '&' + process.env.QUERY : ''}`;
    try {
      const url = `http://localhost:${PORT}/?${query}`; const tBoot = Date.now();
      log(P.page, 'goto', url); await page.goto(url);
      const ready = await page.evaluate(async () => { await window.__ready; return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines, cast: window.__game.ch.cast ? window.__game.ch.cast.variants.map(v => v.name) : null, charMats: !!window.__engine.settings.charMats }; });
      const bootSecs = Math.round((Date.now() - tBoot) / 1000); log(P.page, `ready in ${bootSecs} s`, JSON.stringify(ready)); if (ready.fatal) errors.push('fatal: ' + ready.fatal);
      await page.evaluate(LIB);
      const roster0 = await page.evaluate(([seed, opts]) => window.__look.prep(seed, opts), [SEED, P.prep]);
      log(P.page, 'cast on the floor:', roster0.map(r => `${r.name}(${r.team}${r.trained ? ',trained' : ''},id ${r.id})`).join(' '));
      for (const S of P.stills) {
        if (S.auto) S.men = autoMen(roster0, S.auto);
        const drawn = !S.never && (!ONLY || ONLY.includes(S.name)); const t0 = Date.now(); const e0 = errors.length;
        const staged = await page.evaluate(([S, park, settle]) => { const L = window.__look; L.light(S.light); const res = L.stage(S.pin, S.men, park); const threw = L.play(settle); return { pin: res.pin, threw }; }, [S, P.park ?? PARK_SAM, SETTLE]);
        if (staged.threw) errors.push(`${S.name}: play threw: ${staged.threw}`);
        if (!drawn) {   // the same steps, undrawn: the stills after it find the simulation where a full run leaves it
          const threw = await page.evaluate((n) => { const e = window.__engine, real = e.render; e.render = () => {}; try { for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 600); window.__look.hold(); } } catch (x) { return String(x && x.stack || x); } finally { e.render = real; } return null; }, FRAMES);
          if (threw) errors.push(`${S.name}: step threw: ${threw}`); log(P.page, S.name, 'stepped undrawn'); continue;
        }
        log(P.page, S.name, `staged, drawing ${FRAMES} frames…`);
        const cap = await page.evaluate((n) => window.__look.draw(n), FRAMES);
        const after = await page.evaluate(() => ({ roster: window.__look.roster(), gpu: window.__look.gpuErrors.splice(0), time: +window.__game.time.toFixed(3), sharp: !!window.__engine.sharpOn, lobby: window.__game.targets.filter(t => t.group === 'lobby').map(t => `${t.name ?? t.id ?? '?'}:${t.on ? 'on' : 'off'}`) }));
        const R = { name: S.name, page: P.page, query, url: `http://localhost:${PORT}/?${query}`, seed: SEED, size: `${W}x${H}`, quality: QUALITY, light: S.light, pin: staged.pin, men: S.men, prep: P.prep, settleSecs: SETTLE, frames: FRAMES,
          bootSecs, wallSecs: 0, frameMs: cap.frameMs, internal: cap.internal, mean: cap.mean, litPct: cap.litPct, fnv: cap.fnv, gameTime: after.time, lobby: after.lobby, sharpDirect: after.sharp,
          onScreen: cap.boxes, roster: after.roster.filter(r => r.pos[0] > -20 && !(r.name === 'Sam' && !S.men.some(m => m.who === 'Sam'))), gpuErrors: after.gpu, errors: errors.slice(e0), smokeNoiseLines: noise, castLoaded: ready.cast, charMats: ready.charMats, pipelines: ready.pipelines };
        if (cap.err) { R.errors.push('draw: ' + cap.err); errors.push('draw: ' + cap.err); }
        else { fs.writeFileSync(path.join(OUT, S.name + '.png'), Buffer.from(cap.url.split(',')[1], 'base64')); try { R.crop = crop(S.name, cap); } catch (x) { R.errors.push('crop: ' + String(x).slice(0, 200)); } }
        R.wallSecs = Math.round((Date.now() - t0) / 1000); fileRow(R);
        log(P.page, S.name, `done in ${R.wallSecs} s · ${cap.w}x${cap.h} (internal ${cap.internal}) mean ${cap.mean} · frame ms ${Math.min(...cap.frameMs)}‥${Math.max(...cap.frameMs)} · gpu errors ${after.gpu.length}`);
        log('   ', R.roster.map(r => `${r.name}=${r.variant}${r.torch ? '+torch' : ''}`).join(' · '));
        after.gpu.forEach(e => console.log('   gpu >', e));
      }
    } catch (x) { errors.push('script: ' + String(x && x.stack || x).slice(0, 800)); }
    if (errors.length) { bad++; fileRow({ name: `page-${P.page}-errors`, page: P.page, query, errors }); }
    log(P.page, errors.length ? `ERRORS ${errors.length}` : 'clean', `(${noise} lines of the software adapter's smoke-pipeline noise passed over)`); errors.forEach(e => console.log('   >', e));
    await page.close();
  }
  await browser.close();
  console.log(bad ? `=== look-stills: ${bad} page(s) with errors — see ${reportPath} ===` : `=== look-stills: clean — ${reportPath} ===`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('SCRIPT ERROR', String(e && e.stack || e).slice(0, 800)); process.exit(2); });
