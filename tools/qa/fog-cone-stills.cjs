// FOG OF WAR AS A CONE (hard) — four stills of ONE staged frame from headless Chromium on the software WebGPU adapter (no GPU needed; cut-stills.cjs's flag set):
// the cone as hard ships it (the team's cones together), the same frame all round (standard), with only the player's own eyes (FOG.own), and the team's cones again under the fog's own light (FOG.flat 0.2). The HUD is hidden.
// It also is the check that the page's bundle boots with the change in it and that fogofwar.wgsl compiles (console / GPU errors fail it).
//   node tools/qa/fog-cone-stills.cjs [--out DIR] [--quality medium] [--w 800 --h 450] [--q 'extra&query']
// The dev server is started from this checkout on a free port and stopped by pid.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', path.join(ROOT, 'docs/shots'))), QUALITY = flag('--quality', 'medium'), VW = +flag('--w', 800), VH = +flag('--h', 450);
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let srv = null, browser = null; const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort(); srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up'); log(`dev server pid ${srv.pid} on :${port}`);
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 }); const errors = [];
  page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
  page.on('console', m => { const x = m.text(); if (m.type() !== 'error' || NOISE.test(x)) return; errors.push(x.slice(0, 500)); log('console.error', x.slice(0, 400)); });
  const url = `http://localhost:${port}/?${['roomclear', 'squad4', 'difficulty=hard', 'seed=1', 'paused', 'mute', `quality=${QUALITY}`, 'nosharp', 'fogfull=0', flag('--q', '')].filter(Boolean).join('&')}`;
  log('goto', url); await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 600) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  const boot = await page.evaluate(async () => {
    window.__testVisible = true; await window.__ready; const g = window.__game, E = window.__engine; window.__menu.close();
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    // the page's frame order with nothing drawn (cut-stills.cjs: on the software adapter a drawn frame is seconds): engine.render stubbed for the staging
    const real = E.render.bind(E); window.__draw = on => { E.render = on ? real : () => { }; };
    g.godMode = true; const FOG = window.__knobs.registry().FOG;
    return { fogOn: g.fogOfWar.on, cone: FOG.cone, own: FOG.own, deg: FOG.coneDeg, pipelines: window.__boot && window.__boot.pipelines, team: g.guards.filter(x => x.team === 'operative').length, foes: g.guards.filter(x => x.team !== 'operative').length };
  });
  log('booted', JSON.stringify(boot));
  // the staging: a second of the scenario (the team where it starts), the camera pinned straight down on the player, his aim put on a point up the screen
  const staged = await page.evaluate(async ([w, h]) => {
    const g = window.__game; window.__draw(false); window.__mouse(w * 0.5, h * 0.22); window.__runFrames(45); document.body.classList.add('breaching');   // (index.html: kit, meters, markers and prompts hidden — the picture alone)
    const p = g.player.char.pos; const r = window.__stage({ look: [p[0], 0, p[2]], yaw: window.__cam.yaw || 0, pitch: 78 * Math.PI / 180, dist: 21 }, {});
    window.__mouse(w * 0.5, h * 0.22); window.__runFrames(30); window.__draw(true);
    return { pin: r.pin, eyes: g.fogOfWar.eyes.map(e => ({ id: e.id, pos: e.pos.map(x => +x.toFixed(2)), look: e.look.map(x => +x.toFixed(2)) })), summary: g.fogOfWar.summary() };
  }, [VW, VH]);
  log('staged', JSON.stringify(staged));
  const still = async (name, set) => {
    const r = await page.evaluate(async (set) => { const g = window.__game, FOG = window.__knobs.registry().FOG; Object.assign(FOG, set); const dt = 1 / 600;   // (a sliver of time a frame: the picture settles, nobody walks)
      for (let i = 0; i < 7; i++) { window.__runFrames(1, dt); await window.__done(); }
      const F = g.fogOfWar; return { summary: F.summary(), eyes: F.eyes.length, hidden: g.guards.filter(x => x.state !== 'dead' && !F.drawn(x)).length, gpuErrs: window.__gpuErrs.slice() }; }, set);
    const file = path.join(OUT, `fogcone_${name}.png`); await page.screenshot({ path: file }); log(name, JSON.stringify(r), '→', file); return r;
  };
  const a = await still('hard_team', { cone: true, own: false, flat: 0 });
  const b = await still('standard', { cone: false, own: false, flat: 0 });
  const c = await still('hard_own', { cone: true, own: true, flat: 0 });
  const d = await still('hard_team_flat', { cone: true, own: false, flat: 0.2 });
  const gpu = [...a.gpuErrs, ...b.gpuErrs, ...c.gpuErrs, ...d.gpuErrs];
  await browser.close().catch(() => { }); browser = null; const pid = srv.pid; stop(); await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  const bad = errors.length + gpu.length; log(`dev server (pid ${pid}) stopped · ${bad ? `${errors.length} console / page errors, ${gpu.length} GPU errors` : 'clean: no console, page or GPU error'}`);
  if (gpu.length) console.log(gpu.join('\n')); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
