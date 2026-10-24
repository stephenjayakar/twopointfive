// THE THROW'S REACH RINGS, ON THE REAL PAGE (THROWBACK.reach, src/game/throwreach.ts, ui/overlay.ts drawReach; the headless card is
// tools/qa/throwreach-check.ts, which cannot see the overlay): boot the page in headless Chromium on the software WebGPU adapter (hudmarks-page.cjs's
// recipe), start the plain night, aim a throw down the corridor and read the overlay's own paths.
//   frag    a frag in his hand: the kill ring and the wider hurt ring are drawn, the small ring (the rest mark) inside both, the hurt ring about twice the
//           kill ring's width (8 m to 4 m); no stun ring.
//   stun    a stun canister: the stun ring alone, the small ring inside it.
//   smoke   a smoke: no ring of reach.
//   off     the rings off (the debugger's box, as ?noreach): none drawn, the arc still up.
//   PORT=5231 node tools/qa/throwreach-page.cjs [--shots dir]       (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = all hold with no page error · 1 = otherwise.   SOFTWARE ADAPTER: this is the page's DOM over a software-rendered frame, not a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(3000000);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo`);
  const shot = async name => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
  const setup = await page.evaluate(async () => {
    await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5);
    const g = window.__game; g.godMode = true; g.infiniteAmmo = true;
    g.guards.forEach((gd, i) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; });
    const W = -Math.PI / 2, to = [19.5, 0, 11.2];
    window.__tr = {
      K: window.__knobs.registry(),
      aim: async (key, n) => { const cam = window.__cam, view = document.getElementById('view'); g.teleportPlayer([24, 0, 11.2]); g.player.char.bodyYaw = g.player.char.aimYaw = W; g.player.canisters = 3; g.player.flashbangs = 3; g.player.frags = 3;
        for (let i = 0; i < n; i++) { const [sx, sy] = cam.project(to, view.clientWidth, view.clientHeight); window.__mouse(sx, sy); if (i === 2 && key) window.__input.pressed.add(key); await window.__runFrames(1); } },
      read: () => { const box = cls => { const el = document.querySelector(`path.reach.${cls}`), d = el ? el.getAttribute('d') || '' : ''; if (!d) return null; const pts = d.split(/[MLZ]/).filter(t => t.trim()).map(p => p.trim().split(' ').map(Number)); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
          return { n: pts.length, pts, whole: d.endsWith('Z'), cut: el.classList.contains('cut'), fill: getComputedStyle(el).fill, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), stroke: getComputedStyle(el).stroke, dash: getComputedStyle(el).strokeDasharray }; };
        const ringEl = document.querySelector('circle.trajland:not(.trajtick)'); return { arc: !!g.player.throwPreview, slot: g.player.slot, ring: ringEl && ringEl.style.display !== 'none' ? [+ringEl.getAttribute('cx'), +ringEl.getAttribute('cy')] : null, kill: box('kill'), hurt: box('hurt'), stun: box('stun') }; },
    };
    return { fatal: document.getElementById('fatal')?.textContent || '', reach: window.__tr.K.THROWBACK.reach, rest: window.__tr.K.THROWBACK.restMark, frag: window.__tr.K.FRAG.on };
  });
  // (is the small ring inside the drawn ring? The camera looks down at a slant, so a ring on the floor is not centred on its own middle on the screen:
  //  what is asked is that the rest point is inside it, by the even-odd rule on the ring's own points)
  const near = (b, p) => { if (!b || !p) return false; let inside = false; for (let i = 0, j = b.pts.length - 1; i < b.pts.length; j = i++) { const [xi, yi] = b.pts[i], [xj, yj] = b.pts[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside; } return inside; };
  const say = b => b ? `${b.w.toFixed(0)}×${b.h.toFixed(0)} px${b.whole ? '' : ' (cut)'}` : 'none';
  // (each part says its line as it is read, and the whole run is kept near a hundred frames: on the software adapter the boot is three minutes and a frame is
  //  milliseconds until, some hundred and fifty frames into the night, something goes live that it cannot keep up with — a run that long stalls)
  const smoke = await page.evaluate(async () => { const T = window.__tr; await T.aim('Digit3', 24); return T.read(); }); await shot('reach-smoke');
  const okSmoke = smoke.arc && !smoke.kill && !smoke.hurt && !smoke.stun;
  console.log(`- ${okSmoke ? 'PASS' : 'FAIL'} — smoke: slot ${smoke.slot}, arc ${smoke.arc} · no ring of reach: ${!smoke.kill && !smoke.hurt && !smoke.stun}`);
  const frag = await page.evaluate(async () => { const T = window.__tr; await T.aim('Digit5', 30); return T.read(); }); await shot('reach-frag');
  const okFrag = !setup.fatal && setup.reach === true && frag.arc && !!frag.kill && !!frag.hurt && !frag.stun && near(frag.kill, frag.ring) && near(frag.hurt, frag.ring) && frag.kill.w > 40 && frag.hurt.w / frag.kill.w > 1.6 && frag.hurt.w / frag.kill.w < 2.6 && frag.hurt.dash !== 'none' && frag.kill.dash === 'none' && frag.kill.whole === !frag.kill.cut;
  console.log(`- ${okFrag ? 'PASS' : 'FAIL'} — frag: rings ${setup.reach}, slot ${frag.slot}, arc ${frag.arc} · kill ring ${say(frag.kill)}, hurt ring ${say(frag.hurt)} (${frag.kill && frag.hurt ? (frag.hurt.w / frag.kill.w).toFixed(2) : '?'}× as wide), stun ${say(frag.stun)} · the small ring inside each: ${near(frag.kill, frag.ring)} / ${near(frag.hurt, frag.ring)} · kill ${frag.kill ? frag.kill.stroke : ''} solid, hurt dashed '${frag.hurt ? frag.hurt.dash : ''}'`);
  const off = await page.evaluate(async () => { const T = window.__tr; T.K.THROWBACK.reach = false; await T.aim('', 6); const r = T.read(); T.K.THROWBACK.reach = true; await T.aim('', 6); return r; });
  const okOff = off.arc && !off.kill && !off.hurt && !off.stun;
  console.log(`- ${okOff ? 'PASS' : 'FAIL'} — off: arc ${off.arc} · kill ${say(off.kill)}, hurt ${say(off.hurt)}, stun ${say(off.stun)}`);
  const stun = await page.evaluate(async () => { const T = window.__tr; await T.aim('Digit4', 30); return T.read(); }); await shot('reach-stun');
  const okStun = stun.arc && !!stun.stun && !stun.kill && !stun.hurt && near(stun.stun, stun.ring) && stun.stun.w > 80;
  console.log(`- ${okStun ? 'PASS' : 'FAIL'} — stun: slot ${stun.slot}, arc ${stun.arc} · stun ring ${say(stun.stun)}, the small ring inside it: ${near(stun.stun, stun.ring)} · kill ${say(stun.kill)}`);
  await browser.close();
  if (errors.length) console.log(`- FAIL — page errors:\n    ${errors.slice(0, 5).join('\n    ')}`);
  const failed = !okFrag || !okOff || !okStun || !okSmoke || errors.length > 0;
  console.log(failed ? '=== throwreach-page: FAILED ===' : '=== throwreach-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
