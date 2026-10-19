// EACH GUN ITS OWN LOOK ON THE REAL PAGE (src/game/gunlook.ts GUNLOOK, src/game/gunreload.ts): headless Chromium on the software WebGPU adapter
// (tools/qa/bigslot-page.cjs's recipe), a kit planted in the store that hands the six guns out over a team of four — you the Mk 46 and the Glock 18, the
// three teammates the Mk 12, the MP7 and the M1014 with an HK45 or a Glock 18 behind each.
//   PORT=5243 node tools/qa/gunlook-page.cjs [outDir]        (a dev server on that port: PORT=5243 bun run tools/serve.ts)
//   on     the page opens with the switch on: every man's figure is told his gun's model, his muzzle is that model's; you fire a round and change the belt
//          — the feed cover is up inside the change, the gun is full after it — and half a second of play draws with no page error
//   off    the same page with ?nogunlook: the switch off, no figure told anything, the same play with no page error
//   shells the shells key (GUNLOOK.shells) with the M1014 in YOUR hands: one shell and a whole tube each take their own time, the trigger breaks the
//          feeding off and fires; the same page with ?nogunshells: one shell takes the row's whole length again
// exit 0 = both, with no page error · 1 = otherwise. ONLY=on|off|shells runs one. STILLS=1 with an outDir: each man close, and you with the cover up — minutes
// each on the SOFTWARE adapter, and the mission is at night: they show that the frame draws, little of a gun (tools/qa/gunlook-sheet.ts is the picture).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', ONLY = process.env.ONLY || '', STILLS = process.env.STILLS === '1';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const man = (primary, secondary) => ({ weapon: 'rifle', suppressed: true, primary, secondary, smoke: 0, bangs: 1, frags: 0, shells: 0, charges: 0, walls: 0, big: 'none' });
const KIT = JSON.stringify({ v: 2, own: true, members: [man('mk46', 'g18'), man('mk12', 'hk45'), man('mp7', 'g18'), man('m1014', 'hk45'), man('mk18', 'g19')] });
const WANT = { you: 'mk46', mates: ['mk12', 'mp7', 'm1014'] };
const KIT_TUBE = JSON.stringify({ v: 2, own: true, members: [man('m1014', 'hk45'), man('mk12', 'hk45'), man('mp7', 'g18'), man('mk46', 'g18'), man('mk18', 'g19')] });
if (OUT) fs.mkdirSync(OUT, { recursive: true });
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
const DRAW = async (n) => {
  const dev = window.__engine.device, yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { window.__runFrames(1, 1 / 2000); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return { err: 'no frame' };
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h; c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return { w: fr.w, h: fr.h, url: c2.toDataURL('image/png') };
};
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS }); let failed = false;
  const line = (ok, label, detail) => { if (!ok) failed = true; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log('\n=== gunlook-page: on the real page every man is drawn as the gun his card hands him; with ?nogunlook nobody is ===');
  const open = async (q, kit = KIT) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|smoke|storage textures/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    await page.addInitScript(k => { try { localStorage.setItem('twopointsix.kit', k); } catch { } }, kit);
    await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&squad4=17&nocutboxes${q}`, { timeout: 600000 });
    const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return document.getElementById('fatal')?.textContent || ''; });
    if (fatal) errors.push('fatal: ' + fatal);
    await page.evaluate(() => { window.__glStep = (n, keys) => { const e = window.__engine, real = e.render; e.render = () => { e.world.upload(); }; try { window.__runFrames(n, 1 / 60, keys || []); } finally { e.render = real; } };
      window.__smoke.params.enabled = false; const g = window.__game; g.aiEnabled = false; g.godMode = true; });
    return { page, errors };
  };
  const still = async (page, name, who, dist = 2.4, yaw = 0.6) => { if (!OUT || !STILLS) return;
    await page.evaluate(({ who, dist, yaw }) => { const g = window.__game, c = who < 0 ? g.player.char : g.guards.filter(x => x.unit && x.team === 'operative')[who].char; window.__stage({ look: [c.pos[0], 1.0, c.pos[2]], yaw: Math.atan2(c.forward()[0], c.forward()[2]) + yaw, pitch: 0.7, dist }, {}); }, { who, dist, yaw });
    const cap = await page.evaluate(DRAW, 3); if (cap.url) fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(cap.url.split(',')[1], 'base64')); log('still', name, cap.err || `${cap.w}x${cap.h}`); };
  const look = () => { const g = window.__game, pl = g.player; pl.slot = 'rifle'; pl.holstered = false; window.__glStep(45);
    const mates = g.guards.filter(x => x.unit && x.team === 'operative');
    return { knob: window.__knobs?.registry?.().GUNLOOK?.on, you: { gun: pl.rifle.def.id, side: pl.pistol.def.id, look: pl.char.gunLook ? { ...pl.char.gunLook } : null, ahead: +pl.char.muzzleAhead.toFixed(3), up: pl.rifleUp },
      mates: mates.map(m => ({ gun: m.weapon.def.id, side: m.second?.gun?.def?.id ?? null, look: m.char.gunLook ? { ...m.char.gunLook } : null, ahead: +m.char.muzzleAhead.toFixed(3) })) }; };
  // a round out of the belt gun, then the belt changed: the cover's lift at its most inside the change, the gun's books after it
  const feed = () => { const g = window.__game, pl = g.player, an = pl.char.anim, w = pl.rifle; const full = w.def.magCapacity;
    const ev0 = g.events.length; window.__mouse(900, 300); window.__glStep(20); let after = w.mag + w.chamber; for (let k = 0; k < 4 && after > full; k++) { window.__click(0); window.__glStep(12); after = w.mag + w.chamber; }
    const shots = g.events.slice(ev0).filter(e => e.kind === 'shot').length;
    w.mag = 0; w.chamber = 0; window.__input.pressed.add('KeyR'); window.__glStep(1, ['KeyR']); let fed = null, frames = 0;
    for (let f = 0; f < 60 * 9 && (w.reloading || f < 5); f++) { window.__glStep(1); frames++; fed = fed ?? an.feed; }
    return { full, after, shots, fed, frames, mag: w.mag + w.chamber, reloading: !!w.reloading, dur: w.def.reload.dur }; };
  // the M1014 in your hands, by the shell: one shell into a gun one short, a whole tube from empty, then the trigger pressed with one shell in and two to go
  const shells = () => { const g = window.__game, pl = g.player, w = pl.rifle, an = pl.char.anim; pl.slot = 'rifle'; pl.holstered = false; window.__mouse(900, 300); window.__glStep(45);
    const set = (tube, ch) => { w.cancelReload(); an.cancelReload(); w.mag = tube; w.chamber = ch; window.__glStep(2); window.__input.pressed.add('KeyR'); let f = 0; for (; f < 90 && !w.reloading; f++) window.__glStep(1, f ? [] : ['KeyR']); };
    const run = (tube, ch) => { set(tube, ch); const t0 = g.time; let steps = 0, was = w.mag + w.chamber; for (let f = 0; f < 600 && w.reloading; f++) { window.__glStep(1); const r = w.mag + w.chamber; if (r !== was) { steps++; was = r; } }
      return { secs: +(g.time - t0).toFixed(2), rounds: w.mag + w.chamber, steps }; };
    const one = run(6, 1), all = run(0, 0);
    set(4, 1); window.__glStep(50); const mid = w.mag + w.chamber, shots0 = w.shotsFired; window.__click(0); window.__glStep(3);
    return { gun: w.def.id, knob: window.__knobs?.registry?.().GUNLOOK?.shells, one, all, broke: { mid, fired: w.shotsFired - shots0, reloading: !!w.reloading, rounds: w.mag + w.chamber }, row: w.def.reload.dur }; };
  if (!ONLY || ONLY === 'shells') {
    { const { page, errors } = await open('', KIT_TUBE); log('shells: ready'); const S = await page.evaluate(shells);
      line(S.gun === 'm1014' && S.knob === true && Math.abs(S.one.secs - 1.46) < 0.12 && S.one.rounds === 8 && Math.abs(S.all.secs - 3.62) < 0.12 && S.all.rounds === 7 && S.all.steps === 7,
        'on the page the M1014 in your hands is fed by the shell: one shell takes about a second and a half, a whole tube from empty about 3.6 s, the rounds in it going up one at a time', JSON.stringify(S));
      line(S.broke.mid === 6 && S.broke.fired === 1 && !S.broke.reloading && S.broke.rounds === 5, 'the trigger pressed with one shell in and two to go lets the reload go and fires', JSON.stringify(S.broke));
      await page.evaluate(() => window.__glStep(30)); line(errors.length === 0, 'no page error feeding it by the shell', errors.slice(0, 4).join(' · ') || 'none'); await page.close(); }
    { const { page, errors } = await open('&nogunshells', KIT_TUBE); log('shells off: ready'); const S = await page.evaluate(shells);
      line(S.knob === false && Math.abs(S.one.secs - S.row) < 0.12 && S.one.rounds === 8 && S.one.steps === 1 && S.broke.fired === 0,
        'the same page with ?nogunshells: the key is off, one shell takes the row\'s whole length, booked in one step, and the trigger does not break it off', JSON.stringify(S));
      await page.evaluate(() => window.__glStep(30)); line(errors.length === 0, 'no page error with the key off', errors.slice(0, 4).join(' · ') || 'none'); await page.close(); }
  }
  if (!ONLY || ONLY === 'on') {
    const { page, errors } = await open(''); log('on: ready');
    const L = await page.evaluate(look);
    line(L.knob === true && L.you.up && L.you.gun === 'mk46' && L.you.look?.hand === 'mk46' && L.you.look?.side === 'g18' && L.mates.length >= 3 && WANT.mates.every((id, i) => L.mates[i]?.gun === id && L.mates[i].look?.hand === id && !!L.mates[i].look?.side) && new Set([L.you.ahead, ...L.mates.slice(0, 3).map(m => m.ahead)]).size === 4,
      'the page opens with the switch on and the stored kit dealt: you carry the Mk 46 and each teammate his card\'s gun, every figure told its model and its sidearm\'s, every muzzle a different length', JSON.stringify(L));
    await still(page, 'page-you-mk46', -1); for (let i = 0; i < 3; i++) await still(page, `page-mate-${WANT.mates[i]}`, i);
    const F = await page.evaluate(feed);
    line(F.after <= F.full && F.fed === 'mk46' && !F.reloading && F.mag >= F.full && Math.abs(F.frames / 60 - F.dur) < 0.5, 'you fire a round and change the belt: the change is dealt as the belt gun\'s own, takes about its row\'s length and leaves the gun full', JSON.stringify(F));
    // … and the cover up in a still, a third of the way through a second change
    await page.evaluate(() => { const g = window.__game, w = g.player.rifle; w.mag = 0; w.chamber = 0; window.__input.pressed.add('KeyR'); window.__glStep(1, ['KeyR']); window.__glStep(Math.round(w.def.reload.dur * 60 * 0.3)); });
    await still(page, 'page-you-mk46-belt', -1, 1.9, 1.2);
    await page.evaluate(() => window.__glStep(30));
    line(errors.length === 0, 'no page error with the six guns on the floor, fired, fed and drawn', errors.slice(0, 4).join(' · ') || 'none'); await page.close();
  }
  if (!ONLY || ONLY === 'off') {
    const { page, errors } = await open('&nogunlook'); log('off: ready');
    const L = await page.evaluate(look);
    line(L.knob === false && L.you.gun === 'mk46' && L.you.look === null && L.mates.every(m => m.look === null), 'the same page with ?nogunlook: the switch is off, the same guns are carried and no figure is told a model', JSON.stringify(L));
    await still(page, 'page-off-you-mk46', -1); await still(page, 'page-off-mate-mk12', 0);
    await page.evaluate(() => window.__glStep(30));
    line(errors.length === 0, 'no page error with the switch off', errors.slice(0, 4).join(' · ') || 'none'); await page.close();
  }
  await browser.close();
  console.log(failed ? '\n=== gunlook-page: FAILURES above ===' : '\n=== gunlook-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
