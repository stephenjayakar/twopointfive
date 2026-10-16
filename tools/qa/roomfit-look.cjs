// THE SQUAD SENT TO A SPOT, ON THE PAGE — the real page's bundle in headless Chromium on the software WebGPU adapter (no GPU needed; fog-cone-stills.cjs's flag
// set): the night breach's four staged, 'move there' given through the page's own __orders on one point TWICE — the fit off (the old line abreast), then the
// encounter restaged and the fit on (game/roomfit.ts) — the men walked there with nothing drawn, then one drawn still of each from straight above. Printed per
// run: where each man stands, how far from the point, what his row reads. It is also the check that the bundle boots with the change in it and that the order
// goes through on the page (console / page / GPU errors fail it). The player stays where he gave the order from, out of the frame.
//   node tools/qa/roomfit-look.cjs [--out DIR] [--at 33,18] [--quality verylow] [--w 800 --h 450] [--secs 40] [--dist 15] [--q 'extra&query']
// The dev server is started from this checkout on a free port and stopped by pid.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', path.join(ROOT, 'docs/shots'))), QUALITY = flag('--quality', 'verylow'), VW = +flag('--w', 800), VH = +flag('--h', 450);
const AT = flag('--at', '33,18').split(',').map(Number), SECS = +flag('--secs', 40), DIST = +flag('--dist', 15);
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
  const url = `http://localhost:${port}/?${['nightbreach', 'squad4', 'seed=1', 'paused', 'mute', `quality=${QUALITY}`, 'nosharp', flag('--q', '')].filter(Boolean).join('&')}`;
  log('goto', url); await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 600) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  const boot = await page.evaluate(async () => {
    window.__testVisible = true; await window.__ready; const g = window.__game, E = window.__engine; window.__menu.close();
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    const real = E.render.bind(E); window.__draw = on => { E.render = on ? real : () => { }; };   // (on the software adapter a drawn frame is seconds: nothing drawn while the men walk)
    g.godMode = true; const R = window.__knobs.registry();
    return { fit: R.ROOMFIT && R.ROOMFIT.on, pipelines: window.__boot && window.__boot.pipelines, state: window.__nightbreach.state, team: g.orders.squad().map(m => m.callsign), foes: g.guards.filter(x => x.team !== 'operative').length };
  });
  log('booted', JSON.stringify(boot));
  const run = async (name, on, first) => {
    const r = await page.evaluate(async ([name, on, first, at, secs, dist, w, h]) => {
      const g = window.__game, O = g.orders, R = window.__knobs.registry(); window.__draw(false);
      if (!first) { window.__nightbreach.restage(); }
      R.ROOMFIT.on = on; g.godMode = true; window.__mouse(w * 0.5, h * 0.3); window.__runFrames(30);
      const quiet = () => { g.player.visibility = 0.05; for (const x of g.guards) if (x.team !== 'operative' && x.state !== 'dead') x.dazzledUntil = g.time + 30; };   // (the defenders kept out of it: this is a look at where men stand)
      quiet(); const P = [at[0], 0, at[1]], sam = g.player.char.pos.slice(), refused = O.give('move', O.targetAt(P), 'all');
      let t = 0; const men = () => O.squad(), there = () => men().every(m => { const A = O.of(m); return !A || A.arrived; });
      for (; t < secs && !(t > 2 && there()); t += 0.5) { quiet(); window.__runFrames(30); }
      quiet(); window.__runFrames(60);   // (a second more: guns settle on what each man watches)
      const rows = men().map(m => { const A = O.of(m), c = m.char.pos; return { who: m.callsign, pos: [+c[0].toFixed(2), +c[2].toFixed(2)], off: +Math.hypot(c[0] - P[0], c[2] - P[2]).toFixed(2), yawDeg: Math.round(m.char.bodyYaw * 180 / Math.PI), row: O.statusOf(m), arrived: !!(A && A.arrived), state: m.state }; });
      let near = Infinity; for (const a of rows) for (const b of rows) if (a !== b) near = Math.min(near, Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1]));
      document.body.classList.add('breaching');   // (index.html: kit, meters, markers and prompts hidden — the picture alone)
      const pin = window.__stage({ look: [P[0], 0, P[2]], yaw: 0, pitch: 80 * Math.PI / 180, dist }, {});
      window.__draw(true); for (let i = 0; i < 6; i++) { window.__runFrames(1, 1 / 600); await window.__done(); }
      return { name, fit: R.ROOMFIT.on, refused, secs: t, nearestTwo: +near.toFixed(2), sam: [+sam[0].toFixed(1), +sam[2].toFixed(1)], rows, pin: pin && pin.pin, gpuErrs: window.__gpuErrs.slice() };
    }, [name, on, first, AT, SECS, DIST, VW, VH]);
    const file = path.join(OUT, `roomfit_${name}.png`); await page.screenshot({ path: file });
    log(`${name}: fit ${r.fit ? 'ON' : 'off'} · ${r.refused ? 'REFUSED: ' + r.refused : 'given'} · ${r.secs.toFixed(1)} s · nearest two ${r.nearestTwo} m · Sam at (${r.sam}) → ${file}`);
    for (const m of r.rows) console.log(`    ${m.who.padEnd(9)} (${m.pos[0]}, ${m.pos[1]}) · ${m.off} m off the point · facing ${m.yawDeg}° · ${m.arrived ? 'there' : 'NOT there'} · ${m.state} · "${m.row}"`);
    await page.evaluate(() => { window.__stage(null, {}); document.body.classList.remove('breaching'); });
    return r;
  };
  const a = await run('abreast', false, true), b = await run('fitted', true, false);
  const gpu = [...a.gpuErrs, ...b.gpuErrs], notThere = [...a.rows, ...b.rows].filter(m => !m.arrived).length, refused = [a, b].filter(r => r.refused).length;
  const fitRows = b.rows.filter(m => /^in position · /.test(m.row)).length, flatRows = a.rows.filter(m => m.row === 'in position').length;
  log(`rows: fitted ${fitRows} of ${b.rows.length} read 'in position · …' · abreast ${flatRows} of ${a.rows.length} read 'in position' · nearest two ${a.nearestTwo} m → ${b.nearestTwo} m`);
  await browser.close().catch(() => { }); browser = null; const pid = srv.pid; stop(); await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  const bad = errors.length + gpu.length + notThere + refused + (fitRows === b.rows.length ? 0 : 1) + (flatRows === a.rows.length ? 0 : 1);
  log(`dev server (pid ${pid}) stopped · ${errors.length + gpu.length ? `${errors.length} console / page errors, ${gpu.length} GPU errors` : 'clean: no console, page or GPU error'}${notThere ? ` · ${notThere} men NOT there` : ''}${refused ? ' · an order was REFUSED' : ''}`);
  if (gpu.length) console.log(gpu.join('\n')); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
