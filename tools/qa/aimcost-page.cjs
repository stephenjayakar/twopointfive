// WHAT MOVING COSTS, ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe), start the plain night,
// bring the pistol up, and read the HUD's own aiming ring (the `.reticle.aim` element's width) standing still, at a walk, a third of a second after stopping and
// two seconds after. With the rules on (the page as it opens) the ring must open well past its resting size at a walk, still be open a third of a second after he
// stops, and be back at rest two seconds on; under ?lamphit=0&movecost=0 both switches read off and the ring never passes the old 60 px.
//   PORT=5199 node tools/qa/aimcost-page.cjs [outDir]        (a dev server on that port: PORT=5199 bun run tools/serve.ts; outDir = a still of the walk)
//   ONLY=cost|off in front = that one page alone (each is about half an hour on the software adapter)
// exit 0 = both hold with no page error · 1 = otherwise
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['cost', ''], ['off', 'lamphit=0&movecost=0']]) {
    if (ONLY && ONLY !== name) continue;
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const r = await page.evaluate(async () => {
      await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
      const g = window.__game, pl = g.player; g.aiEnabled = false;
      window.__input.pressed.add('Digit1'); await window.__runFrames(40);
      if (!pl.pistolUp) { window.__input.pressed.add('KeyE'); await window.__runFrames(80); }
      const ring = () => { const el = document.querySelector('.reticle.aim'); return el && el.style.display !== 'none' ? el.getBoundingClientRect().width : NaN; };
      const still = async n => { for (let i = 0; i < n; i++) { window.__mouse(760, 300); await window.__runFrames(1); } };
      const sw = window.__knobs.registry().AIMCOST;
      await still(150); const rest = ring();
      let walk = NaN, moved = 0, key = '';
      for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
        const p0 = [...pl.char.pos];
        for (let i = 0; i < 50; i++) { window.__mouse(760, 300); await window.__runFrames(1, 1 / 60, [k]); }
        moved = Math.hypot(pl.char.pos[0] - p0[0], pl.char.pos[2] - p0[2]); walk = ring(); key = k;
        if (moved > 0.8) break;
        await still(150);
      }
      await still(20); const soon = ring();
      await still(120); const late = ring();
      return { fatal: document.getElementById('fatal')?.textContent || '', lamp: !!(sw && sw.lamp), move: !!(sw && sw.move), pistol: !!pl.pistolUp, rest, walk, soon, late, moved, key };
    });
    if (OUT) await page.screenshot({ path: `${OUT}/aimcost-${name}.png`, timeout: 45000 }).catch(() => console.log(`  (no still of ${name}: the page did not hand one over)`));
    const want = name === 'cost';
    const ok = !r.fatal && !errors.length && r.pistol && r.lamp === want && r.move === want && r.moved > 0.8 && Math.abs(r.late - r.rest) < Math.max(3, 0.25 * r.rest)
      && (want ? r.walk > 1.8 * r.rest && r.walk > 60 && r.soon > 1.4 * r.rest : r.walk <= 60.5 && r.soon <= 60.5);
    if (!ok) failed = true;
    const f = v => Number.isFinite(v) ? v.toFixed(0) + ' px' : 'no ring';
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: lamps need a real hit ${r.lamp ? 'on' : 'off'} · moving costs ${r.move ? 'on' : 'off'} · pistol up ${r.pistol} · the ring standing ${f(r.rest)} · at a walk (${r.key}, ${r.moved.toFixed(1)} m) ${f(r.walk)} · a third of a second after stopping ${f(r.soon)} · two seconds after ${f(r.late)}${r.fatal ? ' · FATAL ' + r.fatal.slice(0, 200) : ''}${errors.length ? ' · errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== aimcost-page: FAILED ===' : '=== aimcost-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
