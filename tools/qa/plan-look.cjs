// THE SQUAD'S PLAN DRAWN ON THE FLOOR, ON THE PAGE — the real page's bundle in headless Chromium on the software WebGPU adapter (no GPU needed;
// roomfit-look.cjs's rig): a squad of four staged, then through the page's own __orders — 'move there' on a spot a dozen metres off (a still the moment it
// is given, one while they walk, one on their marks), the order menu opened on a door (the rings under the men it goes to), 'stack up' on that door (stacked,
// it waits on the word: the bar across its doorway with the key), and
// the same frame with the switch off. Each still is the page as composited (HUD and overlay over the canvas); printed beside each: what the overlay's SVG
// holds (ways, marks, fans, rings, tags shown). It is also the check that the bundle boots with the plan in it: console / page / GPU errors fail it, as
// does a still that shows no way when men are walking, or anything of the plan with the switch off.
//   node tools/qa/plan-look.cjs [--out DIR] [--q 'levelFile=floodlit.json&roomclear&squad4'] [--name office] [--quality verylow] [--w 960 --h 540] [--dist 22] [--quick]
// The dev server is started from this checkout on a free port and stopped by pid.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const { spawn, execSync } = require('child_process'); const net = require('net'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..'); const argv = process.argv.slice(2), flag = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.resolve(flag('--out', path.join(ROOT, 'docs/shots/plan'))), QUALITY = flag('--quality', 'verylow'), VW = +flag('--w', 960), VH = +flag('--h', 540);
const QUERY = flag('--q', 'roomclear&squad4'), NAME = flag('--name', 'office'), DIST = +flag('--dist', 22);
const QUICK = argv.includes('--quick');   // only normal play's clean floor, the menu's two stills and the switch off (half the time)
const FLAGS = ['--js-flags=--no-use-libm-trig-functions --no-use-std-math-pow', '--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /Failed to load resource/;
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
  const url = `http://localhost:${port}/?${[QUERY, 'seed=1', 'freshstart=0', 'paused', 'mute', `quality=${QUALITY}`, 'nosharp'].filter(Boolean).join('&')}`;
  log('goto', url); await page.goto(url, { waitUntil: 'commit' });
  for (let i = 0; ; i++) { try { if (await page.evaluate(() => !!window.__ready)) break; } catch { } if (i > 600) throw new Error('the page never set __ready: ' + errors.join(' | ')); await new Promise(r => setTimeout(r, 500)); }
  const boot = await page.evaluate(async ([w, h]) => {
    window.__testVisible = true; await window.__ready; const g = window.__game, E = window.__engine; window.__menu.close();
    window.__gpuErrs = []; E.device.addEventListener('uncapturederror', e => { window.__gpuErrs.push(String(e.error && e.error.message).slice(0, 300)); });
    window.__smoke.params.enabled = false; try { window.__weather.setEnabled(false); } catch { }
    window.__done = async () => { await E.device.queue.onSubmittedWorkDone(); await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); }); };
    const real = E.render.bind(E); window.__draw = on => { E.render = on ? real : () => { }; };   // (on the software adapter a drawn frame is seconds: nothing drawn while the men walk)
    window.__draw(false); g.godMode = true; window.__mouse(w * 0.5, h * 0.3); window.__runFrames(40);
    const O = g.orders, R = window.__knobs.registry();
    window.__quiet = () => { g.player.visibility = 0.05; for (const x of g.guards) if (x.team !== 'operative' && x.state !== 'dead') x.dazzledUntil = g.time + 30; };   // (the defenders kept out of it: this is a look at the plan)
    // what the overlay's SVG holds of the plan, as shown
    window.__planDom = () => { const vis = s => [...document.querySelectorAll(`#traj .plan ${s}`)].filter(e => e.style.display !== 'none' && (!e.parentElement.matches('g') || e.parentElement.classList.contains('plan') || e.parentElement.style.display !== 'none')).length;
      return { ways: vis('.pp'), marks: vis('.pm'), fans: vis('.pf'), sights: vis('.pl'), rings: vis('.pw'), you: vis('.py'), tags: [...document.querySelectorAll('#traj .plan .pt')].filter(e => e.style.display !== 'none' && e.parentElement.style.display !== 'none').map(e => e.textContent),
        bars: vis('.pd'), keys: [...document.querySelectorAll('#traj .plan .pkt')].filter(e => e.style.display !== 'none' && e.parentElement.style.display !== 'none').map(e => e.textContent) }; };
    // a spot of floor the menu takes, a walk of 8‥16 m from the player
    const s = g.player.char.pos; let spot = null, bd = 1e9; const d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    for (let dx = -16; dx <= 16; dx++) for (let dz = -16; dz <= 16; dz++) { const p = [s[0] + dx + 0.25, 0, s[2] + dz + 0.25], d = Math.hypot(dx, dz); if (d < 7 || d > 14) continue;
      const t = O.targetAt(p); if (t.kind !== 'floor' || d2(t.at, p) > 0.3) continue; const pa = g.col.nav.findPath(s, p, 4000); if (!pa) continue; let L = 0, q = s; for (const x of pa) { L += d2(q, x); q = x; } if (L < 8 || L > 16) continue;
      const turns = pa.length; const score = Math.abs(L - 12) - Math.min(turns, 6) * 0.6; if (score < bd) { bd = score; spot = p; } }
    window.__spot = spot;
    return { plan: R.PLAN && R.PLAN.on, menuOnly: R.PLAN && R.PLAN.menuOnly, pipelines: window.__boot && window.__boot.pipelines, team: O.squad().map(m => m.callsign), foes: g.guards.filter(x => x.team !== 'operative').length, sam: [+s[0].toFixed(1), +s[2].toFixed(1)], spot };
  }, [VW, VH]);
  log('booted', JSON.stringify(boot)); if (!boot.spot) throw new Error('no spot of floor found for the move order');
  const shots = [];
  const still = async (name, pin, expect) => {
    const r = await page.evaluate(async ([pin, dist]) => {
      if (pin) window.__stage({ look: [pin[0], 0, pin[2]], yaw: window.__cam.yaw || 0, pitch: 58 * Math.PI / 180, dist }, {});
      window.__draw(true); for (let i = 0; i < 4; i++) { window.__runFrames(1, 1 / 600); await window.__done(); } window.__draw(false);
      return { dom: window.__planDom(), gpuErrs: window.__gpuErrs.slice(), rows: window.__game.orders.squad().map(m => `${m.callsign}: ${window.__game.orders.statusOf(m)}`) };
    }, [pin, DIST]);
    const file = path.join(OUT, `plan_${NAME}_${name}.png`); await page.screenshot({ path: file });
    const d = r.dom, ok = expect(d); shots.push({ name, ok, d, gpu: r.gpuErrs.length });
    log(`${ok ? 'ok  ' : 'BAD '} ${name}: ways ${d.ways} · marks ${d.marks} · fans ${d.fans} · sight lines ${d.sights} · rings ${d.rings} · the player's ${d.you} · tags [${d.tags.join(' ')}] · door bars ${d.bars} [${d.keys.join(' ')}] → ${file}`);
    for (const x of r.rows) console.log('      ' + x);
    return r;
  };
  const mid = [(boot.sam[0] + boot.spot[0]) / 2, 0, (boot.sam[1] + boot.spot[2]) / 2];
  // 1. the move order, the moment it is given · walking · on their marks
  const menuOnly = v => page.evaluate(v => { window.__knobs.registry().PLAN.menuOnly = v; }, v);   // (the page opens with it ON: the marks only with the order menu up)
  if (!boot.menuOnly) throw new Error('the page did not open with PLAN.menuOnly on');
  if (!QUICK) {
  await menuOnly(false);   // the plan as it is drawn for as long as the orders stand (and with the menu up): stills 1 to 3
  const gave = await page.evaluate(() => { const g = window.__game, O = g.orders; window.__quiet(); const w = O.give('move', O.targetAt(window.__spot), 'all'); window.__runFrames(12); return w; });
  if (gave) throw new Error('the move order was refused: ' + gave);
  await still('1_given', mid, d => d.ways === 4 && d.marks === 4 && d.rings === 4 && d.you === 0 && d.tags.length === 4);
  await page.evaluate(() => { for (let i = 0; i < 6; i++) { window.__quiet(); window.__runFrames(30); } });
  await still('2_walking', mid, d => d.ways >= 1 && d.marks === 4 && d.rings === 0);
  await page.evaluate(() => { const g = window.__game, O = g.orders; for (let t = 0; t < 40 && !O.squad().every(m => { const A = O.of(m); return A && A.arrived; }); t += 0.5) { window.__quiet(); window.__runFrames(30); } window.__quiet(); window.__runFrames(60); });
  await still('3_on_marks', boot.spot, d => d.ways === 0 && d.marks === 4 && d.fans === 4 && d.tags.length === 4);
  await menuOnly(true); await still('3b_normal_play', boot.spot, d => d.ways + d.marks + d.fans + d.sights + d.tags.length === 0);   // the page's own way: the same men on the same marks, the floor clean
  }
  if (QUICK) {   // the page's own way, quickly: the four told to hold where they stand, some seconds on — nothing of them on the floor until the menu is up
    const h = await page.evaluate(() => { const g = window.__game, O = g.orders; window.__quiet(); const w = O.give('hold', O.targetAt(g.player.char.pos), 'all'), t0 = g.time;
      for (let i = 0; i < 60 && g.time - t0 < 3.5; i++) { window.__quiet(); window.__runFrames(4, 0.1); } return w || (g.time - t0 < 3.5 ? 'the clock did not run' : null); });
    if (h) throw new Error('hold: ' + h);
    await still('3b_normal_play', [boot.sam[0], 0, boot.sam[1]], d => d.ways + d.marks + d.fans + d.sights + d.tags.length === 0);
  }
  // 2. the menu on a door: rings under the men it goes to
  const door = await page.evaluate(() => { const g = window.__game, O = g.orders, s = O.squad()[0].char.pos, d2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    const ds = [...g.doors.list].sort((a, b) => d2(a.frameCentre, s) - d2(b.frameCentre, s)); for (const d of ds) { const t = O.targetAt(d.frameCentre); if (t.kind !== 'door') continue; window.__door = d; O.open(t); window.__runFrames(3); return { at: d.frameCentre, name: d.def.name }; } return null; });
  if (!door) throw new Error('no door found'); log('door', JSON.stringify(door));
  const dm = [(boot.spot[0] + door.at[0]) / 2, 0, (boot.spot[2] + door.at[2]) / 2];
  await still('4_menu', dm, d => d.rings === 4 && d.you === 1 && d.marks === 4);   // (the menu up: what stands is drawn again)
  await still('4b_menu_you', [boot.sam[0], 0, boot.sam[1]], d => d.you === 1);   // the same menu, the camera on the one whose menu it is: his gold ring
  if (!QUICK) await menuOnly(false);
  // 3. stack up on it
  if (!QUICK) {
  const st = await page.evaluate(() => { const g = window.__game, O = g.orders; O.close(); window.__quiet(); const w = O.give('stack', O.targetAt(window.__door.frameCentre), 'all'); window.__runFrames(12); return w; });
  if (st) log('stack refused: ' + st);
  else {
    await still('5_stack_given', dm, d => d.ways >= 1 && d.marks === 4);
    await page.evaluate(() => { const g = window.__game, O = g.orders; for (let t = 0; t < 40 && !O.squad().every(m => { const A = O.of(m); return A && A.arrived; }); t += 0.5) { window.__quiet(); window.__runFrames(30); } window.__quiet(); window.__runFrames(60); });
    await still('6_stacked', door.at, d => d.ways === 0 && d.marks === 4 && d.bars === 1 && d.keys.join() === 'F');
  }
  // 3b. a teammate's throw: the throw page up on a spot one of them has a throw to (offered: fainter), then the order given — and the throw order's own
  //     stopgap picture (#traj .squadthrow) draws nothing while the plan draws it
  const thr = await page.evaluate(() => { const g = window.__game, O = g.orders, T = window.__squadthrow, key = window.__knobs.registry().FRAG.orderKey; O.close(); window.__quiet();
    const s = O.squad()[0].char.pos, cands = []; let best = null;   // a spot one of them WALKS to throw a frag at: only a walked throw is still listed after the order
    for (let r = 5; r <= 15; r += 2) for (let a = 0; a < 16; a++) {
      const p = [s[0] + Math.cos(a * Math.PI / 8) * r, 0, s[2] + Math.sin(a * Math.PI / 8) * r], t = O.targetAt(p); if (t.kind !== 'floor') continue;
      const th = T.plan(t.at, 'frag'); if (th) cands.push({ t, walks: th.post ? 1 : 0 }); }
    cands.sort((a, b) => b.walks - a.walks);
    for (const c of cands.slice(0, 10)) {
      O.open(c.t); window.__runFrames(2); window.__input.pressed.add(key); window.__runFrames(3);
      const P = T.plans(), one = P[0] && P[0].kind === 'frag' ? { at: c.t.at, who: P[0].gd.callsign, walk: (P[0].walk || []).length, arc: P[0].points.length, tried: cands.length } : null;
      if (one && (!best || one.walk > best.walk)) best = one;
      if (best && best.walk > 1 && one === best) break;   // (left open on the pick)
      O.close(); window.__quiet(); window.__runFrames(1);
    }
    if (best && !T.plans().length) { O.open(O.targetAt(best.at)); window.__runFrames(2); window.__input.pressed.add(key); window.__runFrames(3); }
    return best; });
  const throwDom = () => page.evaluate(() => { const vis = s => [...document.querySelectorAll(s)].filter(e => e.style.display !== 'none' && e.parentElement.style.display !== 'none').length;
    return { arcs: vis('#traj .plan .pa'), lands: vis('#traj .plan .pe'), reach: vis('#traj .plan .pr'), thrower: vis('#traj .plan .pw.thr'), stopgap: vis('#traj .squadthrow polyline') + vis('#traj .squadthrow polygon') }; });
  const throwStill = async (name, at, n = 1) => { await still(name, at, () => true); const t = await throwDom(), ok = t.arcs === n && t.lands === n && t.reach === n && t.thrower === n && t.stopgap === 0;
    shots[shots.length - 1].ok = ok; log(`${ok ? 'ok  ' : 'BAD '} ${name}: arcs ${t.arcs} · landing marks ${t.lands} · frag reach rings ${t.reach} · thrower rings ${t.thrower} · the stopgap picture's shapes ${t.stopgap}`); };
  if (!thr) { shots.push({ name: '6b_throw_offered', ok: false, d: {}, gpu: 0 }); log('BAD  no spot found that a teammate has a frag throw to'); }
  else {
    log('a throw offered', JSON.stringify(thr));
    await throwStill('6b_throw_offered', thr.at);
    await page.evaluate(() => { window.__quiet(); window.__input.pressed.add('Digit1'); window.__runFrames(4); });
    await throwStill('6c_throw_ordered', thr.at, thr.walk > 1 ? 1 : 0);   // (thrown from where he stands: the thing is out of his hand, nothing is listed)
    await page.evaluate(() => { for (let i = 0; i < 16 && window.__squadthrow.plans().length; i++) { window.__quiet(); window.__runFrames(30); } window.__game.orders.close(); window.__quiet(); window.__runFrames(30); });
  }
  }
  // 4. the switch off: the same frame, nothing of the plan
  await page.evaluate(() => { window.__knobs.registry().PLAN.on = false; });
  await still('7_off', door.at, d => d.ways + d.marks + d.fans + d.rings + d.sights + d.tags.length + d.bars + d.keys.length === 0);
  const gpu = shots.reduce((a, s) => a + s.gpu, 0), bad = shots.filter(s => !s.ok).length;
  await browser.close().catch(() => { }); browser = null; const pid = srv.pid; stop(); await new Promise(r => setTimeout(r, 500));
  try { const left = execSync(`lsof -ti :${port} || true`).toString().trim(); for (const p of left.split(/\s+/).filter(Boolean)) { try { process.kill(Number(p)); } catch { } } } catch { }
  log(`dev server (pid ${pid}) stopped · ${errors.length + gpu ? `${errors.length} console / page errors, ${gpu} GPU errors` : 'clean: no console, page or GPU error'} · ${shots.length - bad} of ${shots.length} stills as expected`);
  process.exit(errors.length + gpu + bad ? 1 : 0);
})().catch(e => { console.error(String(e && e.stack || e)); stop(); process.exit(1); });
