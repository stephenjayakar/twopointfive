// AN ENTRY CLEARS THE WHOLE ROOM, ON THE PAGE (DOORTOOLS.flowOn) — the consulate's side door, the room the ask came with, played on the real page in headless
// Chromium on the software WebGPU adapter (no GPU needed; fog-cone-stills.cjs's flag set and recipe), once with the rule off and once with it on:
// the other side taken off the floor (the question is where the team goes), the team put outside the consul's office's side door, 'open and clear' given
// by the orders hook, the game stepped with nothing drawn until the order is over, then ONE still from straight above the room, the player not drawn.
//   node tools/qa/wholeroom-look.cjs [--out DIR] [--quality medium] [--w 760 --h 860] [--q 'extra&query']
// Said per arm: where each man ends, how much of the room's floor nobody looked at, what the search said. It is also the check that the page's bundle boots
// with the change in it and that the Team feel row is on the panel's table (console / page / GPU errors fail it; so does the rule sending nobody in).
// The dev server is started from this checkout on a free port and stopped by pid.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', path.join(ROOT, 'docs/shots'))), QUALITY = flag('--quality', 'medium'), VW = +flag('--w', 760), VH = +flag('--h', 860);
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /smoke|number of storage textures \(5\) in the Compute stage|Failed to load resource/;   // the solver's pipelines on SwiftShader (every boot), and one 404 the page always has
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.unref(); s.on('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
let srv = null, browser = null; const stop = () => { try { browser && browser.close(); } catch { } try { srv && srv.kill(); } catch { } srv = null; };
process.on('exit', stop); for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => { stop(); process.exit(130); });
const DOOR = 'suite_side', OUTWARD = [-1, 0];   // (the face the picture's squad stood at: the room west of the consul's office)

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = await freePort(); srv = spawn('bun', ['run', 'tools/serve.ts'], { cwd: ROOT, env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  let up = false; for (let i = 0; i < 240 && !up; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/`); up = r.ok; } catch { } if (!up) await new Promise(r => setTimeout(r, 250)); }
  if (!up) throw new Error('the dev server did not come up'); log(`dev server pid ${srv.pid} on :${port}`);
  browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errors = [], gpu = [], arms = {};
  for (const on of [false, true]) { const name = on ? 'on' : 'off';
    const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { errors.push('pageerror: ' + String(e.stack || e).slice(0, 500)); log('PAGEERROR', String(e).slice(0, 300)); });
    page.on('console', m => { const x = m.text(); if (m.type() !== 'error' || NOISE.test(x)) return; errors.push(x.slice(0, 500)); log('console.error', x.slice(0, 400)); });
    const url = `http://localhost:${port}/?${['rescue', 'levelFile=consulate.json', 'squad=4', 'difficulty=hard', 'seed=1', 'paused', 'mute', `quality=${QUALITY}`, 'nosharp', flag('--q', '')].filter(Boolean).join('&')}`;
    log(name, 'goto', url); await page.goto(url, { waitUntil: 'commit' });
    for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 600) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
    const played = await page.evaluate(async ([on, DOOR, OUTWARD]) => {
      window.__testVisible = true; await window.__ready; const g = window.__game, E = window.__engine;
      window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
      window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
      window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
      const real = E.render.bind(E); window.__draw = d => { E.render = d ? real : () => { }; };   // (on the software adapter a drawn frame is seconds: nothing is drawn while the order is played)
      const K = window.__knobs.registry().DOORTOOLS, row = 'flowOn' in K; K.flowOn = on; window.__draw(false); window.__runFrames(30);
      g.guards.forEach((x, i) => { if (x.team === 'hostile' && x.state !== 'dead') window.__killGuard(i); });
      const O = g.orders, D = g.doorTools, nav = g.col.nav, d = g.doors.list.find(x => x.def.name === DOOR), at = d.frameCentre, flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
      const team = O.squad().filter(x => x.state !== 'dead'), spots = [], lat = [-OUTWARD[1], OUTWARD[0]];
      for (const back of [3.2, 4.2, 2.4, 5.2, 6.2]) for (const l of [1.1, -1.1, 0.4, -0.4, 1.9, -1.9]) { const p = [at[0] + OUTWARD[0] * back + lat[0] * l, 0, at[2] + OUTWARD[1] * back + lat[1] * l];
        if (!nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.1, p[2]], [at[0] + OUTWARD[0] * 0.7, 1.1, at[2] + OUTWARD[1] * 0.7]) && !spots.some(s => flat(s, p) < 0.8)) spots.push(p); }
      if (team.length !== 4) return { err: `the four were asked for and ${team.length} stand` };
      if (spots.length < team.length + 1) return { err: `no floor outside the door for the team (${spots.length} spots)` };
      team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(-OUTWARD[0], -OUTWARD[1]); });
      g.teleportPlayer(spots[team.length]); window.__runFrames(30);
      const t0 = g.time, why = O.give('openClear', O.targetAt(at), 'all'); if (why) return { err: `refused: ${why}` };
      let idle = 0, began = false; for (let i = 0; i < 60 * 150; i++) { window.__runFrames(1); if (D.ops.length) { began = true; idle = 0; } else if (++idle > (began ? 90 : 240)) break; }
      const op = D.done[D.done.length - 1], SR = op && op.search, R = SR && SR.room && SR.room.cells; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      if (R) for (const ci of R) { const x = (ci % nav.W + 0.5) * nav.cell, z = (Math.floor(ci / nav.W) + 0.5) * nav.cell; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
      return { row, flowOn: K.flowOn, secs: +(g.time - t0 - idle / 60).toFixed(1), ended: op ? op.ended : 'no order ended', unseen: SR ? SR.left : -1, cells: SR ? SR.pts.length : 0, flowed: D.stats.flowed, closedUp: D.stats.closedUp,
        box: R ? [x0, x1, z0, z1] : null, door: [at[0], at[2]], men: team.filter(x => x.state !== 'dead').map(x => ({ who: x.callsign, at: [+x.char.pos[0].toFixed(1), +x.char.pos[2].toFixed(1)], job: (O.of(x) || {}).there || '-' })),
        said: op ? op.beats.map(b => b.what).filter(w => /^(flow|bound|close up|on):|^flow: no|searched/.test(w)) : [] };
    }, [on, DOOR, OUTWARD]);
    if (played.err) throw new Error(`${name}: ${played.err}`);
    // the still: straight down on the room, the player not drawn, the HUD hidden; a sliver of time a frame so the picture settles and nobody walks
    const B = played.box, look = B ? [(B[0] + B[1]) / 2, 0, (B[2] + B[3]) / 2] : [played.door[0], 0, played.door[1]];
    const shot = await page.evaluate(async ([look, span]) => {
      document.body.classList.add('breaching'); const r = window.__stage({ look, yaw: 0, pitch: 80 * Math.PI / 180, dist: Math.max(14, span * 2.3) }, { player: { invisible: true } }); window.__draw(true);
      for (let i = 0; i < 7; i++) { window.__runFrames(1, 1 / 600); await window.__done(); }
      return { pin: r.pin, gpuErrs: window.__gpuErrs.slice() };
    }, [look, B ? Math.max(B[1] - B[0], B[3] - B[2]) : 14]);
    const file = path.join(OUT, `wholeroom_${name}.png`); await page.screenshot({ path: file }); gpu.push(...shot.gpuErrs); arms[name] = played;
    log(name, `· ${played.ended} after ${played.secs} s · ${played.unseen} of ${played.cells} cells nobody looked at · went in ${played.flowed}, closed up ${played.closedUp}`);
    log(name, '· men:', played.men.map(m => `${m.who} (${m.at[0]}, ${m.at[1]}) ${m.job}`).join(' · ')); log(name, '· said:', played.said.join(' | ') || '-', '→', file);
    await page.close();
  }
  await browser.close().catch(() => { }); browser = null; const pid = srv.pid; stop(); await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  const A = arms.off, Z = arms.on, checks = [
    ['the Team feel switch is on the page\'s knob table, on by default', Z.row && Z.flowOn === true],
    ['with the rule off nobody is sent into the unseen part (the build as it was)', A.flowed === 0],
    ['with the rule on men are sent in, and less of the floor is left unseen', Z.flowed > 0 && Z.unseen < A.unseen],
    ['no console, page or GPU error', !errors.length && !gpu.length]];
  for (const [what, ok] of checks) console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`);
  log(`dev server (pid ${pid}) stopped · floor nobody looked at: ${A.unseen} → ${Z.unseen} cells`); if (gpu.length) console.log(gpu.join('\n'));
  process.exit(checks.every(c => c[1]) ? 0 : 1);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
