// AN OPEN FIRE, LOOKED AT IN THE REAL PAGE (src/game/fire.ts FIRE; render/shaders/fire.wgsl): the pass at night, the brazier in front of the tea room, the player
// stood beside it and a camera pinned on the two of them — stills as the game runs, with the fire (the page as it opens) and with ?fire=0 (the glowing lid and
// the steady lamp), the same frames of the same game. With the fire it also MEASURES what the game reads of it: the player's light meter frame by frame beside
// the drum and a few metres off (its least, most and mean, against the steady lamp's), and smoke sight lines asked of the game's own sensors across the plume
// at the heights a standing man's eyes and chest are (the light each line keeps: a line starts to count smoke under 0.8).
//   node tools/qa/fire-page.cjs [fire] [off]      default: fire alone (two pages at once halve each other's pace)
//   env: PORT (the dev server's, default 5199 — `PORT=5199 bun run tools/serve.ts` from this checkout) · OUT (the folder the stills go to) · LEVEL (default
//        pass.json; its brazier is found by the game's own rule) · QUALITY (default low) · STILLS (default 6) · GAP (frames of 1/30 s between stills, default 4) ·
//        WARM (drawn frames before the first still, default 60) · FWD (seconds let go by after them with NOTHING DRAWN, the solver stepped alone: a drawn frame is ten
//        seconds and more here and the plume wants several of the game's; default 0) · METER (frames the meter is read over at each stand, default 45; 0 = stills alone, nothing judged of the meter or the lines) ·
//        W / H (the page's size, default 960 × 540) · VIEWS (default close,play: `close` 3.2 m from the fire at 28°, `play` the game's own 55° from 13 m,
//        `low` 5 m at 12°) · WINDK (the storm's speed × this, default as the level has it) · FIRE (a JSON object laid over the page's FIRE table before the first frame)
// Headless Chromium on the SOFTWARE adapter: minutes to boot, many seconds a frame. What it can say: the page boots with the switch either way and no pipeline
// fails, the composite draws a flame where the level's brazier stands, the solver takes the smoke, what the meter reads and what a sight line keeps. What it
// cannot: a GPU's picture, how it moves at speed, a frame's cost.
// Exit 0 = the pages booted clean (every pipeline, no page error); with the fire: the switch was on, a fire's record was handed to the renderer in every still
// (that the composite drew it is for the eye: look at the stills), and — unless METER=0 — every sight line asked came back with an answer and none a standing
// man looks along lost a fifth of its light; with it off: the switch was off and no record was handed on. 1 otherwise.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const PORT = process.env.PORT || 5199, OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'fire-page-'));
const LEVEL = process.env.LEVEL || 'pass.json', QUALITY = process.env.QUALITY || 'low', STILLS = +(process.env.STILLS ?? 6), GAP = Math.max(1, +(process.env.GAP ?? 4)), WARM = +(process.env.WARM ?? 60), METER = +(process.env.METER ?? 45), FWD = +(process.env.FWD || 0);
const W = +(process.env.W || 960), H = +(process.env.H || 540), VIEWS = (process.env.VIEWS || 'close,play').split(','), TABLE = process.env.FIRE ? JSON.parse(process.env.FIRE) : null;
const QUERY = process.env.QUERY || 'roomclear&squad4&nofow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const want = process.argv.slice(2).filter(a => a === 'fire' || a === 'off'); const jobs = want.length ? want : ['fire'];
fs.mkdirSync(OUT, { recursive: true });
const PINS = { close: { pitch: 28, dist: 3.2, up: 0.35 }, play: { pitch: 55, dist: 13, up: 0 }, low: { pitch: 12, dist: 5, up: 0.5 }, far: { pitch: 55, dist: 21, up: 0 } };

async function one(browser, name) {
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || /error:|Invalid/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  const url = `http://localhost:${PORT}/?levelFile=${LEVEL}&${QUERY}&paused&quality=${QUALITY}&mute${name === 'off' ? '&fire=0' : ''}`;
  log(`${name}: ${url}`); await page.goto(url);
  const boot = await page.evaluate(async ({ table }) => {
    await window.__ready; window.__testVisible = true; const g = window.__game, F = window.__fire;
    if (table) for (const k in table) { if (table[k] && typeof table[k] === 'object' && !Array.isArray(table[k]) && F.knobs[k] && typeof F.knobs[k] === 'object') Object.assign(F.knobs[k], table[k]); else F.knobs[k] = table[k]; }   // (a nested row, FIRE.smoke, is laid over key by key)
    const t = F.targets[0]; if (!t) return { pipes: window.__boot.pipelines, none: true };
    const css = document.createElement('style'); css.textContent = 'body *:not(#view):not(:has(#view)) { visibility: hidden !important; }'; document.head.appendChild(css);
    // the player a long stride from the drum, on whichever side is open ground, facing it
    const at = [t.pos[0], t.pos[2]], col = g.col; let stand = null;
    for (const a of [Math.PI * 0.5, Math.PI, 0, -Math.PI * 0.5, Math.PI * 0.75, Math.PI * 0.25]) { const p = [at[0] + Math.sin(a) * 1.25, 0, at[1] + Math.cos(a) * 1.25]; if (!col.solidBlocked([p[0], 1, p[2]], [at[0], 1.2, at[1]]) && !window.__engine.world.raycast([p[0], 2.2, p[2]], [0, -1, 0], 2.0)) { stand = { p, yaw: a + Math.PI }; break; } }
    stand = stand || { p: [at[0] + 1.25, 0, at[1]], yaw: -Math.PI / 2 };
    window.__stage(null, { player: { pos: stand.p, yaw: stand.yaw, holstered: true } });
    window.__runFrames(2, 1 / 30);
    return { pipes: window.__boot.pipelines, on: F.knobs.on, fire: { name: t.name, pos: t.pos.map(v => +v.toFixed(2)), base: +t.baseIntensity.toFixed(2) }, stand, drawing: window.__smoke.drawing(), summary: F.summary() };
  }, { table: TABLE });
  log(`${name}: booted`, JSON.stringify(boot));
  if (boot.none) { await page.close(); console.log(`- FAIL — ${name}: the level has no fire`); return false; }
  const step = (n, pin) => page.evaluate(async ({ n, pin, at, stand }) => { const yieldM = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    if (pin) { const p = pin.pitch * Math.PI / 180; let yaw = stand.yaw + Math.PI * 0.5;   // square to the line from the man to the fire, from whichever side is clear
      const look = [at[0], 1.0 + pin.up, at[2]], eyeOf = y => [look[0] + Math.sin(y) * Math.cos(p) * pin.dist, look[1] + Math.sin(p) * pin.dist, look[2] + Math.cos(y) * Math.cos(p) * pin.dist];
      const clear = y => { const e = eyeOf(y), d = [look[0] - e[0], look[1] - e[1], look[2] - e[2]], L = Math.hypot(d[0], d[1], d[2]); return !window.__engine.world.raycast(e, [d[0] / L, d[1] / L, d[2] / L], L - 0.5); };
      const ys = [yaw, yaw + Math.PI, yaw + 0.6, yaw - 0.6, yaw + Math.PI + 0.6, yaw + Math.PI - 0.6, stand.yaw + Math.PI, stand.yaw]; yaw = ys.find(clear) ?? yaw;
      window.__firePin = { look, yaw, pitch: p, dist: pin.dist }; window.__stage(window.__firePin); }
    for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 30); if (i % 4 === 3 || i === n - 1) { await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); } }
    await yieldM(); const st = window.__smoke.stats; return { t: +window.__game.time.toFixed(2), pool: st.pool, coarse: st.coarseAll ?? st.coarse, emitters: st.emitters, drawn: window.__fire.drawn.length, light: +window.__fire.targets[0].light.intensity.toFixed(2) };
  }, { n, pin, at: boot.fire.pos, stand: boot.stand });
  for (let k = 0; k < WARM; k += 4) { const t0 = Date.now(), r = await step(Math.min(4, WARM - k), k === 0 ? PINS[VIEWS[0]] : null); log(`${name}: warm ${k + 4} of ${WARM}`, `${((Date.now() - t0) / 4000).toFixed(1)} s a frame`, JSON.stringify(r)); }
  if (FWD > 0) { const t0 = Date.now(); const r = await page.evaluate(async ({ n, at }) => { const yieldM = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
      for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 30, [], 'none'); window.__smoke.stepAlone(1 / 30, [at[0], 0, at[2]]); if (i % 8 === 7) { await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); } }
      const st = window.__smoke.stats; return { t: +window.__game.time.toFixed(2), pool: st.pool }; }, { n: Math.round(FWD * 30), at: boot.fire.pos });
    log(`${name}: ${FWD} s gone by with nothing drawn (the game stepped, the solver stepped alone)`, `${((Date.now() - t0) / 1000).toFixed(0)} s`, JSON.stringify(r)); await step(3, null); }
  const rows = [];
  for (const v of VIEWS) { const pin = PINS[v]; if (!pin) continue;
    for (let k = 0; k < STILLS; k++) { const r = await step(k === 0 ? 2 : GAP, k === 0 ? pin : null);
      const file = path.join(OUT, `fire_${name}_${v}_${String(k).padStart(2, '0')}.png`); await page.screenshot({ path: file, timeout: 300000 }); rows.push(r); log(`${name}: ${v} ${k}`, JSON.stringify(r), '→', file); } }
  // what the game reads: the meter beside the drum and off it, the sight lines through the plume
  const read = METER <= 0 ? { meter: {}, lines: {}, answered: {}, skipped: true } : await page.evaluate(async ({ n, at, stand }) => { const yieldM = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
    const g = window.__game, S = g.sensors, out = { meter: {}, lines: {}, answered: {} };
    const dir = [Math.sin(stand.yaw + Math.PI), Math.cos(stand.yaw + Math.PI)];   // from the fire toward where he stands
    const lines = {}; for (const y of [1.2, 1.5, 1.7, 2.1, 2.6]) lines['across_' + y] = [[at[0] - dir[1] * 1.5, y, at[2] + dir[0] * 1.5], [at[0] + dir[1] * 1.5, y, at[2] - dir[0] * 1.5]];
    lines.eyeOverIt = [[at[0] + dir[0] * 3, 1.62, at[2] + dir[1] * 3], [at[0] - dir[0] * 3, 1.3, at[2] - dir[1] * 3]];
    for (const key in lines) { out.lines[key] = 1; out.answered[key] = 0; }
    for (const d of [1.25, 3, 5]) { const p = [at[0] + dir[0] * d, 0, at[2] + dir[1] * d]; window.__stage(window.__firePin, { player: { pos: p, yaw: stand.yaw, holstered: true } });
      let lo = 9, hi = -9, sum = 0, m = 0, elo = 9, ehi = -9;
      for (let i = 0; i < n + 12; i++) { for (const key in lines) S.askSegment('fp_' + key, lines[key][0], lines[key][1]);
        window.__runFrames(1, 1 / 30); await window.__engine.device.queue.onSubmittedWorkDone(); await yieldM(); await yieldM();
        for (const key in lines) { const v = S.read('fp_' + key); if (typeof v === 'number' && isFinite(v)) { out.answered[key]++; if (v < out.lines[key]) out.lines[key] = +v.toFixed(3); } }
        if (i >= 12) { const v = g.player.visibility, e = g.player.irradiance ?? 0; lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; m++; elo = Math.min(elo, e); ehi = Math.max(ehi, e); } }
      out.meter[d + 'm'] = { lo: +lo.toFixed(3), hi: +hi.toFixed(3), mean: +(sum / m).toFixed(3), E: [+elo.toFixed(4), +ehi.toFixed(4)] }; }
    out.summary = window.__fire.summary(); const st = window.__smoke.stats; out.pool = st.pool; out.emitters = st.emitters; return out;
  }, { n: METER, at: boot.fire.pos, stand: boot.stand });
  log(`${name}: read`, JSON.stringify(read));
  await page.close();
  const booted = boot.pipes.failed === 0 && boot.pipes.done === boot.pipes.total;
  const least = Math.min(...Object.entries(read.lines).filter(([k]) => /1\.5|1\.7|eyeOverIt/.test(k)).map(([, v]) => v));
  const unanswered = Object.entries(read.answered).filter(([, n]) => !n).map(([k]) => k);
  const ok = name === 'fire' ? booted && boot.on && rows.every(r => r.drawn > 0) && (read.skipped || (unanswered.length === 0 && least > 0.8)) : booted && !boot.on && rows.every(r => r.drawn === 0);
  console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${boot.pipes.done} of ${boot.pipes.total} pipelines, ${boot.pipes.failed} failed · the switch ${boot.on} · ${read.summary} · meter ${JSON.stringify(read.meter)} · sight lines keep ${JSON.stringify(read.lines)} (least a standing man looks along: ${least}${unanswered.length ? '; NEVER ANSWERED: ' + unanswered.join(', ') : ''}) · pool ${read.pool}${read.skipped ? ' · METER=0: the meter and the sight lines were NOT read' : ''}${errs.length ? ' · page errors: ' + errs.join(' | ') : ''}`);
  return ok && !errs.length;
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const oks = await Promise.all(jobs.map(j => one(browser, j).catch(e => { console.log(`- FAIL — ${j}: ${String(e).slice(0, 400)}`); return false; })));
  await browser.close(); log(`stills in ${OUT}`);
  process.exit(oks.every(Boolean) ? 0 : 1);
})();
