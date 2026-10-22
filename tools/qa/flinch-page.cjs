// A ROUND GOES CLOSE TO A MAN, ON THE REAL PAGE (src/game/flinch.ts FLINCH, character.ts flinchFrom): boot the page in headless Chromium on the software
// WebGPU adapter (tools/qa/page-look.cjs's recipe), start the plain night with every guard parked blind and deaf, and
//   · put one of them six metres in front of Sam, bring the rifle up and fire one round past him, about 1.2 m beside his chest (the cursor well beyond him, so the aim does not take the man): as the page opens he ducks (the
//     animator's duck shows — the page runs the motion pass, which the frozen headless stand does not) and nothing else of him changes;
//   · then give a second guard his eyes back with Sam lit twelve metres in front of him, unable to be hurt, and let him shoot for ten seconds: a round of
//     his that misses close ducks the player's man, and a weapon change begun under that fire still finishes.
// Then the same page under ?flinch=0: the switch off, neither man ducks at anything, as it was.
//   PORT=5231 node tools/qa/flinch-page.cjs        (a dev server on that port: PORT=5231 bun run tools/serve.ts)        ONLY=on | off: that page alone
// exit 0 = both hold with no page error · 1 = otherwise.   The renderer is stubbed and the light meter is the script's (rules, not pixels): what this cannot
// say is how any of it LOOKS.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', ONLY = process.env.ONLY || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  let failed = false;
  for (const [name, q] of [['on', ''], ['off', 'flinch=0']].filter(([n]) => !ONLY || n === ONLY)) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 }); const errors = []; page.setDefaultTimeout(900000);
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&solo${q ? '&' + q : ''}`);
    const r = await page.evaluate(async () => {
      await window.__ready; window.__testVisible = true; window.__menu.close(); window.__smoke.params.enabled = false; window.__engine.render = () => {}; await window.__runFrames(5);
      const g = window.__game, pl = g.player, cam = window.__cam, view = document.getElementById('view'), T = window.__knobs.registry().FLINCH, P0 = [12, 0, 2], EAST = Math.PI / 2;
      g.godMode = true; g.infiniteAmmo = true;
      const park = (gd, i) => { gd.hold = true; gd.pinned = true; gd.dazzledUntil = 1e9; gd.heardUpTo = 1e12; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; };
      g.guards.forEach(park);
      g.teleportPlayer(P0); pl.char.bodyYaw = pl.char.aimYaw = EAST; cam.yaw = Math.PI; cam.rebuild(); await window.__runFrames(1);
      window.__input.pressed.add('Digit2'); await window.__runFrames(80);
      // ---- Sam's round past a guard
      const A = g.guards[0], c = A.char, keep = () => { c.pos = [P0[0] + 6, 0, P0[2]]; c.bodyYaw = c.aimYaw = -EAST; };
      const on = async each => { keep(); pl.visibility = 0.02; const C = c.bones.chest, [sx, sy] = cam.project([C[0] + 8, C[1], C[2] + 2.8], view.clientWidth, view.clientHeight); window.__mouse(sx, sy); await window.__runFrames(1); if (each) each(); };
      for (let i = 0; i < 130; i++) await on();
      const out = { fatal: '', on: !!(T && T.on), rifle: !!pl.rifleUp, state0: A.state, sup0: A.sup.v, guard: 0, rounds: 0, sup1: 0, state1: '', sam: 0, samRounds: 0, swapBegan: false, swapDone: false, swapCut: false, taken: false };
      const shots0 = pl.char === null ? 0 : (g.events ? g.events.length : 0);
      out.taken = g.aimGuard === A;
      window.__click(0); window.__input.buttons |= 1; await window.__runFrames(1); window.__input.buttons = 0;
      for (let i = 0; i < 40; i++) await on(() => { out.guard = Math.max(out.guard, c.anim.flinchShown); });
      out.sup1 = A.sup.v; out.state1 = A.state; out.rounds = (g.events ? g.events.length : 0) - shots0;
      // ---- a guard's rounds at Sam, who cannot be hurt
      park(A, 0); const B = g.guards[1], b = B.char, hold = () => { b.pos = [P0[0] + 12, 0, P0[2]]; b.bodyYaw = b.aimYaw = -EAST; };
      B.pinned = false; B.dazzledUntil = 0; B.heardUpTo = 0; hold(); const fired0 = B.weapon.shotsFired;
      for (let i = 0; i < 600; i++) {
        hold(); pl.visibility = 0.9; window.__mouse(view.clientWidth / 2, view.clientHeight / 2);
        if (i === 240) { window.__input.pressed.add('Digit1'); }   // (a weapon change begun under the fire)
        await window.__runFrames(1); out.sam = Math.max(out.sam, pl.char.anim.flinchShown);
        if (i > 240 && pl.char.anim.kitBusy) out.swapBegan = true;
        if (out.swapBegan && !out.swapDone && !pl.char.anim.kitBusy) { out.swapDone = true; out.swapCut = !pl.pistolUp; }
      }
      out.samRounds = B.weapon.shotsFired - fired0; out.fatal = document.getElementById('fatal')?.textContent || ''; return out;
    });
    const want = name === 'on', f = x => Number.isFinite(x) ? x.toFixed(3) : '—';
    const ok = !r.fatal && !errors.length && r.on === want && r.rifle && r.state0 === 'patrol' && r.state1 !== 'dead' && r.samRounds > 0
      && (want ? r.guard > 0.05 && r.sam > 0.02 : r.guard === 0 && r.sam === 0) && (!r.swapBegan || !r.swapCut);
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: switch ${r.on ? 'on' : 'off'} · Sam's rifle round about 1.2 m beside a calm man's chest${r.taken ? ' (THE AIM TOOK THE MAN)' : ''}: the duck shows ${f(r.guard)} of itself at most; it weighs ${f(r.sup1 - r.sup0)} on him and he is '${r.state1}' · a guard fires ${r.samRounds} rounds at Sam from twelve metres: Sam's own duck shows ${f(r.sam)} at most; the weapon change begun under it ${r.swapBegan ? (r.swapCut ? 'was CUT' : r.swapDone ? 'finished' : 'was still running') : 'was not seen'}${r.fatal ? ` · FATAL ${r.fatal}` : ''}${errors.length ? ` · ${errors.length} page error(s): ${errors[0]}` : ''}`);
    await page.close();
  }
  await browser.close();
  console.log(failed ? '=== flinch-page: FAILED ===' : '=== flinch-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
