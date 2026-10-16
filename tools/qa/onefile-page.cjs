// THE ONE-FILE BUILD, ON THE REAL PAGE (tools/build-one.ts → dist/one/twopointsix.html; its boot script src/host/onefile.ts). The maintainer, 10-16: "we
// should have a build mode to package everything up".
// The file is served by a server that knows ONE address and nothing else: no folder beside the page, and the same address with a query is a 404 (a host
// that cannot carry flags). In headless Chromium, no WebGPU adapter (the title and the Play page are plain DOM, live from the first tick):
//   - the pack answers what the game asks for: the cast, the animation library's .bin byte for byte (its digest), a level file by the dev server's /levels/ address, the
//     build's commit, a mission picture set on an <img>; a file that is not packed still goes to the network;
//   - the Play page draws from it, and Team & kit → Deploy (a page load of the page's own address with the mission's flags) lands in the mission's flags
//     with no request but the one address (the Team & kit picture, a second instance of the page in a frame, included: its flags reach it), a reload
//     keeps them, Back is the start page again (Deploy made a history entry), two loads asked for at once end in the last, and a load of the bare address is the
//     title again;
//   - at the end: the server was asked for nothing else.
//   bun run build:one && node tools/qa/onefile-page.cjs [outDir]      env: ONEFILE=<file> (default dist/one/twopointsix.html) · ONEFILE_BREAK=1 (the page
//   served with its boot script taken out: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. Nothing here needs a GPU, and nothing here has been seen on one: the canvas is never up on this adapter.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const outDir = process.argv[2] || '';
const FILE = path.resolve(root, process.env.ONEFILE || 'dist/one/twopointsix.html');
const BREAK = process.env.ONEFILE_BREAK === '1';
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const J = JSON.stringify;
if (!fs.existsSync(FILE)) { console.error(`${FILE} is not there: bun run build:one`); process.exit(1); }
if (outDir) fs.mkdirSync(outDir, { recursive: true });
let html = fs.readFileSync(FILE, 'utf8');
if (BREAK) { const at = html.lastIndexOf('<script>'), end = html.indexOf('</script>', at); html = html.slice(0, at) + '<script>' + html.slice(end); }

const asked = [];
const server = http.createServer((q, r) => { asked.push(q.url); if (q.url === '/play') { r.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); r.end(html); } else { r.writeHead(404); r.end(); } });

(async () => {
  await new Promise(res => server.listen(0, '127.0.0.1', res));
  const at = `http://127.0.0.1:${server.address().port}/play`;
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
  const press = async re => { const h = await page.evaluateHandle(src => [...document.querySelectorAll('#menu .btn, #missions .btn, #missions button, #missions a')].find(e => e.offsetParent && new RegExp(src, 'i').test(e.textContent.trim())) ?? null, re.source); const el = h.asElement(); if (!el) return false; await el.click(); return true; };
  /** mark this document, do `go`, and wait for ANOTHER document of the page to stand (a history call on the way is not one) with `when` true in it */
  const reloaded = async (go, when = () => true) => { await page.evaluate(() => { window.__before = true; }); await go(); return page.waitForFunction(w => !window.__before && document.readyState !== 'loading' && new Function('return (' + w + ')()')(), when.toString(), { timeout: 30000 }).then(() => true, () => false); };

  await page.goto(at, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('#menu.title.on', { timeout: 30000 }).catch(() => {});
  check(await page.evaluate(() => !!document.querySelector('#menu.title.on')) && asked.length === 1, 'the file opens on the title from one address', `asked ${J(asked)}`);

  // ---- the pack ----
  const sha = buf => require('crypto').createHash('sha256').update(buf).digest('hex');
  const disk = { bin: sha(fs.readFileSync(path.join(root, 'public/assets/ual/AnimationLibrary_Godot_Standard.bin'))), boxes: JSON.parse(fs.readFileSync(path.join(root, 'levels/depot.json'), 'utf8')).boxes.length };
  const got = await page.evaluate(async () => {
    const tryIt = async f => { try { return await f(); } catch (e) { return 'threw: ' + String(e).slice(0, 80); } };
    return {
      cast: await tryIt(async () => { const g = await (await fetch(new URL('assets/chars/cast-gwot.gltf', document.baseURI).href)).json(); return g.buffers.every(b => b.uri.startsWith('data:')) ? g.meshes.length : 'a buffer is not inline'; }),
      bin: await tryIt(async () => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(new URL('assets/ual/AnimationLibrary_Godot_Standard.bin', document.baseURI).href)).arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('')),
      boxes: await tryIt(async () => (await (await fetch('/levels/depot.json', { cache: 'no-store' })).json()).boxes.length),
      commit: await tryIt(async () => { const r = await fetch('/qa/commit', { cache: 'no-store' }); return r.ok ? (await r.text()).trim() : ''; }),
      picture: await tryIt(() => new Promise(res => { const i = new Image(); i.onload = () => res(i.naturalWidth); i.onerror = () => res('did not load'); i.src = new URL('assets/menu/depot-four.jpg', document.baseURI).href; })),
      stray: await tryIt(async () => (await fetch(new URL('assets/menu/not-packed.json', document.baseURI).href)).status),
    };
  });
  check(typeof got.cast === 'number' && got.cast > 0, 'the cast comes out of the page', `meshes ${J(got.cast)}`);
  check(got.bin === disk.bin, "the animation library's .bin comes out byte for byte", `sha-256 ${J(String(got.bin).slice(0, 16))}…, on disk ${disk.bin.slice(0, 16)}…`);
  check(got.boxes === disk.boxes, 'a level file comes out by the /levels/ address', `${J(got.boxes)} boxes, ${disk.boxes} on disk`);
  check(/^[0-9a-f]{7,40}$/.test(String(got.commit)) || got.commit === '', 'the page names the commit it was built from, or none (a build of uncommitted changes)', J(got.commit));
  check(typeof got.picture === 'number' && got.picture > 0, 'a mission picture set on an <img> comes out of the page', `width ${J(got.picture)}`);
  const strays = asked.filter(u => u !== '/play');
  const mayAsk = u => u === '/assets/menu/not-packed.json' || (got.commit === '' && u === '/qa/commit');
  check(got.stray === 404 && strays.includes('/assets/menu/not-packed.json') && (BREAK || strays.every(mayAsk)), 'a file that is not packed still goes to the network', `status ${J(got.stray)}; the server was asked ${J(strays)}`);
  asked.length = 0;

  // ---- the Play page, and a mission's flags ----
  await press(/^Play/); await page.waitForSelector('#missions.on .mgrid .mrow', { state: 'attached', timeout: 20000 }).catch(() => {}); await page.waitForTimeout(1500);
  const cards = await page.evaluate(() => document.querySelectorAll('#missions.on .mgrid .mrow').length);
  check(cards > 0, 'the Play page lists its missions', `${cards} cards`);
  if (outDir) await page.screenshot({ path: path.join(outDir, 'onefile-play.png') });
  // (the picture's frame is dropped as soon as its page says there is no adapter: what it was given is read the moment it is put in, what it made of it while it stands)
  await page.evaluate(() => { window.__kv = null; new MutationObserver(() => { const f = document.querySelector('#missions iframe.kv'); if (!f) return; window.__kv ??= { name: f.name, src: f.getAttribute('src'), search: '', path: '' };
    const poll = () => { try { const l = f.contentWindow?.location; if (l && /kitview/.test(l.search)) { window.__kv.search = l.search; window.__kv.path = l.pathname; return; } } catch { /* on its way */ } if (f.isConnected) setTimeout(poll, 20); }; poll(); }).observe(document.querySelector('#missions'), { childList: true, subtree: true }); });
  await press(/^Team & kit/); await page.waitForFunction(() => window.__kv && (window.__kv.search || !document.querySelector('#missions iframe.kv')), null, { timeout: 30000 }).catch(() => {});
  const kv = await page.evaluate(() => window.__kv);
  check(!!kv && /(^|[?&])kitview(&|$)/.test(kv.search) && kv.path === '/play' && kv.src === at, "the Team & kit picture's own instance of the page gets its flags, at the one address", `${J(kv)}; asked ${J(asked)}`);
  const hist0 = await page.evaluate(() => history.length);
  const landed = await reloaded(() => press(/^Deploy/), () => location.search.length > 1);
  const m = await page.evaluate(() => ({ search: location.search, path: location.pathname, hist: history.length }));
  check(landed && m.path === '/play' && m.search.length > 1 && asked.every(u => u === '/play'), 'Deploy lands in the mission\'s flags, asking only for the one address', `loaded ${landed}; the page reads ${J(m.search)}; asked ${J(asked)}`);
  const want = m.search;
  const again = await reloaded(() => page.evaluate(() => location.reload()), () => location.search.length > 1);
  const r = await page.evaluate(() => location.search);
  check(again && r === want && want.length > 1 && asked.every(u => u === '/play'), "the page's own reload keeps the flags", `${J(r)}; asked ${J(asked)}`);
  const back = await reloaded(() => page.goBack({ waitUntil: 'commit' }).catch(() => {}), () => !!document.querySelector('#menu.on, #missions.on'));   // (the start page it left: the title, or the Play page the game reopens)
  const b = await page.evaluate(() => ({ search: location.search, path: location.pathname }));
  check(m.hist === hist0 + 1 && back && b.path === '/play' && b.search === '' && asked.every(u => u === '/play'), 'Deploy made a history entry: Back is the start page it left, with no flags', `entries ${hist0} → ${m.hist}; after Back ${J(b)}; asked ${J(asked)}`);
  const fwd = await reloaded(() => page.goForward({ waitUntil: 'commit' }).catch(() => {}), () => location.search.length > 1);
  const f = await page.evaluate(() => location.search);
  check(fwd && f === want && asked.every(u => u === '/play'), 'Forward is the mission again', `${J(f)}; asked ${J(asked)}`);
  const two = await reloaded(async () => { await page.evaluate(() => { location.assign(location.pathname + '?mute&paused#a'); location.assign(location.pathname + '?mute#b'); }); }, () => location.search.length > 1);
  const t2 = await page.evaluate(() => ({ search: location.search, hash: location.hash }));
  check(two && t2.search === '?mute' && t2.hash === '#b' && asked.every(u => u === '/play'), 'two loads asked for at once: the last one stands, its hash with it, and the server is asked for nothing else', `${J(t2)}; asked ${J(asked)}`);
  const bare = await reloaded(() => page.evaluate(() => location.assign(location.pathname)), () => !!document.querySelector('#menu.title.on'));
  const t = await page.evaluate(() => ({ search: location.search, title: !!document.querySelector('#menu.title.on') }));
  check(bare && t.search === '' && t.title && asked.every(u => u === '/play'), 'a load of the bare address is the title again', `${J(t)}; asked ${J(asked)}`);

  check(errors.length === 0, 'no page error', errors.length ? errors.join(' | ') : 'none');
  await browser.close(); server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
