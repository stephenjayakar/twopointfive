// EVERY DEATH EXPLAINS ITSELF, ON THE REAL PAGE: boot the page in headless Chromium on the software WebGPU adapter (tools/qa/page-look.cjs's recipe) on the plain
// night, stand Sam in front of a man of the shift until that man shoots him, let the down card come up by itself, and read the card: the panel is on it, its
// plan has the round's line drawn in the card's orange, its labels name the man who fired (the game's own record of it), his gun and a distance — and the plan
// PLAYS: its clock was started when the card was built, and three moments of it (a quarter in, past the middle, the end) are three different pictures. (The
// moments are asked for with `__recap.seek(k)`: on the software adapter the page's frame clock does not run at all — 0 animation frames in 1.5 s once the
// game is up — so the clock itself is held headless, by tools/qa/deathrecap-check.ts on a frame clock of its own.)
// Then the same under ?norecap: the card comes up with no panel. `look` after the outDir adds a page that is no verdict, only stills: a squad's room clear on
// the compound, Sam stood in front of a defender — four teammates and the defenders all on the plan.
// Then two pages of a squad's room clear for what is shown WHILE THE RUN IS ON (the block before them says what is held).
//   PORT=5261 node tools/qa/deathrecap-page.cjs [outDir]      (a dev server on that port: PORT=5261 bun run tools/serve.ts; outDir = stills of the card and the panel)
// exit 0 = all four hold · 1 = otherwise / a page error
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const PORT = process.env.PORT || 5199, QUALITY = process.env.QUALITY || 'verylow', OUT = process.argv[2] || '', LOOK = process.argv[3] === 'look', ONLY = process.env.ONLY || '';   // ONLY=live = the three squad pages alone · ONLY=card = the card pages alone · ONLY=<a squad page's name> = that page alone
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const NOISE = /""?smoke[A-Za-z0-9_]*""?|\[pipeline\] smoke_|number of storage textures \(5\) in the Compute stage/;
(async () => {
  // A BROWSER OF ITS OWN PER PAGE, so no page inherits the one before it, and a page that does not load is a FAIL line and the run goes on (a load that
  // ran out its wait used to end the run with no FAIL line). The load time is printed: about a second on the software adapter, in a shared browser too,
  // quiet or with the box at load 13 — a load that takes minutes is the box (another Chromium on the software adapter at the same time is the first suspect).
  const launch = () => chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const load = async (page, name, q) => {
    const t0 = Date.now();
    try { await page.goto(`http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&${q}`, { timeout: 120000 }); }
    catch (x) { console.log(`- FAIL — ${name}: the page did not load (${String(x.message || x).split('\n')[0]})`); return false; }
    console.log(`  (${name}: page loaded in ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    return true;
  };
  let failed = false;
  for (const [name, q, want] of ONLY && ONLY !== 'card' ? [] : [['recap', 'solo', true], ['norecap', 'solo&norecap', false], ...(LOOK && OUT ? [['look', 'levelFile=compound.json&roomclear&squad4&freshstart=0', true]] : [])]) {
    const browser = await launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    if (!await load(page, name, q)) { failed = true; await browser.close(); continue; }
    const R = await page.evaluate(async (look) => {
      await window.__ready; window.__testVisible = true; const g = window.__game, e = window.__engine; window.__menu.close();
      g.godMode = false; e.render = () => { e.world.upload(); }; window.__cam.rebuild();   // the simulation alone (CLAUDE.md's recipe for a page tool): a drawn frame on the software adapter is seconds, and it stays so for the stills — the card is DOM
      const pl = g.player, gd = (look && g.guards.find(x => x.team === 'hostile' && x.state !== 'dead')) || g.guards[0]; let frames = 0;
      const stand = () => { const c = gd.char, y = c.aimYaw; g.teleportPlayer([c.pos[0] + Math.sin(y) * 1.5, 0, c.pos[2] + Math.cos(y) * 1.5]); };
      if (look) {   // two of the squad stood with their backs to two other defenders, so the plan has more than one man on it to lose
        const hs = g.guards.filter(x => x.team === 'hostile' && x.state !== 'dead' && x !== gd), ops = g.guards.filter(x => x.team === 'operative');
        ops.slice(0, 2).forEach((o, i) => { const h = hs[i]; if (!h) return; const y = h.char.aimYaw, p = [h.char.pos[0] + Math.sin(y) * 2.5, 0, h.char.pos[2] + Math.cos(y) * 2.5]; o.char.pos = p; o.lastPos = p.slice(); o.char.bodyYaw = y; o.char.aimYaw = y; });
      }
      stand(); pl.visibility = 1;
      while (!pl.down && frames < 60 * 40) { if (frames % 30 === 0 && gd.state === 'patrol') stand(); pl.visibility = 1; await window.__runFrames(1, 1 / 60); frames++; }
      const downAt = frames; let card = null;
      while (!(card = document.querySelector('#menu.on .db-recap, #menu.on .db')) && frames < downAt + 60 * 6) { await window.__runFrames(1, 1 / 60); frames++; }
      for (let i = 0; i < 3 && !document.querySelector('#menu.on .db'); i++) await new Promise(r => setTimeout(r, 200));
      const panel = document.querySelector('#menu .db-recap'), cv = panel && panel.querySelector('canvas'); let orange = 0, lit = 0;
      // the playback: was its clock started, and are three moments of it three pictures
      const U = window.__recap, play = { on: !!(U && U.playing), a: '', b: '', c: '', chips: [] };
      if (cv && U) {
        for (const [key, k] of [['a', 0.25], ['b', 0.6], ['c', 1]]) { U.seek(k); play[key] = cv.toDataURL('image/png'); }
        if (look) { const n = panel.querySelectorAll('.db-recap-chip').length; for (let i = 0; i < n; i++) { U.show(i); U.seek(1); play.chips.push([U.take.death.name, cv.toDataURL('image/png')]); } }
      }
      if (cv) { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 0; i < d.length; i += 4) { if (Math.abs(d[i] - 240) < 12 && Math.abs(d[i + 1] - 145) < 12 && Math.abs(d[i + 2] - 46) < 12) orange++; if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; } }
      const ev = g.chronicle.events.filter(x => x.kind === 'down').pop();
      return { fatal: document.getElementById('fatal')?.textContent || '', down: pl.down, frames, card: !!document.querySelector('#menu.on .db'), panel: !!panel, orange, lit,
        labels: panel ? [...panel.querySelectorAll('.db-recap-cap > *')].map(x => x.textContent) : [], by: ev ? ev.data.by : null, names: g.guards.map(x => x.callsign),
        t1: document.querySelector('#menu .db-t1')?.textContent || '', png: play.c || (cv ? cv.toDataURL('image/png') : ''), play, chips: panel ? [...panel.querySelectorAll('.db-recap-chip')].map(x => x.textContent + (x.classList.contains('on') ? '*' : '')) : [] };
    }, name === 'look');
    const named = R.labels.length === 3 && R.by && R.labels[0] === R.by && / m$/.test(R.labels[2]);
    const P = R.play, played = P.on && !!(P.a && P.b && P.c) && P.a !== P.b && P.b !== P.c && P.a !== P.c;
    const ok = !R.fatal && !errors.length && R.down && R.card && (want ? R.panel && R.orange > 40 && R.lit > 2000 && named && played : !R.panel);
    if (!ok && name !== 'look') failed = true;
    console.log(`- ${name === 'look' ? 'LOOK' : ok ? 'PASS' : 'FAIL'} — ${name}: down ${R.down} after ${R.frames} frames · card ${R.card ? `up ("${R.t1}")` : 'NOT up'} · panel ${R.panel ? `on it [${R.labels.join(' · ')}] (the game says ${R.by}) · ${R.orange} orange px, ${R.lit} lit px · ${played ? 'plays: its clock was started, three moments are three pictures' : `DOES NOT PLAY (clock started: ${P.on}; pictures ${[P.a, P.b, P.c].map(x => x ? 'y' : 'n').join('')})`}${R.chips.length ? ' · chips ' + R.chips.join(', ') : ''}` : 'not on it'}${R.fatal ? ' · FATAL ' + R.fatal : ''}${errors.length ? ' · errors: ' + errors.slice(0, 3).join(' | ') : ''}`);
    if (OUT) {   // stills: the panel's own canvas always; the whole card if the software adapter lets a screenshot through (never a verdict)
      if (R.png) require('node:fs').writeFileSync(`${OUT}/deathrecap-${name}-panel.png`, Buffer.from(R.png.split(',')[1], 'base64'));
      for (const [tag, png] of [['early', R.play.a], ['mid', R.play.b], ...R.play.chips.map(([n, png]) => ['chip-' + n.replace(/\W+/g, '-'), png])]) if (png) require('node:fs').writeFileSync(`${OUT}/deathrecap-${name}-${tag}.png`, Buffer.from(png.split(',')[1], 'base64'));
      try { await page.screenshot({ path: `${OUT}/deathrecap-${name}-card.png`, timeout: 120000 }); } catch (x) { console.log(`  (no still of the card: ${String(x.message || x).split('\n')[0]})`); }
    }
    await browser.close();
  }
  // WHILE THE RUN IS ON (deathrecap.ts lostLive): a squad's room clear on the compound, Sam unhurt and away; one teammate held reeling with his back to a defender
  // until that defender shoots him, a second teammate a few steps behind (the squad hears it: that is how it knows the way). Then Sam is brought near, so the
  // body is on the screen. As the page ships (RECAP.liveArrows off): the squad block's line for the man is struck, the squad knows the way, and NOTHING is drawn for it
  // — no arrow on his row, no stroke on the ground. Under &recaparrows=1: the arrow on the row (the game's own direction, projected by this camera here and
  // compared with what the HUD drew) and one stroke on the ground at him. Either way the panel names no defender and no card is up. Under &recaplive=0: his line as it was.
  for (const [name, q, want] of [['live', 'levelFile=compound.json&roomclear&squad4&freshstart=0', 'plain'], ['livearrows', 'levelFile=compound.json&roomclear&squad4&freshstart=0&recaparrows=1', 'arrows'], ['liveoff', 'levelFile=compound.json&roomclear&squad4&freshstart=0&recaplive=0', 'off']].filter(c => !ONLY || ONLY === 'live' || ONLY === c[0])) {
    const browser = await launch(), page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }); const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !NOISE.test(m.text()) && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    page.on('pageerror', x => errors.push('pageerror: ' + String(x && x.stack || x).slice(0, 400)));
    if (!await load(page, name, q)) { failed = true; await browser.close(); continue; }
    const R = await page.evaluate(async () => {
      await window.__ready; window.__testVisible = true; const g = window.__game, e = window.__engine; window.__menu.close();
      g.godMode = true; e.render = () => { e.world.upload(); }; window.__cam.rebuild();
      const ops = g.guards.filter(x => x.team === 'operative' && x.unit), hs = g.guards.filter(x => x.team === 'hostile' && x.state !== 'dead'); let frames = 0, A = null;
      const put = (o, h, d) => { const y = h.char.aimYaw, p = [h.char.pos[0] + Math.sin(y) * d, 0, h.char.pos[2] + Math.cos(y) * d]; o.char.pos = p; o.lastPos = p.slice(); o.char.bodyYaw = y; o.char.aimYaw = y; o.staggerUntil = g.time + 5; };
      const rowHtml = () => [...document.querySelectorAll('#interact .hint')].map(x => x.outerHTML);
      const before = rowHtml().filter(x => /class="hint lost/.test(x)).length;
      while (frames < 60 * 40 && !(A = ops.find(x => x.state === 'dead'))) {
        const h = hs.find(x => x.state !== 'dead'); if (!h) break;
        put(ops[0], h, 1.4); ops[0].dazzledUntil = g.time + 5; put(ops[1], h, 3.2);   // (both reeling: neither shoots him first; the first cannot see either. Close: with no picture drawn nobody's light meter answers, and inside two metres a man is seen in any light)
        await window.__runFrames(1, 1 / 60); frames++;
      }
      if (!A) return { fatal: document.getElementById('fatal')?.textContent || '', lost: false, frames, why: `defenders ${hs.map(x => x.state).join(' ')} · the two staged ${ops.slice(0, 2).map(x => x.state).join(' ')}` };
      for (let i = 0; i < 60; i++) { await window.__runFrames(1, 1 / 60); frames++; }   // the beat after the fall: what the squad knows is settled before Sam is anywhere near
      // Sam to where the man lying is on his screen (he is unhurt: the sandbox's god mode)
      const at = A.char.pos, body = [at[0], 0.4, at[2]]; let sam = null;
      for (let k = 0; k < 16 && !sam; k++) { const a = k * Math.PI / 8, p = [at[0] + Math.sin(a) * 3, 0, at[2] + Math.cos(a) * 3]; g.teleportPlayer(p); const c = g.player.char.pos; if (Math.hypot(c[0] - p[0], c[2] - p[2]) < 0.3 && !g.col.segmentBlocked([c[0], 1.65, c[2]], body)) sam = p; }
      for (let i = 0; i < 45; i++) { await window.__runFrames(1, 1 / 60); frames++; }
      const opt = g.orders.hud().status.flatMap(r => r.opts).find(o => o.text.includes(A.callsign)), L = opt && opt.lost;
      const el = document.querySelector('#interact .hint.lost'), s = el && el.querySelector('s'), b = el && el.querySelector('b');
      let want = [];   // the turns this camera's own projection allows: the nearest eighth, and its neighbour when the line lies near the seam between two
      if (L && L.from) { const w = window.innerWidth, h = window.innerHeight, cam = window.__cam, p0 = cam.project([L.at[0], 0.05, L.at[1]], w, h), p1 = cam.project([L.at[0] + L.from[0], 0.05, L.at[1] + L.from[1]], w, h);
        const a = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) / (Math.PI / 4), i = Math.round(a), f = a - i, deg = k => (((k % 8) + 8) % 8) * 45;
        want = [deg(i)].concat(Math.abs(f) > 0.3 ? [deg(i + Math.sign(f))] : []); }
      const turn = b ? parseInt((b.style.transform.match(/rotate\((-?\d+)deg\)/) || [])[1], 10) : NaN;
      const marks = [...document.querySelectorAll('.lostfrom')].filter(x => x.style.display !== 'none');
      const panel = document.getElementById('interact').textContent || '';
      return { fatal: document.getElementById('fatal')?.textContent || '', lost: true, frames, who: A.callsign, sam: !!sam, before, known: !!(L && L.from), want,
        struck: !!s && s.textContent.includes(A.callsign) && /line-through/.test(getComputedStyle(s).textDecorationLine), arrow: b ? b.textContent : '', turn, colour: b ? getComputedStyle(b).color : '',
        marks: marks.length, mark: marks[0] ? { w: marks[0].style.width, t: marks[0].style.transform, o: marks[0].style.opacity } : null,
        corner: document.getElementById('interact').classList.contains('corner'), names: hs.map(x => x.callsign).filter(n => panel.includes(n)), card: !!document.querySelector('#menu.on .db'), samDown: g.player.down, plain: rowHtml().find(x => x.includes(A.callsign)) || '' };
    });
    const ok = !R.fatal && !errors.length && R.lost && !R.card && !R.samDown && R.names.length === 0 && (want === 'arrows'
      ? R.before === 0 && R.sam && R.known && R.struck && R.arrow === '→' && R.want.includes(R.turn) && /240, 145, 46/.test(R.colour) && R.marks === 1
      : want === 'plain' ? R.before === 0 && R.sam && R.known && R.struck && !R.arrow && R.marks === 0
      : !R.struck && !R.arrow && R.marks === 0 && (R.corner ? !R.plain : /class="hint( t-[a-z]+)?"/.test(R.plain)));   // (the corner panel — ui/corner.ts — has no line per man: with the live rule off a lost man has none either)
    if (!ok) failed = true;
    console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${name}: ${!R.lost ? `no teammate was lost in ${R.frames} frames (${R.why})` : `${R.who} lost after ${R.frames} frames, Sam ${R.samDown ? 'DOWN' : 'up'}${R.sam ? ' and looking at him' : ''} · his line ${R.struck ? 'struck' : 'not struck'}, ${R.arrow ? `arrow "${R.arrow}" turned ${R.turn}° (the game's direction on this camera: ${R.want.join('° or ')}°, ${R.colour})` : `no arrow (the way ${R.known ? 'known' : 'NOT known'})`} · ${R.marks} stroke(s) on the ground${R.mark ? ` (${R.mark.w}, ${R.mark.t}, opacity ${R.mark.o})` : ''} · defenders named in the panel: ${R.names.length} · card ${R.card ? 'UP' : 'not up'}`}${R.fatal ? ` · FATAL ${R.fatal.slice(0, 200)}` : ''}${errors.length ? ` · ${errors.length} console error(s): ${errors[0]}` : ''}`);
    if (want === 'off') console.log(`    his line with the rule off: ${R.plain}`);
    if (OUT) { try { await page.screenshot({ path: `${OUT}/deathrecap-${name}-hud.png`, timeout: 90000 }); } catch (x) { console.log(`  (no still of the HUD: ${String(x.message || x).split('\n')[0]})`); } }
    await browser.close();
  }
  console.log(failed ? '=== deathrecap-page: FAILED ===' : '=== deathrecap-page: ALL PASS ===');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
