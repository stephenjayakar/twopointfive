// FINDING YOUR OWN MAN, AND THE CAMERA UNDER THE HAND, ON THE REAL PAGE (src/host/findme.ts, src/ui/findme.ts, src/render/outline.ts): headless Chromium on the software WebGPU
// adapter (tools/qa/page-look.cjs's recipe), the page as it opens, its own Options screen clicked and its own keyboard and mouse events sent.
//   PORT=5241 node tools/qa/findme-page.cjs [outDir]     (a dev server on that port: PORT=5241 bun run tools/serve.ts)
//   rows     Options > Game has the twelve rows under their two headings, all at their starts on a fresh machine (nothing kept, the camera's lead as built)
//   pairs    the two light rows show the picture's own two ends by the picture and the meter's by the meter, each pair keeping its numbers
//   live     each row moved by its own control: the table is kept in the page's store at once and the camera's lead follows the pan
//   picture  with the rows on (the outline put on the light meter, as it was first built: by the picture is findme-squad-page.cjs's), the overlay draws
//            the ring at his feet, and the renderer has the outline's frame for the player's own man, its one program
//            compiled on this adapter and the rim drawn with no GPU error (at the light meter's strength, then at full for the picture kept)
//   hand     the camera's key held + a real mouse drag turns the view the reversed way by the same angle; a real double tap of it brings the view round to his facing, and
//            with the mouse off to one side he still faces what he faced, until a real move of the mouse; a real press held for most of a second does nothing
//   kept     after a reload the rows and the camera's lead are as they were left; Reset to defaults puts all twelve back (the store then keeps nothing)
//   THE CAMERA'S KEY is read from the page (`__keys.camCap()`, host/keymap.ts: Space while the board leaves it spare, else Ctrl; a page from before the key
//   could move has no such word and is Ctrl): the last row is looked for under that name and the hand's lines press that key, so the page is checked as it opens.
//   WHICH key the page opens on is not this check's to say (keybinds-page.cjs pins it): this one follows whatever the page names, and says it in its first line.
//   THE PAGE IS OPENED WITH `autocam=0`: the twelfth row here is the double tap as a row of its own. The page as it opens gives that tap to the camera that runs
//   itself (host/autocam.ts) and shows its row instead: that page is autocam-page.cjs's.
//   exit 0 = all of it with no page error · 1 = otherwise. The verdict is the page's DOM and the game's numbers: nothing here judges a picture. With an
//   outDir it also keeps two pictures (the ring; the outline at full strength) (the software adapter's frame with the page's own overlay laid on it) for a person to look at, never for the verdict.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 5241, QUALITY = process.env.QUALITY || 'verylow', outDir = process.argv[2] || '';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const LS = 'twopointsix.findme', ROWS11 = ['Ring at your feet', 'Outline in the dark', 'Outline width', 'Outline strength', 'Outline fades by', 'Outline shows under light', 'Outline full under light', 'Teammate outline width', 'Outline colour', 'Aim pan', 'Turn direction'];

// in the page: n frames with the HUD laid over them, the last one drawn
const STEP = (n) => window.__runFrames(n, 1 / 60, [], false);
// in the page: draw n frames one at a time, read the last one back as a PNG data URL (page-look.cjs DRAW)
const DRAW = async ([n, full]) => {
  const dev = window.__engine.device;
  const yieldMacro = () => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  for (let i = 0; i < n; i++) { if (full && window.__engine.outline) window.__engine.outline.strength = full; window.__runFrames(1, 1 / 600); await dev.queue.onSubmittedWorkDone(); await yieldMacro(); }
  if (full && window.__engine.outline) window.__engine.outline.strength = full;   // (the outline at this strength for the picture, whatever the light on him)
  window.__engine.render(window.__cam, window.__game.time, 1 / 60, false); const fr = await window.__engine.readbackFrame(); if (!fr) return null;
  if (fr.bgra) for (let i = 0; i < fr.data.length; i += 4) { const b = fr.data[i]; fr.data[i] = fr.data[i + 2]; fr.data[i + 2] = b; }
  for (let i = 0; i < fr.data.length; i += 4) fr.data[i + 3] = 255;
  const c2 = document.createElement('canvas'); c2.width = fr.w; c2.height = fr.h;
  c2.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(fr.data.buffer), fr.w, fr.h), 0, 0);
  return c2.toDataURL('image/png');
};
// in the page: the Options screen on its GAME tab, from the pause card
const OPEN = () => { window.__menu.open('pause'); const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent.trim() === 'Options'); if (!b) return 'no Options button on the pause card'; b.click();
  const t = document.querySelector('#options .op-tab[data-tab="game"]'); if (!t) return 'no Game tab'; t.click(); return ''; };
const ROWS = () => ({ heads: [...document.querySelectorAll('#options .op-sec')].map(e => e.textContent), rows: Object.fromEntries([...document.querySelectorAll('#options .op-row')].map(r => [r.querySelector('.op-label').textContent,
  r.querySelector('.op-switch') ? r.querySelector('.op-switch').textContent : r.querySelector('.op-range') ? r.querySelector('.op-val').textContent : [...r.querySelectorAll('.op-opt.on')].map(b => b.textContent).join('|')])),
  kept: localStorage.getItem('twopointsix.findme'), lead: window.__cam.aimLead });
const MOVE = ([label, how]) => { const r = [...document.querySelectorAll('#options .op-row')].find(x => x.querySelector('.op-label').textContent === label); if (!r) return `no row ${label}`;
  if (how === 'flip') r.querySelector('.op-switch').click(); else if (typeof how === 'number') { const i = r.querySelector('.op-range'); i.value = String(how); i.dispatchEvent(new Event('input', { bubbles: true })); }
  else { const b = [...r.querySelectorAll('.op-opt')].find(x => x.textContent === how); if (!b) return `no choice ${how}`; b.click(); } return ''; };
const RESET = () => { const b = document.querySelector('#options [data-act="reset"]'); if (!b) return 'no Reset'; b.click(); return ''; };
const SHUT = () => { document.querySelector('#options [data-act="back"]')?.click(); window.__menu.close(); if (window.__smoke) window.__smoke.params.enabled = false; window.__game.godMode = true; window.__game.aiEnabled = false; };
// in the page: what the overlay has drawn
const DOM = () => { const q = s => document.querySelector(s), on = e => !!e && e.style.display !== 'none' && q('.findme').style.display !== 'none';
  return { group: !!q('.findme'), ring: on(q('.findme .fr')) ? (q('.findme .fr').getAttribute('points') || '').split(' ').length : 0, gone: !q('.findme path') && !q('.findme use') && !q('.findme filter'), fatal: (q('#fatal') || {}).textContent || '' }; };
// in the page: the outline's frame and its pass (render/outline.ts)
const OUT = () => { const E = window.__engine, F = E.outline, P = E.passes.outlinePass; return { light: window.__game.player.visibility, frame: F ? { on: F.on, owner: F.owner, strength: F.strength, wide: F.wide, alpha: F.alpha } : null, pass: P ? { pipe: !!P.pipe, bad: !!P.bad, drawn: P.drawn } : null }; };
const VIEW = () => { const g = window.__game, c = window.__cam, f = c.planarBasis().fwd, a = g.player.char.aimYaw; return { yaw: c.yaw, aim: a, orbit: window.__input.orbitDX, dot: f[0] * Math.sin(a) + f[2] * Math.cos(a) }; };
const DOT = (a) => { const f = window.__cam.planarBasis().fwd; return f[0] * Math.sin(a) + f[2] * Math.cos(a); };

(async () => {
  let red = 0; const check = (ok, what, detail = '') => { if (!ok) red++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); };
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser.newContext({ viewport: { width: 1024, height: 576 }, deviceScaleFactor: 1 })).newPage();
  page.setDefaultNavigationTimeout(900000);   // (a boot on the software adapter is minutes, and the reload is a second one)
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 300)); });
  // (findtuned=0: this is the rows' own check, on the starts as built — the outline off until its row is flipped. The page's own starts: findtuned-page.cjs)
  const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&autocam=0&findtuned=0`, wait = ms => new Promise(r => setTimeout(r, ms));
  const boot = async (again) => { if (again) await page.reload(); else await page.goto(url); await page.evaluate(async () => { await window.__ready; }); await page.evaluate(STEP, 20); };
  const still = async (name, full = 0) => { if (!outDir && !full) return; const u = await page.evaluate(DRAW, [full ? 10 : 4, full]);   // (the outline's picture is given the frames the resolve takes to bring a new line up)
    if (!u || !outDir) return;
    await page.evaluate(src => { const v = document.getElementById('view'), i = document.createElement('img'); i.id = 'findme-still'; i.src = src; i.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;'; v.parentNode.insertBefore(i, v.nextSibling); }, u);
    await page.evaluate(STEP, 1); const shot = await page.screenshot({ path: path.join(outDir, name), timeout: 180000 }).then(() => true, () => false);   // (a picture for a person: one that will not come is said, never a red)
    await page.evaluate(() => document.getElementById('findme-still')?.remove()); log(shot ? `kept ${name}` : `no picture ${name}: the screenshot did not come`); };
  try {
    log(url); await boot(false); log('booted');
    // the camera's key, as this page has it: the name on the last row, and the key the hand's lines press
    const cap = await page.evaluate(() => (window.__keys && window.__keys.camCap ? window.__keys.camCap() : 'Ctrl')), KEY = cap === 'Ctrl' ? 'Control' : cap, TAP = `Double tap ${cap}`, LABELS = [...ROWS11, TAP];
    if (cap !== 'Ctrl' && cap !== 'Space') throw new Error(`the page names a camera key this check cannot press: ${cap}`);
    log(`the camera's key on this page: ${cap}`);
    // rows
    let e = await page.evaluate(OPEN); if (e) throw new Error(e);
    const a = await page.evaluate(ROWS), startRows = { 'Ring at your feet': 'Off', 'Outline in the dark': 'Off', 'Outline width': '100 %', 'Outline strength': '60 %', 'Outline fades by': 'Picture', 'Outline shows under light': '30 %', 'Outline full under light': '12 %', 'Teammate outline width': '100 %', 'Outline colour': '60 %', 'Aim pan': '100 %', 'Turn direction': 'Normal', [TAP]: 'Off' };
    const atStart = r => LABELS.every(l => r.rows[l] === startRows[l]);
    check(LABELS.every(l => l in a.rows) && !('Shape through walls' in a.rows) && a.heads.some(h => /^Finding yourself/.test(h)) && a.heads.some(h => /^Camera/.test(h)) && atStart(a) && a.kept === null && a.lead === 0.18, 'Options > Game has the twelve rows (the shape through walls is shelved: no row), all at their starts, nothing kept, the camera\'s lead as built',
      `${LABELS.map(l => `${l}: ${a.rows[l]}`).join(' · ')} · kept ${a.kept} · lead ${a.lead} · the camera's key ${cap}`);
    // the two light rows show and move the pair of whichever 'Outline fades by' says: the picture's own two ends, then the meter's, each keeping its numbers
    for (const m of [['Outline shows under light', 60], ['Outline full under light', 20], ['Outline fades by', 'Light meter']]) { e = await page.evaluate(MOVE, m); if (e) throw new Error(e); }
    const f0 = await page.evaluate(ROWS); e = await page.evaluate(MOVE, ['Outline fades by', 'Picture']); if (e) throw new Error(e); const f1 = await page.evaluate(ROWS), two = r => `${r.rows['Outline shows under light']} / ${r.rows['Outline full under light']}`;
    check(two(f0) === '30 % / 12 %' && two(f1) === '60 % / 20 %' && f1.kept === JSON.stringify({ picLit: 0.6, picDark: 0.2 }), 'the two light rows are the picture\'s own pair by the picture and the meter\'s by the meter, each kept apart', `moved to 60 / 20 by the picture · on the meter they read ${two(f0)} · back by the picture ${two(f1)} · kept ${f1.kept}`);
    // live
    for (const m of [['Ring at your feet', 'flip'], ['Outline in the dark', 'flip'], ['Outline width', 150], ['Outline strength', 100], ['Outline fades by', 'Light meter'], ['Outline shows under light', 80], ['Outline full under light', 40], ['Teammate outline width', 200], ['Outline colour', 100], ['Aim pan', 0], ['Turn direction', 'Reversed'], [TAP, 'flip']]) { e = await page.evaluate(MOVE, m); if (e) throw new Error(e); }
    const b = await page.evaluate(ROWS), want = { pan: 0, ring: true, outline: true, width: 1.5, opacity: 1, picture: false, lit: 0.8, dark: 0.4, picLit: 0.6, picDark: 0.2, mates: 2, colour: 1, turn: -1, behind: true }, movedRows = { 'Ring at your feet': 'On', 'Outline in the dark': 'On', 'Outline width': '150 %', 'Outline strength': '100 %', 'Outline fades by': 'Light meter', 'Outline shows under light': '80 %', 'Outline full under light': '40 %', 'Teammate outline width': '200 %', 'Outline colour': '100 %', 'Aim pan': 'None', 'Turn direction': 'Reversed', [TAP]: 'On' };
    const keptOk = r => { try { return JSON.stringify(JSON.parse(r.kept)) === JSON.stringify(want); } catch { return false; } }, moved = r => LABELS.every(l => r.rows[l] === movedRows[l]);
    check(moved(b) && keptOk(b) && b.lead === 0, 'each row moved by its own control: shown, kept in the page\'s store at once, the camera\'s lead following the pan', `${LABELS.map(l => `${l}: ${b.rows[l]}`).join(' · ')} · kept ${b.kept} · lead ${b.lead}`);
    // the two rows that go to none, on the real sliders: shown as None, kept as 0, and back
    for (const m of [['Outline width', 0], ['Outline strength', 0]]) { e = await page.evaluate(MOVE, m); if (e) throw new Error(e); }
    const z = await page.evaluate(ROWS), zk = (() => { try { return JSON.parse(z.kept); } catch { return {}; } })();
    for (const m of [['Outline width', 150], ['Outline strength', 100], ['Outline full under light', 90]]) { e = await page.evaluate(MOVE, m); if (e) throw new Error(e); }
    const z1 = await page.evaluate(ROWS); e = await page.evaluate(MOVE, ['Outline full under light', 40]); if (e) throw new Error(e); const z2 = await page.evaluate(ROWS);
    check(z.rows['Outline width'] === 'None' && z.rows['Outline strength'] === 'None' && zk.width === 0 && zk.opacity === 0 && z1.rows['Outline full under light'] === '80 %' && moved(z2) && keptOk(z2),
      'the width and the strength slider go down to None; the full light row dragged over the shows row stops at it', `at none: width ${z.rows['Outline width']}, strength ${z.rows['Outline strength']}, kept ${z.kept} · full dragged to 90 with shows at 80: ${z1.rows['Outline full under light']}`);
    await page.evaluate(SHUT);
    // picture
    await page.evaluate(STEP, 3); await wait(500); await page.evaluate(STEP, 3);
    const d0 = await page.evaluate(DOM);
    check(d0.group && d0.ring >= 40 && d0.gone && !d0.fatal, 'the overlay draws the ring at his feet, and no figure of him (shelved)', `ring of ${d0.ring} points · figure ${d0.gone ? 'none' : 'STILL IN THE PAGE'}`);
    await still('findme-ring.png');
    // picture: the outline (the renderer's; its program was asked for by the first frame drawn above)
    for (let i = 0; i < 300; i++) { const o = await page.evaluate(OUT); if (!o.pass || o.pass.pipe || o.pass.bad) break; await wait(3000); }   // (its program waits its turn behind whatever the boot left compiling: minutes on this adapter)
    await page.evaluate(STEP, 2);   // (a frame drawn with the program in: at the meter's strength, so in the dark the rim is counted)
    const o0 = await page.evaluate(OUT); await still('findme-outline.png', 1); const o1 = await page.evaluate(OUT);
    check(!!o0.frame && o0.frame.on && o0.frame.owner === 1 && o0.frame.wide === 1.5 && o0.frame.alpha === 1 && !!o0.pass && o0.pass.pipe && !o0.pass.bad && o1.pass.drawn > o0.pass.drawn && (o0.light >= 0.8 || (o0.frame.strength > 0 && o0.pass.drawn > 0)),   // (0.8: where the script left 'Outline shows under light')
      'the renderer has the outline\'s frame for his own man at the width row\'s width, its program compiled here, and the rim is drawn',
      `frame ${o0.frame ? `${o0.frame.on ? 'on' : 'OFF'}, owner ${o0.frame.owner}, width ${o0.frame.wide} of its own, strength ${o0.frame.strength.toFixed(2)} at light ${o0.light.toFixed(2)}` : 'NONE'} · program ${!o0.pass ? 'never asked for' : o0.pass.bad ? 'FAILED' : o0.pass.pipe ? 'in' : 'not in yet'} · drawn ${o0.pass ? o0.pass.drawn : 0} frames at the meter's strength, ${o1.pass ? o1.pass.drawn - (o0.pass ? o0.pass.drawn : 0) : 0} more at full for the picture`);
    // hand: the turn
    await page.mouse.move(400, 300); await page.evaluate(STEP, 1); const v0 = await page.evaluate(VIEW);
    await page.keyboard.down(KEY); await page.mouse.move(450, 300); await page.mouse.move(500, 300); await page.keyboard.up(KEY);
    const v1 = await page.evaluate(VIEW); await page.evaluate(STEP, 1); const v2 = await page.evaluate(VIEW);
    check(v1.orbit > 0 && Math.abs((v2.yaw - v0.yaw) + v1.orbit * 0.006) < 1e-9, `${cap} held + a real mouse drag to the right, with the turn reversed: the view turns the other way by the same angle`, `the drag read as ${v1.orbit} px · yaw ${(v2.yaw - v0.yaw).toFixed(4)} rad (as it was: +${(v1.orbit * 0.006).toFixed(4)})`);
    // hand: a press held does nothing; two taps bring the view round
    await page.evaluate(() => window.__cam.rotate(1.5)); await page.evaluate(STEP, 2); const h0 = await page.evaluate(VIEW);
    await page.keyboard.down(KEY); await wait(700); await page.keyboard.up(KEY); await page.evaluate(STEP, 30); const h1 = await page.evaluate(VIEW);
    await page.mouse.move(300, 520); await page.evaluate(STEP, 40); const hs = await page.evaluate(VIEW);   // (the mouse to one side of him: he faces it, and it is not ahead of the view)
    let t1 = hs, tries = 0; const a0 = hs.aim;
    for (; tries < 3 && !(t1.yaw !== hs.yaw); tries++) { await wait(500); await page.keyboard.press(KEY, { delay: 40 }); await wait(60); await page.keyboard.press(KEY, { delay: 40 }); await page.evaluate(STEP, 90); t1 = await page.evaluate(VIEW); }
    const dot = await page.evaluate(DOT, a0);
    check(h1.yaw === h0.yaw && dot > 0.999999, `a real press of ${cap} held 0.7 s turns nothing; a real double tap of it brings the view round to look where he looked`, `held: yaw ${h0.yaw.toFixed(4)} → ${h1.yaw.toFixed(4)} · two taps (try ${tries}): view · his facing at the tap ${DOTS(hs, a0)} → ${dot.toFixed(6)}`);
    // …and his aim came round with it: he faces what he faced with the mouse where it lay; a real move of the mouse and the cursor is the mouse again
    const off = (x, y) => Math.abs(Math.atan2(Math.sin(x - y), Math.cos(x - y))) * 180 / Math.PI;
    const c1 = await page.evaluate(() => ({ mx: window.__input.mouseX, my: window.__input.mouseY }));
    await page.mouse.move(380, 520); await page.evaluate(STEP, 1); const c2 = await page.evaluate(() => ({ mx: window.__input.mouseX, my: window.__input.mouseY }));
    await page.evaluate(STEP, 60); const t2 = await page.evaluate(VIEW);
    check(hs.dot < 0.9 && off(t1.aim, a0) < 1 && Math.hypot(c1.mx - 300, c1.my - 520) > 20 && c2.mx === 380 && c2.my === 520 && off(t2.aim, a0) > 5,
      'with the mouse to one side at the double tap he still faces what he faced when the view has come round; a real move of the mouse and he turns to it',
      `at the tap the view was ${DOTS(hs, a0)} off his facing · after: his facing ${off(t1.aim, a0).toFixed(2)}° off the tap's, the game's cursor at ${c1.mx.toFixed(0)}, ${c1.my.toFixed(0)} with the mouse at 300, 520 · the mouse moved to 380, 520: the cursor ${c2.mx}, ${c2.my}, and he has turned ${off(t2.aim, a0).toFixed(0)}°`);
    // kept
    await boot(true); log('reloaded'); const k0 = await page.evaluate(() => window.__cam.aimLead);
    e = await page.evaluate(OPEN); if (e) throw new Error(e); const c = await page.evaluate(ROWS);
    e = await page.evaluate(RESET); if (e) throw new Error(e); const r = await page.evaluate(ROWS), startKept = {};
    check(k0 === 0 && moved(c) && keptOk(c), 'after a reload the twelve rows and the camera\'s lead are as they were left', `${LABELS.map(l => `${l}: ${c.rows[l]}`).join(' · ')} · lead at boot ${k0}`);
    check(atStart(r) && r.lead === 0.18 && JSON.stringify(JSON.parse(r.kept)) === JSON.stringify(startKept), 'Reset to defaults puts all twelve back, the store keeping nothing, and the camera\'s lead with them', `${LABELS.map(l => `${l}: ${r.rows[l]}`).join(' · ')} · kept ${r.kept} · lead ${r.lead}`);
  } catch (err) { red++; console.log(`- FAIL — the run stopped: ${String(err).slice(0, 400)}`); }
  check(!errs.length, 'no page error', errs.slice(0, 4).join(' | '));
  await browser.close();
  console.log(red ? `\nfindme-page: FAIL (${red})` : '\nfindme-page: ALL PASS'); process.exit(red ? 1 : 0);
})();
function DOTS(v, a) { return (-Math.sin(v.yaw) * Math.sin(a) - Math.cos(v.yaw) * Math.cos(a)).toFixed(4); }
