// THE BARRED AIM RING AND THE THROW'S REST MARK, ON THE REAL PAGE (GUNWALL.mark, player.ts gunShut · THROWBACK.restMark, player.ts throwRest; the headless
// cards are tools/qa/leangun-check.ts and tools/qa/throwrest-check.ts, which cannot see the overlay): boot the page in headless Chromium on the software
// WebGPU adapter (tools/qa/page-look.cjs's recipe), start the plain night, and read the overlay's own elements.
//   ring   the rifle in his hands beside the conference doorway's jamb on its side, the cursor on a point in the room: the gun is held down and the ring (or,
//          with the ring busy on the door, the gun's own small circle) wears the bar, drawn (its ::after has a box); with the mark off it does not; stood in
//          the middle of the doorway it does not.
//   rest   a smoke in his hand, the cursor four metres down the corridor: the preview's ring is on the point throwRest gives, well past the arc's end, the
//          tick is on the arc's end and the dotted roll is drawn; with the mark off the ring is on the arc's end and neither tick nor roll shows.
//   PORT=5231 node tools/qa/hudmarks-page.cjs [--shots dir]       (a dev server on that port: PORT=5231 bun run tools/serve.ts)
// exit 0 = both hold with no page error · 1 = otherwise.   SOFTWARE ADAPTER: this is the page's DOM over a software-rendered frame, not a GPU.
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
    window.__hm = {
      K: window.__knobs.registry(),
      at: async (x, z, yaw, to, n) => { const cam = window.__cam, view = document.getElementById('view'); g.teleportPlayer([x, 0, z]); g.player.char.bodyYaw = g.player.char.aimYaw = yaw;
        for (let i = 0; i < n; i++) { const [sx, sy] = cam.project(to, view.clientWidth, view.clientHeight); window.__mouse(sx, sy); await window.__runFrames(1); } },
      ring: () => { const r = document.querySelector('.reticle'), w = document.querySelector('.aimwish'), el = r && /\bshut\b/.test(r.className) && r.style.display !== 'none' ? r : w && /\bshut\b/.test(w.className) && w.style.display !== 'none' ? w : null;
        const a = el ? getComputedStyle(el, '::after') : null; return { reticle: r ? r.className + '|' + r.style.display : '', wish: w ? w.className + '|' + w.style.display : '', barred: !!el, on: el === r ? 'ring' : el ? 'gun circle' : '', bar: a ? `${a.content} ${a.width} x ${a.height} ${a.backgroundColor}` : '',
          stance: g.player.char.anim.longStance, at: el ? [el.getBoundingClientRect().x, el.getBoundingClientRect().y] : null }; },
    };
    return { fatal: document.getElementById('fatal')?.textContent || '', mark: window.__hm.K.GUNWALL.mark, wall: window.__hm.K.GUNWALL.on, rest: window.__hm.K.THROWBACK.restMark, lean: window.__hm.K.WALLSNAP.leanGun };
  });
  const ring = await page.evaluate(async () => {
    const H = window.__hm, g = window.__game, S = Math.PI, into = x => [x, 1.2, 6.5];
    await H.at(10.3, 10.62, S, into(10.3), 2); window.__input.pressed.add('Digit2'); await H.at(10.3, 10.62, S, into(10.3), 70);
    const a = H.ring(); return { a, rifle: !!g.player.rifleUp };
  });
  await shot('ring-barred');
  const ring2 = await page.evaluate(async () => {
    const H = window.__hm, S = Math.PI, into = x => [x, 1.2, 6.5];
    H.K.GUNWALL.mark = false; await H.at(10.3, 10.62, S, into(10.3), 3); const off = H.ring(); H.K.GUNWALL.mark = true;
    await H.at(9.75, 10.62, S, into(9.75), 30); const mid = H.ring(); return { off, mid };
  });
  await shot('ring-plain');
  const rest = await page.evaluate(async () => {
    const H = window.__hm, g = window.__game, cam = window.__cam, view = document.getElementById('view'), W = -Math.PI / 2, to = [20, 0, 11.2];
    g.player.canisters = 3; await H.at(24, 11.2, W, to, 2); window.__input.pressed.add('Digit3'); await H.at(24, 11.2, W, to, 45);
    const read = () => { const pv = g.player.throwPreview, ringEl = document.querySelector('circle.trajland:not(.trajtick)'), tick = document.querySelector('circle.trajtick'), roll = document.querySelector('polyline.trajroll');
      const land = pv ? cam.project(pv.land, view.clientWidth, view.clientHeight) : null;
      return { arc: !!pv, ring: ringEl && ringEl.style.display !== 'none' ? [+ringEl.getAttribute('cx'), +ringEl.getAttribute('cy')] : null, land: land ? [land[0], land[1]] : null,
        tick: tick && tick.style.display !== 'none' ? [+tick.getAttribute('cx'), +tick.getAttribute('cy')] : null, roll: roll && roll.style.display !== 'none' ? (roll.getAttribute('points') || '').split(' ').length : 0, landW: pv ? pv.land : null }; };
    const on = read(); H.K.THROWBACK.restMark = false; await H.at(24, 11.2, W, to, 20); const off = read(); H.K.THROWBACK.restMark = true; await H.at(24, 11.2, W, to, 20);
    return { on, off, slot: g.player.slot };
  });
  await shot('rest-mark');
  await browser.close();
  const d = (a, b) => a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : NaN;
  const okRing = !setup.fatal && setup.mark === true && setup.wall === true && ring.rifle && ring.a.barred && /none|^$/.test(ring.a.bar) === false && ring.a.stance === 'lowLong' && !ring2.off.barred && !ring2.mid.barred;
  console.log(`- ${okRing ? 'PASS' : 'FAIL'} — ring: mark ${setup.mark}, rule ${setup.wall} · rifle ${ring.rifle}, ${ring.a.stance} · beside the jamb the ${ring.a.on || 'ring'} is ${ring.a.barred ? 'barred' : 'NOT barred'} (its bar: ${ring.a.bar || 'none'}) · mark off: ${ring2.off.barred ? 'BARRED' : 'plain'} · mid doorway: ${ring2.mid.barred ? 'BARRED' : 'plain'}\n    reticle '${ring.a.reticle}' · gun circle '${ring.a.wish}'`);
  const okRest = setup.rest === true && rest.on.arc && !!rest.on.ring && d(rest.on.ring, rest.on.land) > 30 && d(rest.on.tick, rest.on.land) < 2 && rest.on.roll > 2 && !!rest.off.ring && d(rest.off.ring, rest.off.land) < 2 && !rest.off.tick && rest.off.roll === 0;
  console.log(`- ${okRest ? 'PASS' : 'FAIL'} — rest: mark ${setup.rest} · slot ${rest.slot}, arc ${rest.on.arc} · the ring is ${d(rest.on.ring, rest.on.land).toFixed(0)} px past the arc's end, the tick ${d(rest.on.tick, rest.on.land).toFixed(1)} px from it, ${rest.on.roll} points of roll drawn · mark off: the ring ${d(rest.off.ring, rest.off.land).toFixed(1)} px from the arc's end, tick ${rest.off.tick ? 'SHOWN' : 'hidden'}, roll ${rest.off.roll}`);
  if (errors.length) console.log(`- FAIL — page errors:\n    ${errors.slice(0, 5).join('\n    ')}`);
  const failed = !okRing || !okRest || errors.length > 0;
  console.log(failed ? '=== hudmarks-page: FAILED ===' : '=== hudmarks-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
