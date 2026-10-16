// The mission pictures, taken from PLAY (public/assets/menu/<mission id>.jpg + stills.json — src/ui/menuStills.ts loads them).
//
// Each picture is a frame of the real page: the mission booted from its own link in headless Chromium on the software WebGPU
// adapter, played by the in-page director (director.js: Sam on the walk keys, the squad on the order menu's orders, the fight
// the game's own) with nothing drawn until its recipe's moment (recipes.cjs), then drawn from a camera pinned for the still.
// No GPU here: a frame at 'high' costs ~20 s, so a picture is minutes — the play before it costs only what the simulation does.
//
//   node tools/menu-shots/shots.cjs make [id …] [--jobs 2] [--out public/assets/menu] [--frames N]
//       the recipes named (none = all of them), each on a fresh page; writes <out>/<id>.jpg and names it in <out>/stills.json.
//       A play that never reached its moment writes nothing (exit 1). tools/menu-art.ts leaves a mission with a recipe alone
//       unless it is named there.
//   node tools/menu-shots/shots.cjs serve [port]
//       for FINDING a moment and a camera: pages kept alive between calls —
//         GET  /open?name=a&q=<mission query>[&quality=high&w=760&h=475]     boot a page
//         POST /eval?name=a          body = the body of an async function run in the page (ms = window.__ms) → its JSON
//         GET  /shot?name=a&out=<file.png|.jpg>[&frames=24]                  ms.draw → a file
//         GET  /close?name=a · /list
//       every request carries the header X-Menu-Shots: 1 (a web page open beside it cannot send one unasked)
//   env: PORT = the dev server's (bun run dev; default 5199)
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process');

const PORT = process.env.PORT || 5199, ROOT = path.join(__dirname, '..', '..');
const W = 760, H = 475;
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const director = () => fs.readFileSync(path.join(__dirname, 'director.js'), 'utf8');   // read at every boot: the daemon takes an edit without a restart
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);

let browser = null;   // (the launch's promise: two boots at once share one Chromium)
async function open(query, o = {}) {
  browser ??= chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const page = await (await browser).newPage({ viewport: { width: +o.w || W, height: +o.h || H }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e.message ?? e))); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 300)); });
  // ?paused: nothing runs until stepped · ?cutprograms=boot: one set of ray programs with the cut rule in (no second compile behind the page's back)
  await page.goto(`http://localhost:${PORT}/?paused&quality=${o.quality || 'high'}&mute&cutprograms=boot&${query}`, { timeout: 0 });   // (the bundle alone can take a minute beside a page that is drawing)
  const fatal = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; window.__menu.close(); window.__game.godMode = true; return document.getElementById('fatal')?.textContent || ''; });
  if (fatal) { await page.close(); throw new Error('boot: ' + fatal); }
  await page.addScriptTag({ content: director() });
  page.setDefaultTimeout(0);
  return { page, errors };
}
const run = (page, body) => page.evaluate(`(async () => { const ms = window.__ms, g = window.__game; ${body}\n})()`);
async function shot(page, file, frames = 24) {
  const jpg = /\.jpe?g$/.test(file), cap = await page.evaluate(([n]) => window.__ms.draw(n), [frames]); if (cap.err) throw new Error(cap.err);
  const png = jpg ? file.replace(/\.jpe?g$/, '.tmp.png') : file; fs.mkdirSync(path.dirname(png), { recursive: true }); fs.writeFileSync(png, Buffer.from(cap.url.split(',')[1], 'base64'));
  if (jpg) try { execFileSync('convert', [png, '-resize', `${W}x${H}^`, '-gravity', 'center', '-extent', `${W}x${H}`, '-quality', '88', '-sampling-factor', '4:2:0', '-strip', file]); } finally { fs.unlinkSync(png); }   // (the card's size: a page opened at another shape is cropped to it, never squashed)
  return { w: cap.w, h: cap.h, secs: cap.secs, bytes: fs.statSync(file).size };
}

async function make(ids, o) {
  const R = require('./recipes.cjs'), names = ids.length ? ids : Object.keys(R), out = path.resolve(ROOT, o.out || 'public/assets/menu'); let bad = 0;
  for (const id of names) if (!R[id]) { console.error('no recipe: ' + id); process.exit(2); }
  const queue = names.slice(), made = [], worker = async () => { for (let id; (id = queue.shift());) { const r = R[id]; let page = null;
    try { log(id, 'boot', r.query); const o2 = await open(r.query, r); page = o2.page;
      const played = await run(page, r.play); log(id, 'played', JSON.stringify(played ?? null).slice(0, 300));
      if (played && played.hit === false) throw new Error('the play ran out of time short of its moment: nothing written');
      if (typeof r.cam === 'string') await run(page, r.cam); else await page.evaluate(pin => window.__ms.cam(pin), r.cam);   // a camera as text = laid on the run as it stands (ms.frameOn)
      log(id, 'drawn', JSON.stringify(await shot(page, path.join(out, id + '.jpg'), +o.frames || r.frames || 24)), o2.errors.length ? 'ERRORS ' + o2.errors.join(' | ') : ''); made.push(id);
    } catch (e) { bad++; log(id, 'FAILED', e.stack || e); } finally { await page?.close().catch(() => {}); } } };
  await Promise.all(Array.from({ length: Math.max(1, +o.jobs || 1) }, worker));
  // the list the menu reads is tools/menu-art.ts's (its shape, its pruning): a picture made here is only NAMED in it
  const list = path.join(out, 'stills.json'), L = (() => { try { return JSON.parse(fs.readFileSync(list, 'utf8')); } catch { return { v: 1, w: W, h: H, stills: {} }; } })();
  for (const id of made) L.stills[id] = 1; L.stills = Object.fromEntries(Object.keys(L.stills).sort().map(k => [k, 1]));
  fs.writeFileSync(list, JSON.stringify(L, null, 1) + '\n');
  log(`${made.length} of ${names.length} made · ${Object.keys(L.stills).length} in stills.json`);
  await (await browser)?.close(); process.exit(bad ? 1 : 0);
}

function serve(port) {
  const pages = new Map();
  http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x'), q = Object.fromEntries(u.searchParams), name = q.name || 'a'; let body = ''; for await (const c of req) body += c;
    const done = (code, v) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(v, null, 1) + '\n'); };
    if (req.headers['x-menu-shots'] !== '1') return done(403, { err: 'send X-Menu-Shots: 1' });
    try {
      if (u.pathname === '/open') { await pages.get(name)?.page.close(); pages.delete(name); const t = Date.now(), p = await open(q.q, q); pages.set(name, p); return done(200, { name, bootSecs: Math.round((Date.now() - t) / 1000) }); }
      if (u.pathname === '/list') return done(200, [...pages.keys()]);
      const p = pages.get(name); if (!p) return done(404, { err: 'no page ' + name });
      if (u.pathname === '/eval') { const v = await run(p.page, body); return done(200, { v, errors: p.errors.splice(0) }); }
      if (u.pathname === '/shot') return done(200, await shot(p.page, path.resolve(q.out), +q.frames || 24));
      if (u.pathname === '/close') { await p.page.close(); pages.delete(name); return done(200, { closed: name }); }
      done(404, { err: 'what' });
    } catch (e) { done(500, { err: String(e.stack || e).slice(0, 2000) }); }
  }).listen(port, '127.0.0.1', () => log('menu-shots on', port));
}

const [mode, ...rest] = process.argv.slice(2), opts = {}, ids = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i]; else ids.push(rest[i]); }
if (mode === 'make') make(ids, opts); else if (mode === 'serve') serve(+ids[0] || 5298);
else { console.error('usage: shots.cjs make [id …] [--jobs N] [--out dir] [--frames N] | serve [port]'); process.exit(2); }
