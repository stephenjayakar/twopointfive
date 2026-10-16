// THE INFRARED LIGHT ON THE GOGGLES, ON THE REAL PAGE (game/irlight.ts; the headless family is tools/qa/irlight-probes.ts): boots the page in headless Chromium on
// the SOFTWARE WebGPU adapter (SwiftShader — no GPU needed, and no GPU's picture: judge what is there, not how it looks), stands Sam in the doorway of a room
// with no light of its own on the depot, the camera pinned above the room, and keeps four stills and what the page's own light meter reads at each:
//   bare     his goggles up
//   tube     goggles down, the light off (IRLIGHT.on false): the room as the tube had it
//   ir       goggles down, the light on
//   bare2    goggles up again, the light still switched on: the first still's room, with nothing of the flood left in it
// Asked of them: the tube's picture of the room is brighter with the light than without (the mean of the frame's middle); the light meter in the room — the
// renderer's own probe pass, asked at the room's middle and on Sam — reads the same with the light and without; the frame after the goggles come up is the
// bare-eyed frame it was; the Tab panel has its rows; no console error.
//   node tools/qa/irlight-page.cjs <outDir>      env: PORT (the dev server's, default 5199) · SIZE (960x540) · QUALITY (verylow) · FRAMES (drawn per still, 4)
//   · ROOM='x,z' DOOR='x,z' (the room's middle and where Sam stands; default the depot's dark room of roomclear=1) · QUERY (the page's, default the depot's room clear with four)
// exit 0 = every line passed · 1 = one failed. Slow by nature: ~2 min to boot, 5–15 s a drawn frame.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'irlight-page';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
const FRAMES = Number(process.env.FRAMES || 4);
let STAGED = null;
const ROOM = (process.env.ROOM || '26.5,12.3').split(',').map(Number), DOOR = (process.env.DOOR || '25.8,10.4').split(',').map(Number);
const QUERY = process.env.QUERY || 'levelFile=depot.json&roomclear=1&squad4&difficulty=hard&pick=depot';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });

// in the page: ask the meter at the room's middle, draw n frames one at a time (each waited for), read the last one back; the mean of the frame's middle third
const DRAW = async ({ n, room }) => {
  const dev = window.__engine.device, g = window.__game;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { g.lightQuery('irlightRoom', [room[0], 1.2, room[1]], 0); window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  g.lightQuery('irlightRoom', [room[0], 1.2, room[1]], 0);
  window.__engine.render(window.__cam, g.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  await dev.queue.onSubmittedWorkDone(); await yieldMacro();
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  let sum = 0, mid = 0, nm = 0;
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) { const i = (y * fr.w + x) * 4, l = fr.data[i] + fr.data[i + 1] + fr.data[i + 2]; sum += l; fr.data[i + 3] = 255;
    if (x > fr.w / 3 && x < 2 * fr.w / 3 && y > fr.h / 3 && y < 2 * fr.h / 3) { mid += l; nm++; } }
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  const L = window.__engine.lights, pl = g.player;
  return { w: fr.w, h: fr.h, mean: +(sum / (fr.w * fr.h * 3)).toFixed(2), mid: +(mid / (nm * 3)).toFixed(2), url: c2.toDataURL('image/png'),
    nv: pl.nv, nvAmount: +pl.nvAmount.toFixed(2), irInList: L.ir.length, irUploaded: L.irCount, tube: L.tube, lights: L.activeCount, taaResets: window.__engine.taaResets, lastReset: window.__engine.lastTaaReset, restarted: window.__engine.passes.lastRealloc || '',
    meterRoom: g.lightAt('irlightRoom') ?? null, samVisibility: +pl.visibility.toFixed(4), samIrradiance: +(pl.irradiance ?? 0).toFixed(5) };
};
const PLAY = (secs) => { const e = window.__engine, real = e.render; let threw = null; e.render = () => {};
  try { for (let i = 0; i < Math.round(secs * 60) && !threw; i++) { try { window.__runFrames(1, 1 / 60); } catch (x) { threw = `frame ${i}: ${x && x.stack || x}`; } } } finally { e.render = real; }
  return threw; };

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errors = [], notes = [], R = {};
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return; if (/Failed to load resource/.test(x)) return; errors.push(`${t}: ${x.slice(0, 500)}`); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 800)));
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`http ${r.status()}: ${r.url()}`); });
  const save = async (tag, cap) => { if (cap && cap.url) { fs.writeFileSync(path.join(outDir, `${tag}-frame.png`), Buffer.from(cap.url.split(',')[1], 'base64')); delete cap.url; } R[tag] = cap; log(tag, JSON.stringify(cap));
    await page.screenshot({ path: path.join(outDir, `${tag}-page.png`) }).catch(() => {}); };
  const play = async (s) => { const threw = await page.evaluate(PLAY, s); if (threw) errors.push('play threw: ' + threw); };
  try {
    const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${QUERY}`; log('goto', url);
    await page.goto(url);
    const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines }; });
    log('ready', JSON.stringify(ready)); if (ready.fatal) errors.push('fatal: ' + ready.fatal);
    const cutSet = await page.evaluate(async (secs) => { const P = window.__cut?.programs, r = P?.swap ? P.ready : null; if (!r) return 'none';
      return await Promise.race([Promise.resolve(r).then(ok => ok ? 'ready' : 'failed', () => 'failed'), new Promise(done => setTimeout(() => done('timed out'), secs * 1000))]); }, 300).catch(e => 'threw: ' + e.message);
    log('cut programs', cutSet);
    const staged = await page.evaluate(({ room, door }) => {
      window.__menu.close(); window.__smoke.params.enabled = false;
      const g = window.__game, K = window.__knobs.registry().IRLIGHT; g.godMode = true; g.aiEnabled = false;
      window.__stage({ look: [room[0], 1.0, room[1]], yaw: 0, pitch: 1.25, dist: 15 }, { player: { pos: [door[0], 0, door[1]], yaw: Math.atan2(room[0] - door[0], room[1] - door[1]), invisible: true } });
      window.__mouse(innerWidth / 2, innerHeight / 2);
      return { irlight: K ? { ...K } : null, squad: window.__orders.squad().length, exposure: window.__engine.settings.exposure, nvGain: window.__engine.settings.nvGain, fog: g.fogOfWar.on }; }, { room: ROOM, door: DOOR }); notes.push('staged: ' + JSON.stringify(staged)); STAGED = staged;
    log(notes[notes.length - 1]);
    const set = (o) => page.evaluate((o) => { const g = window.__game, K = window.__knobs.registry().IRLIGHT; if (o.on !== undefined) K.on = o.on; if (o.nv !== undefined) g.player.nv = o.nv; }, o);
    await set({ nv: false, on: true }); await play(2); await save('bare', await page.evaluate(DRAW, { n: FRAMES, room: ROOM }));
    await set({ nv: true, on: false }); await play(1.5); await save('tube', await page.evaluate(DRAW, { n: FRAMES, room: ROOM }));
    await set({ on: true }); await play(1); await save('ir', await page.evaluate(DRAW, { n: FRAMES, room: ROOM }));
    await set({ nv: false }); await play(1.5); await save('bare2', await page.evaluate(DRAW, { n: FRAMES, room: ROOM }));
    notes.push('panel: ' + JSON.stringify(await page.evaluate(() => { window.__panel.toggle(); const s = document.querySelector('#panel input[type=search], #panel input'); if (s) { s.value = 'IR light'; s.dispatchEvent(new Event('input', { bubbles: true })); }
      return { text: (document.querySelector('#panel')?.innerText ?? '').split('\n').filter(l => /IR light/.test(l)).slice(0, 8) }; })));
    await page.screenshot({ path: path.join(outDir, 'panel-page.png') }).catch(() => {});
  } catch (e) { errors.push('threw: ' + String(e && e.stack || e).slice(0, 800)); }
  await browser.close();
  // ---- the lines
  const lines = []; const ok = (pass, label, detail) => { lines.push(`- ${pass ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); return pass; };
  let all = true; const B = R.bare, T = R.tube, I = R.ir, B2 = R.bare2, near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-3) + 1e-4;
  if (!B || !T || !I || !B2 || B.err || T.err || I.err || B2.err) all = ok(false, 'four stills', JSON.stringify(R)) && all;
  else {
    all = ok(T.irUploaded === 0 && I.irUploaded > 0 && B.irUploaded === 0 && B2.irUploaded === 0, 'the infrared lights are handed to the renderer in the tube\'s picture alone', `uploaded — bare ${B.irUploaded}, tube with the light off ${T.irUploaded}, with it on ${I.irUploaded} (of ${I.irInList} burning), goggles up again ${B2.irUploaded} (of ${B2.irInList} burning)`) && all;
    all = ok(I.mid > T.mid * 1.15 && I.mid > T.mid + 4, 'the room is brighter through the tube with the light than without it', `the middle of the frame (0‥255): tube alone ${T.mid}, with the light ${I.mid} · whole frame ${T.mean} → ${I.mean}`) && all;
    // (the scene is live — teammates walk and fight between the stills — so a reading is held against the flood it would carry if it leaked, and against how
    //  far the same reading moved between the two stills that had no infrared light at all)
    const dx = ROOM[0] - DOOR[0], dz = ROOM[1] - DOOR[1], flood = (STAGED?.irlight?.power ?? 30) / Math.max(STAGED?.exposure ?? 1, 1e-3) / Math.max(dx * dx + dz * dz, 0.25);
    const held = (a, b, drift) => a != null && b != null && Math.abs(a - b) <= Math.max(0.1 * flood, 2 * Math.abs(drift));
    all = ok(held(I.meterRoom, T.meterRoom, B.meterRoom - T.meterRoom) && held(I.samIrradiance, T.samIrradiance, B.samIrradiance - T.samIrradiance) && Math.abs(I.samVisibility - T.samVisibility) <= 0.05, 'the light meter does not read the flood (the renderer\'s own probe pass, on this adapter)', `the flood at the room's middle would be about ${flood.toFixed(2)} W/m² on its axis · the meter there: ${T.meterRoom.toFixed(3)} without the light, ${I.meterRoom.toFixed(3)} with (bare-eyed, before: ${B.meterRoom.toFixed(3)}) · on Sam: ${T.samIrradiance} / ${I.samIrradiance} W/m² (before: ${B.samIrradiance}), the HUD's bar ${T.samVisibility} / ${I.samVisibility}`) && all;
    const lift = I.mid - T.mid;
    all = ok(B2.mid <= B.mid + Math.max(0.1 * Math.max(lift, 0), 3) && Math.abs(B2.mean - B.mean) <= 6 && /infrared/.test(B2.restarted), 'goggles up again: the bare-eyed frame it was, nothing of the flood left in it', `the middle ${B.mid} → ${B2.mid} (the flood lifted the tube's by ${lift.toFixed(1)}), the whole frame ${B.mean} → ${B2.mean} · screen histories: ${B2.restarted || 'not restarted'}`) && all;
  }
  const panel = notes.find(n => n.startsWith('panel: ')) || ''; all = ok(/IR light ▸ on the goggles/.test(panel) && /IR light ▸ the team carries one too/.test(panel), 'the Tab panel has its rows', panel.slice(0, 600)) && all;
  all = ok(errors.length === 0, 'no console error', errors.slice(0, 6).join(' | ') || 'none') && all;
  console.log('\n=== irlight-page: the infrared light on the real page (software adapter) ===\n' + notes.join('\n') + '\n' + lines.join('\n') + `\n=== irlight-page: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ stills: R, notes, errors, pass: all }, null, 1));
  process.exit(all ? 0 : 1);
})();
