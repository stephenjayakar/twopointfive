// THE STALK AND THE SNEAK LAB, ON THE REAL PAGE (src/game/stalk.ts STALK, src/host/sneaklab.ts): boot the lab's address in headless Chromium on the software
// WebGPU adapter (tools/qa/doorsolid-page.cjs's recipe) and, with real mouse and key events:
//   lab     the page is the lab: the level's six men, the stalk up, the panel open on the lab's system with a slider a number, empty hands.
//   key     0.8 m behind the man who stands, a tap of the interaction's keys (E, Space) grabs nobody, and the list says the click.
//   hold    2.6 m behind him, the left button pressed on him and kept down (the mouse's own events on the canvas): he is in Sam's arm inside six seconds.
//   let     the same, let go after two thirds of a second: nobody stalked, Sam at rest; pressed again: in his arm.
//   slider  the lab's first slider moved by its own input event writes the stalk's top speed.
//   dash    crouched, Shift and a move key held (the keyboard's own events): he stays down and goes at the fast crouch walk's pace, no sprint.
//   tapstep in the dark corridor a tap of a move key (the keyboard's own events) goes one short step and he stops dead.
//   look    2.2 m behind the man with the cursor elsewhere his head has the man; a metre off the man's side he leans away with the low arm out; the lab's button
//           stands two walkers a gap apart, and dead between them he is small and leans into neither.
//   (with the key the finish, stalk.ts `key`, as a plain address has it: `key` is that E takes him from in reach, and `hold` / `let` that the held button
//    brings him to a stop in reach with nobody grabbed, and E then takes him.)
// ONLY=nokey: the lab under ?stalkkey=0&stalklow=0 — the four scenes as written above.
// ONLY=polish: the lab under ?stalkpolish=0 — the polish's numbers are down and the held click still ends in the grab.
// ONLY=off: a plain night under ?stalk=0 instead — the switch is off, the list offers the grab on its key and the key grabs him.
//   PORT=5231 node tools/qa/stalk-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)     SHOT=<file.png>: one drawn frame of the lab kept
// exit 0 = all hold with no page error · 1 = otherwise.   What this cannot say: how any of it LOOKS or FEELS (the software adapter draws it; nobody plays it here).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OFF = process.env.ONLY === 'off', POLISH = process.env.ONLY === 'polish', NOKEY = process.env.ONLY === 'nokey', SHOT = process.env.SHOT || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
  page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
  await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&levelFile=sneak-lab.json&solo${OFF ? '&stalk=0' : '&sneaklab'}${POLISH ? '&stalkpolish=0' : ''}${NOKEY ? '&stalkkey=0&stalklow=0' : ''}`);
  const rows = []; const say = (ok, text) => { rows.push(ok); console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${text}`); };
  const boot = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); await window.__runFrames(5, 1 / 60, [], 'none');
    const g = window.__game, S = window.__knobs.registry().STALK; g.godMode = true; g.playerInvisible = true;
    return { fatal: document.getElementById('fatal')?.textContent || '', on: !!S.on, only: !!S.only, key: !!S.key, low: !!S.low, men: g.guards.filter(x => x.state !== 'dead' && !x.civ).length, holstered: !!g.player.holstered,
      sys: document.querySelector('#panel .prail .sys.on')?.getAttribute('title') || '', panel: !document.getElementById('panel').classList.contains('hidden'), sliders: document.querySelectorAll('#panel input[type=range]').length }; });
  /** Sam `gap` m dead behind the first man, crouched, hands empty; the frames run so the list is this frame's */
  const behind = gap => page.evaluate(async gap => { const g = window.__game, A = g.guards[0], yaw = A.char.bodyYaw; if (g.player.holding) { g.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); }
    const B = window.__game.guards[0]; window.__game.player.holstered = true; window.__game.teleportPlayer([B.char.pos[0] - Math.sin(B.char.bodyYaw) * gap, 0, B.char.pos[2] - Math.cos(B.char.bodyYaw) * gap]); window.__game.player.crouch = true;
    await window.__runFrames(20, 1 / 60, [], 'none'); }, gap);
  /** the first man's chest on the page, in the mouse's own coordinates */
  const chest = () => page.evaluate(() => { const g = window.__game, A = g.guards[0], v = document.getElementById('view'), r = v.getBoundingClientRect(), [x, y] = window.__cam.project([A.char.pos[0], 1.2, A.char.pos[2]], r.width, r.height); return [r.left + x, r.top + y]; });
  const frames = (n, until) => page.evaluate(async ([n, until]) => { const g = window.__game; let f = 0; for (; f < n; f++) { await window.__runFrames(1, 1 / 60, [], 'none'); if (until && g.player.holding) break;
      if (until === 'reach' && f > 30) { const c = g.player.char, A = g.guards[0].char.pos; if (Math.hypot(c.vel[0], c.vel[2]) < 0.02 && Math.hypot(c.pos[0] - A[0], c.pos[2] - A[2]) < 0.95) break; } }   // ('reach': …or he has come to a stop inside the grab's reach — the key the finish)
    const c = g.player.char; return { f, held: !!g.player.holding, speed: Math.hypot(c.vel[0], c.vel[2]), gap: Math.hypot(c.pos[0] - g.guards[0].char.pos[0], c.pos[2] - g.guards[0].char.pos[2]), list: g.nearby.map(r => Object.values(r).filter(v => typeof v === 'string').join(' ')).join(' | '), marks: g.interactables.filter(r => r.kind === 'guard' && r.guard === g.guards[0]).map(r => r.line2).join(' | '), page: document.body.innerText.replace(/\s+/g, ' ') }; }, [n, until]);
  const tap = async code => { await page.keyboard.down(code); await frames(3); await page.keyboard.up(code); await frames(20); };
  await page.evaluate(() => window.__runFrames(150, 1 / 60, [], 'none'));   // (the man who stands is on his mark)
  if (OFF) {
    say(!boot.fatal && !boot.on && boot.men === 11, `?stalk=0: the switch is ${boot.on ? 'ON' : 'off'}, ${boot.men} men`);
    await behind(0.8); const before = await frames(2); await tap('KeyE'); let r = await frames(40, true); if (!r.held) { await tap('Space'); r = await frames(40, true); }
    say(r.held && /grab him/.test(before.list), `0.8 m behind the man who stands the list offers the grab (${/grab him/.test(before.list)}) and its key takes him (${r.held})`);
  } else {
    say(!boot.fatal && boot.on && boot.only && boot.men === 11 && boot.holstered && boot.panel && /^Sneak lab/.test(boot.sys) && boot.sliders >= 12,
      `the lab: stalk ${boot.on ? 'on' : 'OFF'}, the click the only way ${boot.only}, ${boot.men} men, empty hands ${boot.holstered}, the panel ${boot.panel ? 'open' : 'SHUT'} on '${boot.sys.slice(0, 20)}' with ${boot.sliders} sliders${boot.fatal ? ' · FATAL ' + boot.fatal : ''}`);
    { // (the lab's knobs: named groups that fold, names that fit the row, and a hover on every row that says what to look for)
      const P = await page.evaluate(async () => { const pg = [...document.querySelectorAll('#panel .ppage')].find(p => p.offsetParent !== null) || document.getElementById('panel');
        const heads = [...pg.querySelectorAll('.psec > .pshead')], names = heads.map(h => h.querySelector('.nm')?.textContent || ''), shut = heads.filter(h => !h.classList.contains('open')).length;
        for (const h of heads) if (!h.classList.contains('open')) h.click(); await window.__runFrames(2, 1 / 60, [], 'none');
        const rows = [...pg.querySelectorAll('.row')].filter(r => r.querySelector('input')), cut = rows.map(r => r.querySelector('label')).filter(l => l && l.scrollWidth > l.clientWidth + 0.5).map(l => l.textContent);
        const bare = rows.filter(r => (r.title || '').length < (r.querySelector('label')?.textContent.length || 0) + 20).map(r => r.querySelector('label')?.textContent), tries = rows.filter(r => /Look for|Try:|Off = |0 = |1 = /.test(r.title || '')).length;
        return { names, shut, rows: rows.length, cut, bare, tries, headTips: heads.filter(h => (h.title || '').length > 10).length }; });
      say(P.names.length >= 10 && P.shut >= 5 && P.rows >= 60 && P.cut.length === 0 && P.bare.length === 0 && P.headTips >= 10 && P.tries >= P.rows * 0.6,
        `the lab's knobs are in ${P.names.length} groups (${P.shut} of them shut to begin with, ${P.headTips} with a hover of their own); of ${P.rows} rows, ${P.cut.length} have a name cut short${P.cut.length ? ' (' + P.cut.slice(0, 4).join(' · ') + ')' : ''}, ${P.bare.length} have no hover${P.bare.length ? ' (' + P.bare.slice(0, 4).join(' · ') + ')' : ''}, and ${P.tries} hovers say what to look for or what the ends mean`); }
    { // (stalk.ts STALK.drag, the lab's prototype: the press on him is the stick's middle; the real mouse is dragged toward him, then the lines below are run with it down)
      const dragUp = await page.evaluate(() => !!window.__knobs.registry().STALK.drag);
      if (dragUp && !NOKEY) {
        await behind(3.0); const [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const s0 = await frames(60);
        const [sx, sy] = await page.evaluate(() => { const g = window.__game, v = document.getElementById('view'), r = v.getBoundingClientRect(), [a, b] = window.__cam.project([g.player.char.pos[0], 0.6, g.player.char.pos[2]], r.width, r.height); return [r.left + a, r.top + b]; });
        const L = Math.hypot(x - sx, y - sy) || 1, full = await page.evaluate(() => window.__knobs.registry().STALK.dragFull);
        await page.mouse.move(x + (x - sx) / L * full, y + (y - sy) / L * full, { steps: 6 }); const s1 = await frames(45), stick = await page.evaluate(([x, y]) => { const I = window.__input, v = document.getElementById('view').getBoundingClientRect(); return Math.hypot(I.mouseX + v.left - x, I.mouseY + v.top - y); }, [x, y]); await page.mouse.move(x, y, { steps: 6 }); const s2 = await frames(40); await page.mouse.up(); await frames(5);
        say(Math.abs(s0.gap - 3.0) < 0.1 && s0.speed < 0.05 && s1.gap < s0.gap - 0.5 && s1.speed > 1 && s2.speed < 0.1, `the lab has drag to steer up: pressed on him 3 m behind, he holds still (${s0.gap.toFixed(2)} m, ${s0.speed.toFixed(2)} m/s); the mouse dragged toward him, he closes (${s1.gap.toFixed(2)} m, ${s1.speed.toFixed(2)} m/s, the game read the stick ${stick.toFixed(0)} px of ${full}); back to the press, he stops (${s2.speed.toFixed(2)} m/s)`);
        await page.evaluate(() => { window.__knobs.registry().STALK.drag = false; });   // (the lines below are the hold's own)
      } else { say(NOKEY && dragUp, `?stalkkey=0&stalklow=0: the lab still has drag to steer up (${dragUp}); it is put down for the lines below`); await page.evaluate(() => { window.__knobs.registry().STALK.drag = false; }); }
    }
    { // (stalk.ts STALK.orbit: the real button held on him and a real move key down — the one that takes him most round the man, of the four)
      const orbitUp = await page.evaluate(() => !!window.__knobs.registry().STALK.orbit);
      const pose = () => page.evaluate(() => { const g = window.__game, c = g.player.char, A = g.guards[0].char; const dx = c.pos[0] - A.pos[0], dz = c.pos[2] - A.pos[2], to = Math.atan2(-dx, -dz), f = Math.atan2(Math.sin(c.aimYaw - to), Math.cos(c.aimYaw - to));
        return { gap: Math.hypot(dx, dz), round: Math.atan2(dx, dz), face: Math.abs(f) * 180 / Math.PI }; });
      let best = null; const all = [];
      for (const code of ['KeyA', 'KeyD', 'KeyW', 'KeyS']) {
        await behind(1.6); const [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); await frames(20); const p0 = await pose();
        await page.keyboard.down(code); let most = 0; for (let i = 0; i < 6; i++) { await frames(8); const q = await pose(); most = Math.max(most, Math.abs(q.gap - p0.gap)); }
        const p1 = await pose(); await page.keyboard.up(code); await page.mouse.up(); await frames(10);
        const turned = Math.abs(Math.atan2(Math.sin(p1.round - p0.round), Math.cos(p1.round - p0.round))) * 180 / Math.PI;
        const r = { code, turned, most, face: p1.face, g0: p0.gap }; all.push(`${code} ${turned.toFixed(0)}° ±${most.toFixed(2)} m`);
        if (!best || (turned > 20) > (best.turned > 20) || ((turned > 20) === (best.turned > 20) && most < best.most)) best = r;   // (of the keys that take him round, the one with the clearest floor: the lab's furniture is near the man)
      }
      if (orbitUp) say(best.turned > 20 && best.most < 0.08 && best.face < 30, `a plain address has the keys go round him: the button held on him 1.6 m behind and ${best.code} down for 0.8 s takes Sam ${best.turned.toFixed(0)}° round him, the gap at most ${best.most.toFixed(2)} m off ${best.g0.toFixed(2)} m, facing him within ${best.face.toFixed(0)}° (the four keys: ${all.join(' · ')})`);
      else say(false, `the keys going round him is down on this address (${orbitUp})`);
    }
    { const v = await page.evaluate(() => { const R = window.__knobs.registry(), S = R.STALK, H = R.HOLD; return { jolt: S.jolt, turnIn: S.turnIn, show: S.cornerShow, way: H.wayShape, dip: H.lunge.dip, apart: H.apart.side }; }), up = v.jolt > 0 && v.turnIn && v.show && v.way && v.dip > 0 && v.apart > 0, down = v.jolt === 0 && !v.turnIn && !v.show && !v.way && v.dip === 0 && v.apart === 0;
      say(POLISH ? down : up, `${POLISH ? '?stalkpolish=0: the polish is down' : 'a plain address: the polish is up'} (the duck ${v.jolt}, the turn through the step ${v.turnIn}, the wait's pose ${v.show}, the shaped way in ${v.way}, the dip ${v.dip}, the heads apart ${v.apart})`); }
    say(boot.key === !NOKEY && boot.low === !NOKEY, `${NOKEY ? '?stalkkey=0&stalklow=0: both are down' : 'a plain address: the key finishes the grab and he goes lower'} (the key ${boot.key}, lower ${boot.low})`);
    if (boot.key) {   // (stalk.ts `key`: the held click brings him in and stops; the interaction's key is the grab)
      await behind(0.85); await page.evaluate(() => window.__runFrames(1)); const before = await frames(0); await tap('KeyE'); const k = await frames(30, true);
      say(k.held && /grab him/.test(before.list), `0.85 m behind him the man's row offers the grab (${/grab him/.test(before.list)}), and a tap of E takes him (in his arm ${k.held})`);
      await behind(3.0); const farRow = await frames(2); await behind(1.8); const nearRow = await frames(2);   // (the one line that says what the click does, out to where a press begins it)
      say(/hold to sneak up on him/.test(farRow.marks) === boot.low && /hold to sneak up on him/.test(nearRow.marks) && !/grab him/.test(nearRow.list), `the line over the man, 'hold to sneak up on him', is there 3 m behind him (past the rows' 2.4 m) (${/hold to sneak up on him/.test(farRow.marks)}, with the lower creep ${boot.low}) and 1.8 m behind him (${/hold to sneak up on him/.test(nearRow.marks)}), where no row grabs yet`);
      if (SHOT) { await page.evaluate(() => window.__runFrames(1)); await page.screenshot({ path: SHOT }); }
      const from = boot.low ? 3.0 : 2.2; await behind(from); let [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const h = await frames(900, 'reach'), w = await frames(60, true); await tap('KeyE'); const e = await frames(40, true); await page.mouse.up();   // (a TAP: the key held past a tap opens his own ring instead) await frames(5);
      say(!h.held && !w.held && w.gap < 0.95 && w.speed < 0.02 && e.held, `${from} m behind him, the left button pressed on him and kept down: after ${(h.f / 60).toFixed(2)} s he has stopped ${w.gap.toFixed(2)} m behind him and a second on nobody is grabbed (in his arm ${h.held || w.held}); E then: in his arm ${e.held}`);
      await behind(2.6); [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const a = await frames(40, true); await page.mouse.up(); const b = await frames(40);
      await page.mouse.down(); const c = await frames(600, 'reach'); await tap('KeyE'); const c2 = await frames(40, true); await page.mouse.up(); await frames(5);
      say(!a.held && a.gap < 2.5 && !b.held && b.speed < 0.02 && !c.held && c2.held, `let go after two thirds of a second (${a.gap.toFixed(2)} m off, closing): at rest ${b.speed.toFixed(2)} m/s with nobody in his arm; pressed again he comes in to ${c.gap.toFixed(2)} m, and E: in his arm ${c2.held}`);
    } else {
      // (one DRAWN frame before the page is read: the corner's rows are written by the draw)
      await behind(0.8); await page.evaluate(() => window.__runFrames(1)); const before = await frames(0); await tap('KeyE'); await tap('Space'); const k = await frames(30, true);
      say(!k.held && /hold to grab him/.test(before.list) && /hold to grab him/i.test(before.page), `0.8 m behind him a tap of E and of Space grabs nobody (in his arm ${k.held}), the man's rows say the click (${/hold to grab him/.test(before.list)}) and so does the page (${/hold to grab him/i.test(before.page)})`);
      if (SHOT) { await page.evaluate(() => window.__runFrames(1)); await page.screenshot({ path: SHOT }); }
      await behind(2.6); let [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const h = await frames(360, true); await page.mouse.up(); await frames(5);
      say(h.held, `2.6 m behind him, the left button pressed on him and kept down: ${h.held ? `in his arm after ${(h.f / 60).toFixed(2)} s` : `never grabbed (still ${h.gap.toFixed(2)} m off)`}`);
      await behind(2.6); [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down(); const a = await frames(40, true); await page.mouse.up(); const b = await frames(40);
      await page.mouse.down(); const c = await frames(360, true); await page.mouse.up(); await frames(5);
      say(!a.held && a.gap < 2.5 && !b.held && b.speed < 0.02 && c.held, `let go after two thirds of a second (${a.gap.toFixed(2)} m off, closing): at rest ${b.speed.toFixed(2)} m/s with nobody in his arm; pressed again: in his arm ${c.held}`);
    }
    { // (close.ts CLOSE.rmbHold: the right button kept down behind him is the choke, let go it is a hold; a tap is the knockout)
      const rmb = await page.evaluate(() => !!window.__knobs.registry().CLOSE.rmbHold), phase = () => page.evaluate(() => window.__game.player.holding?.phase ?? 'nobody');
      if (rmb) {
        await behind(0.85); let [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); const rows = await frames(0);
        await page.mouse.down({ button: 'right' }); await frames(75); const p1 = await phase(); await page.mouse.up({ button: 'right' }); await frames(40); const p2 = await phase();
        say(/RMB {2}hold to choke him/.test(rows.list) && p1 === 'choke' && p2 === 'held', `0.85 m behind him the row says the held right button chokes (${/RMB {2}hold to choke him/.test(rows.list)}); the right button kept down for a second and a quarter: ${p1}; let go: ${p2}`);
        await behind(0.85); [x, y] = await chest(); await page.mouse.move(x, y); await frames(2); await page.mouse.down({ button: 'right' }); await frames(3); await page.mouse.up({ button: 'right' }); const t = await frames(60);
        const down = await page.evaluate(() => window.__game.guards[0].state === 'dead');
        say(!t.held && down, `a quick right click from the same spot: in his arm ${t.held}, the man down a second later ${down}`);
        await page.evaluate(async () => { window.__game.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); });
      }
    }
    { const sf = await page.evaluate(() => { const H = window.__knobs.registry().HOLD, b = /gun out before the arm/.test(document.getElementById('panel').textContent); return { on: !!H.stripFirst, dis: !!H.disarm, take: H.first?.take, row: b }; });   // (disarm.ts HOLD.stripFirst)
      say(sf.on && sf.dis && sf.take < 0.2 && sf.row, `a plain address: the disarm leads the grab (the key ${sf.on}, under the disarm ${sf.dis}, the gun out at ${sf.take} s) and the lab has its row (${sf.row})`); }
    { const sw = await page.evaluate(() => { const T = window.__knobs.registry().STALK, b = [...document.querySelectorAll('#panel label')].some(l => l.textContent.trim() === 'arms out'); return { on: !!T.wide, low: !!T.low, out: T.wideOut, lead: T.wideLead, row: b }; });   // (stalk.ts STALK.wide)
      say(sw.on && sw.low === !NOKEY && sw.out > 0 && sw.out < 0.2 && sw.lead > 0 && sw.row, `${NOKEY ? '?stalklow=0' : 'a plain address'}: his arms are out as he creeps (the key ${sw.on}, under the low creep ${sw.low}, ${sw.out} m out, the left ${sw.lead} m ahead) and the lab has its row (${sw.row})`); }
    { // (player.ts CROUCHRUN, samlook.ts SAMLOOK: Shift in a crouch is a fast crouch walk; his head goes to the man; beside a man he gives him room)
      const K = await page.evaluate(() => { const R = window.__knobs.registry(); return { run: !!R.CROUCHRUN.on, look: !!R.SAMLOOK.on, slip: !!R.SAMLOOK.slip, pace: R.CROUCHRUN.pace }; });
      if (K.run) {
        await page.evaluate(async () => { window.__game.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); window.__game.player.holstered = true; window.__game.player.crouch = true; await window.__runFrames(10, 1 / 60, [], 'none'); });
        let best = { v: 0, down: false, dash: false, spr: false };
        for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {   // (whichever way the lab's floor is open from where he starts)
          await page.keyboard.down('ShiftLeft'); await page.keyboard.down(code);
          const r = await page.evaluate(async () => { const g = window.__game; let v = 0, down = true, dash = false, spr = false; for (let f = 0; f < 50; f++) { await window.__runFrames(1, 1 / 60, [], 'none'); const c = g.player.char; v = Math.max(v, Math.hypot(c.vel[0], c.vel[2])); down = down && g.player.crouch; dash = dash || g.player.dash; spr = spr || g.player.sprinting; } return { v, down, dash, spr }; });
          await page.keyboard.up(code); await page.keyboard.up('ShiftLeft'); await frames(20); if (r.v > best.v) best = r; if (best.v > 2.2) break;
        }
        say(best.down && best.dash && !best.spr && best.v > 2.2 && best.v < K.pace + 0.2, `crouched with Shift and a move key held: still down ${best.down}, the fast crouch walk ${best.dash}, a sprint ${best.spr}, up to ${best.v.toFixed(2)} m/s (its pace ${K.pace})`);
      }
      if (K.look) {
        await page.evaluate(async () => { window.__game.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); });
        await behind(2.2);
        { const [mx, my] = await page.evaluate(() => { const g = window.__game, c = g.player.char.pos, A = g.guards[0].char.pos, a = Math.atan2(A[0] - c[0], A[2] - c[2]) + 1.0, v = document.getElementById('view'), r = v.getBoundingClientRect(), [x, y] = window.__cam.project([c[0] + Math.sin(a) * 3, 1.2, c[2] + Math.cos(a) * 3], r.width, r.height); return [r.left + x, r.top + y]; });
          await page.mouse.move(Math.max(20, Math.min(1260, mx)), Math.max(20, Math.min(700, my))); await frames(70); }   // (the cursor about a radian off the man's line: the aim is not on him)
        const L = await page.evaluate(() => { const g = window.__game, an = g.player.char.anim; return { w: an.watchShown.w, at: !!an.watchAt }; });
        say(L.at && L.w > 0.5, `2.2 m behind the man with the cursor a radian off his line: his head has the man (a point to watch ${L.at}, the look ${L.w.toFixed(2)} of whole)`);
        if (K.slip) {
          await page.evaluate(async () => { const g = window.__game, B = g.guards[0], y = B.char.bodyYaw; g.player.holstered = true; g.teleportPlayer([B.char.pos[0] + Math.cos(y) * 1.0, 0, B.char.pos[2] - Math.sin(y) * 1.0]); g.player.crouch = true; await window.__runFrames(60, 1 / 60, [], 'none'); });
          const P = await page.evaluate(() => { const an = window.__game.player.char.anim; return { slip: an.watchShown.slip, at: !!an.slipAt }; });
          say(P.at && P.slip > 0.5, `a metre off the man's side, crouched with empty hands: he gives the man room (${P.at}, the lean ${P.slip.toFixed(2)} of whole)`);
        }
        if (K.slip) {   // (the lab's own button: two walkers stood a gap apart, and Sam dead between them)
          const G = await page.evaluate(async () => { const b = [...document.querySelectorAll('#panel button')].find(x => /two men, a gap/.test(x.textContent)); if (!b) return { found: false };
            window.__game.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); b.click(); await window.__runFrames(150, 1 / 60, [], 'none');
            const g = window.__game, [A, B] = g.guards.filter(x => x.state !== 'dead' && !x.civ).slice(1, 3), a = A.char, c = B.char, apart = Math.hypot(a.pos[0] - c.pos[0], a.pos[2] - c.pos[2]), still = Math.hypot(a.vel[0], a.vel[2]) + Math.hypot(c.vel[0], c.vel[2]);
            const turn = Math.abs(Math.atan2(Math.sin(a.bodyYaw - c.bodyYaw), Math.cos(a.bodyYaw - c.bodyYaw)));
            g.player.holstered = true; g.teleportPlayer([(a.pos[0] + c.pos[0]) / 2, 0, (a.pos[2] + c.pos[2]) / 2]); g.player.crouch = true; await window.__runFrames(80, 1 / 60, [], 'none');
            const an = g.player.char.anim; return { found: true, apart, still, turn, slip: an.watchShown.slip, lean: an.watchShown.lean }; });
          say(G.found && Math.abs(G.apart - 2.4) < 0.3 && G.still < 0.05 && G.turn < 0.5 && G.slip > 0.8 && G.lean < 0.35, G.found ? `the lab's 'stand two men a gap apart': two walkers stand ${G.apart.toFixed(2)} m apart, at rest (${G.still.toFixed(2)} m/s), facing within ${(G.turn * 57.3).toFixed(0)}° of each other; Sam dead between them is small (${G.slip.toFixed(2)}) with ${G.lean.toFixed(2)} of the lean left` : `the lab has no 'stand two men a gap apart' button`);
        }
        await page.evaluate(async () => { window.__game.restart(); await window.__runFrames(90, 1 / 60, [], 'none'); });
      }
    }
    const s = await page.evaluate(() => { const S = window.__knobs.registry().STALK, was = S.pace, el = [...document.querySelectorAll('#panel .row')].find(r => /top speed/.test(r.textContent))?.querySelector('input[type=range]'); if (!el) return { was, now: was, found: false };
      el.value = '1.2'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); const now = S.pace; S.pace = was; return { was, now, found: true }; });
    say(s.found && Math.abs(s.now - 1.2) < 1e-6, `the lab's 'top speed' slider moved to 1.2 writes the stalk's top speed (${s.was} → ${s.now})`);
    { // (src/host/sneaklab.ts SCENES: the five buttons, each putting Sam at its own start and the line at the top of the page to its own; SHOTS=<dir> keeps a picture of each)
      const names = ['man standing', 'man walking', 'dark room', 'dark corridor', 'corner'], got = [];
      for (const name of names) {
        got.push(await page.evaluate(async n => { const b = [...document.querySelectorAll('#panel button')].find(x => x.textContent.trim() === n); if (!b) return null; b.click(); await window.__runFrames(40, 1 / 60, [], 'none');
          const g = window.__game, p = g.player.char.pos; return { at: `${p[0].toFixed(1)},${p[2].toFixed(1)}`, line: g.objectiveText(), seen: !g.playerInvisible, bare: !!g.player.holstered, low: !!g.player.crouch }; }, name));
        if (process.env.SHOTS) { await page.evaluate(() => window.__runFrames(4, 1 / 60, [], true)); await page.screenshot({ path: `${process.env.SHOTS}/${name.replace(/ /g, '-')}.png` }); }
      }
      const ok = got.every(Boolean), seen = ok ? got.map(c => c.seen) : [];
      say(ok && new Set(got.map(c => c.at)).size === 5 && new Set(got.map(c => c.line)).size === 5 && got.every(c => c.bare && c.low) && seen.join() === 'false,false,true,true,false',
        `the lab's five scenario buttons each put Sam at his own start, hands empty and low, with their own line, and only the dark ones let the men see him (${ok ? got.map(c => c.at).join(' · ') : 'a button is missing'})`);
    }
    { // (src/game/tapstep.ts: the keyboard's own events in the dark corridor; a move key is a step, and between steps he stands)
      await page.evaluate(async () => { [...document.querySelectorAll('#panel button')].find(x => x.textContent.trim() === 'dark corridor').click(); await window.__runFrames(60, 1 / 60, [], 'none'); });
      const at = () => page.evaluate(() => { const g = window.__game, c = g.player.char; return { x: c.pos[0], z: c.pos[2], v: Math.hypot(c.vel[0], c.vel[2]) }; }); let best = 0, stopped = false;
      for (const code of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) { const a = await at(); await page.keyboard.down(code); await frames(4); await page.keyboard.up(code); await frames(50); const b = await at(), d = Math.hypot(b.x - a.x, b.z - a.z); if (d > best) { best = d; stopped = b.v < 0.01; } if (best > 0.2) break; }
      say(best > 0.2 && best < 0.45 && stopped, `in the dark corridor a tap of a move key is one short step and he stops dead (${best.toFixed(2)} m)`);
    }
  }
  if (errors.length) { rows.push(false); console.log(`- FAIL — page errors: ${errors.join(' | ')}`); }
  await browser.close();
  const failed = rows.some(r => !r);
  console.log(failed ? '=== stalk-page: FAILED ===' : '=== stalk-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
