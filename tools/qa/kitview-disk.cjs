// THE TEAM & KIT PICTURE ON A PAGE OPENED FROM DISK (the one-file build, tools/build-one.ts → dist/one/twopointsix.html, as a file: address; the page's half
// src/ui/kitView.ts, the picture's src/host/kitView.ts `kitViewOnDisk` / `kitViewPostTo` / `kitViewFrom`). The picture is a second instance of the page in a
// frame and the two talk by postMessage. On a file: address Chromium reads `location.origin` as 'file://', drops a message posted to that target (a console
// warning, no throw) and gives a message that does arrive the origin 'null': posted by `location.origin` nothing is said either way, and the page takes the
// frame down only at the end of its wait (ui/kitView.ts KIT_VIEW.wait, 10 s). In headless Chromium with NO WebGPU adapter and no server at all, title → Play →
// Team & kit:
//   - the frame is made and the picture's document loads from disk with its flags;
//   - THE PAGE HEARS THE PICTURE: a `{ kv: … }` message from the frame's own window, well inside the wait (the origin word it carried is printed);
//   - THE PICTURE HEARS THE PAGE: a `frame` message from its parent reaches its document (with no adapter the picture's own listener is never up: delivery
//     is what is read, here and above, by the harness's listeners);
//   - with no adapter the picture says `none` and the page takes the frame down at once, not at the wait's end;
//   - no console line "does not match the recipient window's origin".
// The listeners are put into BOTH documents by an init script (on file: the parent cannot reach into the child); each line they log is `KVLOG {…}`.
//   bun run build:one && node tools/qa/kitview-disk.cjs      env: ONEFILE=<file> (default dist/one/twopointsix.html) · KITDISK_BREAK=1 (must FAIL: the init
//   script, in both documents, hands the page the OTHER window — `window.parent`, a frame's `contentWindow`, a message's `source` — as a stand-in whose
//   postMessage rewrites a target of '*' back to `location.origin`, the code as it was, so the messages are dropped)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. Nothing here needs a GPU, and nothing here has been seen on one: the picture itself is never up on
// this adapter (its instance says `none`), and no browser but Chromium has been tried.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const FILE = path.resolve(root, process.env.ONEFILE || 'dist/one/twopointsix.html');
const BREAK = process.env.KITDISK_BREAK === '1';
const WAIT = 10, SOON = 5;   // (the page's wait for a `ready`, ui/kitView.ts KIT_VIEW.wait · "well inside it")
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const J = JSON.stringify;
if (!fs.existsSync(FILE)) { console.error(`${path.relative(root, FILE)} is not there: bun run build:one`); process.exit(1); }

/** runs in every document of the page before its own scripts */
const init = brk => {
  const child = window.parent !== window, up = window.parent, role = child ? 'child' : 'parent';
  const srcOf = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'source').get, winOf = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow').get;
  const log = o => console.log('KVLOG ' + JSON.stringify({ role, t: Math.round(performance.timeOrigin + performance.now()), ...o }));
  addEventListener('message', e => { const d = e.data; if (!d || typeof d !== 'object' || !('kv' in d)) return;
    const s = srcOf.call(e), f = document.querySelector('#missions iframe.kv');
    log({ ev: 'heard', kv: String(d.kv), origin: e.origin, own: child ? s === up : !!f && s === winOf.call(f) }); }, true);   // (own: from the very window it must come from)
  addEventListener('DOMContentLoaded', () => {
    const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s);
    log({ ev: 'document', protocol: location.protocol, origin: location.origin, search: location.search });
    if (child) return;
    let had = false;   // the frame element, as the page has it
    new MutationObserver(() => { const f = document.querySelector('#missions iframe.kv'); if (!!f !== had) { had = !!f; log({ ev: f ? 'made' : 'removed' }); } }).observe(document.documentElement, { childList: true, subtree: true });
  });
  if (!brk) return;
  const wraps = new WeakMap(), wrap = w => { if (!w || w === window) return w; let p = wraps.get(w);
    if (!p) wraps.set(w, p = { postMessage: (m, to, ...rest) => w.postMessage(m, to === '*' ? location.origin : to, ...rest) }); return p; };
  if (child) Object.defineProperty(window, 'parent', { get: () => wrap(up), configurable: true });
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', { get() { return wrap(winOf.call(this)); }, configurable: true });
  Object.defineProperty(MessageEvent.prototype, 'source', { get() { return wrap(srcOf.call(this)); }, configurable: true });
};

(async () => {
  const browser = await chromium.launch({ args: ['--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(init, BREAK);
  const page = await ctx.newPage();
  const logs = [], dropped = [];
  page.on('console', m => { const t = m.text(); if (t.startsWith('KVLOG ')) { try { logs.push(JSON.parse(t.slice(6))); } catch { /* */ } return; }
    if (/does not match the recipient window's origin/.test(t)) dropped.push(t.replace(/\s+/g, ' ').slice(0, 200)); });
  page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
  const press = async re => { const h = await page.evaluateHandle(src => [...document.querySelectorAll('#menu .btn, #missions .btn, #missions button, #missions a')].find(e => e.offsetParent && new RegExp(src, 'i').test(e.textContent.trim())) ?? null, re.source); const el = h.asElement(); if (!el) return false; await el.click(); return true; };

  await page.goto(require('url').pathToFileURL(FILE).href, { waitUntil: 'domcontentloaded', timeout: 120000 });
  const title = await page.waitForSelector('#menu.title.on', { timeout: 60000 }).then(() => true, () => false);
  const played = await press(/^Play/);
  const cards = await page.waitForSelector('#missions.on .mgrid .mrow', { state: 'attached', timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(1500);
  const t0 = Date.now(), pressed = await press(/^Team & kit/);
  const ev = (role, k) => logs.filter(l => l.role === role && l.ev === k && l.t >= t0);
  for (const end = t0 + (WAIT + 4) * 1000; Date.now() < end && !(ev('parent', 'made').length && ev('parent', 'removed').length);) await page.waitForTimeout(100);
  await page.waitForTimeout(300);
  await browser.close();

  const s = l => '+' + ((l.t - t0) / 1000).toFixed(2) + ' s';
  const fold = L => { const m = new Map(); for (const l of L) { if (!m.has(l.kv)) m.set(l.kv, { n: 0, first: l }); m.get(l.kv).n++; } return [...m].map(([k, v]) => `${k} ×${v.n} (first ${s(v.first)})`).join(', ') || 'NOTHING'; };
  const pdoc = logs.find(l => l.role === 'parent' && l.ev === 'document'), cdoc = ev('child', 'document')[0];
  const made = ev('parent', 'made')[0], removed = ev('parent', 'removed')[0];
  const heardP = ev('parent', 'heard'), ownP = heardP.filter(l => l.own), heardC = ev('child', 'heard'), ownC = heardC.filter(l => l.own);
  const none = ownP.find(l => l.kv === 'none');
  console.log(`kitview-disk: ${path.relative(root, FILE)} opened from disk${BREAK ? " — KITDISK_BREAK: a target of '*' goes back to location.origin (must FAIL)" : ''}; the page reads location.origin ${J(pdoc?.origin)}`);
  check(pdoc?.protocol === 'file:' && !!made && !!cdoc && cdoc.protocol === 'file:' && /(^|[?&])kitview(&|$)/.test(cdoc.search), "the frame is made and the picture's document loads from disk with its flags",
    `title ${title}, Play ${played}, cards ${cards}, Team & kit ${pressed}; frame ${made ? 'made ' + s(made) : 'NEVER MADE'}; its document ${cdoc ? `${s(cdoc)} ${cdoc.protocol} search ${J(cdoc.search)}` : 'not seen'}`);
  check(!!ownP[0] && ownP[0].t - t0 < SOON * 1000, `THE PAGE HEARS THE PICTURE: a kv message from the frame's own window within ${SOON} s (the wait is ${WAIT} s)`,
    `heard ${fold(ownP)}${ownP[0] ? ` — the origin word it carried: ${J(ownP[0].origin)}` : ''}${heardP.length > ownP.length ? `; ${heardP.length - ownP.length} from another window` : ''}`);
  check(ownC.some(l => l.kv === 'frame'), 'THE PICTURE HEARS THE PAGE: a `frame` message from its parent',
    `heard ${fold(ownC)}${ownC[0] ? ` — the origin word: ${J(ownC[0].origin)}` : ''}${heardC.length > ownC.length ? `; ${heardC.length - ownC.length} from another window` : ''}`);
  check(!!none && !!removed && removed.t - t0 < SOON * 1000, `no adapter: the picture says \`none\` and the page takes the frame down within ${SOON} s, not at the wait's end`,
    `\`none\` ${none ? s(none) : 'NOT HEARD'}; frame ${removed ? 'removed ' + s(removed) : `still there ${WAIT + 4} s on`}`);
  check(dropped.length === 0, 'no message dropped for its target (no "does not match the recipient window\'s origin" on the console)', dropped.length ? `${dropped.length}: ${dropped[0]}` : 'none');
  check(errors.length === 0, 'no page error', errors.length ? errors.join(' | ') : 'none');
  console.log(fails ? `\n=== kitview-disk: ${fails} FAIL ===` : '\n=== kitview-disk: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
