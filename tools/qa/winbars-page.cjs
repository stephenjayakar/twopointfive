// A WINDOW'S BAR BREAKS FROM ONE ROUND, ON THE REAL PAGE (game/winbars.ts; the headless check is `probes.ts winbars`): boots The Pass in headless Chromium on
// the SOFTWARE WebGPU adapter (SwiftShader — no GPU needed, and no GPU's picture), twice — as it opens, and with ?winbars=0 — stands Sam a stride and a half
// off a window's bar with floor on its far side, the cursor on the bar, and clicks the trigger through the page's own input.
// Asked: as it opens, the switch reads on in the page's knob registry, ONE click and the bar is gone (hidden to rays, pieces in the debris pool) and the round's
// own 'shot' event ends beyond where it stood; with ?winbars=0 the same click's round ends at the bar and the bar stands; no console error on either page.
// The bar is found in the page (the first that fits), so the check moves with the level and names what it used.
//   node tools/qa/winbars-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · SIZE (960x540) · QUALITY (verylow) · LEVEL (pass.json)
// exit 0 = every line passed · 1 = one failed. Slow by nature: minutes a boot on the software adapter. Each page is its own run of this file and its own
// browser (WB_TAG=on|off, set by the parent run): a second page booted beside a first that is still drawing on the software adapter starves.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'winbars-page';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
const LEVEL = process.env.LEVEL || 'pass.json';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });

// in the page: find the bar, stage Sam, click once, read the round and the bar
const SHOOT = async ({ only }) => {
  const g = window.__game, K = window.__knobs.registry().WINBARS, nav = g.col.nav, boxes = g.col.boxes, BAR = 1 << 19, HIDE = 1 | 2;
  try { window.__menu.close(); } catch {}
  window.__smoke.params.enabled = false; g.godMode = true; g.aiEnabled = false; g.infiniteAmmo = true;
  for (const gd of g.guards) { gd.hold = true; gd.pinned = true; }
  const free = (x, z) => !nav.isBlocked(x, z); const tried = [];
  const bars = boxes.map((b, i) => i).filter(i => (boxes[i].flags & (BAR | HIDE)) === BAR);
  for (const i of bars) {
    if (only >= 0 && i !== only) continue; if (tried.length >= 6) break;
    const b = boxes[i], cs = Math.cos(b.yaw), sn = Math.sin(b.yaw), n = b.h[0] > b.h[2] ? [cs, 0, -sn] : [sn, 0, cs], half = Math.max(b.h[0], b.h[2]), y = Math.min(1.3, b.c[1] + b.h[1] - 0.15);
    for (const s of [1, -1]) {
      const A = [b.c[0] + n[0] * s * (half + 1.5), 0, b.c[2] + n[2] * s * (half + 1.5)], B = [b.c[0] - n[0] * s * (half + 1.5), 0, b.c[2] - n[2] * s * (half + 1.5)];
      if (!free(A[0], A[2]) || !free(B[0], B[2])) continue;
      const d = [-n[0] * s, 0, -n[2] * s], h = g.col.raycast([A[0], y, A[2]], d, 3); if (!h || h.index !== i) continue;
      // Sam at A facing the bar, the camera pinned over it so the middle of the page is the bar
      window.__stage({ look: [b.c[0], y, b.c[2]], yaw: 0, pitch: 1.5, dist: 9 }, { player: { pos: A, yaw: Math.atan2(d[0], d[2]), invisible: true } });
      g.player.holstered = false; window.__mouse(innerWidth / 2, innerHeight / 2);
      window.__runFrames(50, 1 / 60);
      // the cursor walked a pixel at a time until the round's own line meets the bar first, then set in the middle of the pixels that do (the bar is 8 cm
      // across; a round with nothing under the reticle flies from the muzzle at a point 20 m out along the heading from his own axis: player.ts freeAim)
      const onBar = () => { const c = g.player.char, m = c.muzzle, ap = g.aimPoint, hx = ap[0] - c.pos[0], hz = ap[2] - c.pos[2], hl = Math.hypot(hx, hz); if (hl < 0.3) return false;
        const R = Math.max(hl, 20), T = [c.pos[0] + hx / hl * R, m[1], c.pos[2] + hz / hl * R], v = [T[0] - m[0], 0, T[2] - m[2]], l = Math.hypot(v[0], v[2]); const hit = g.col.raycast(m, [v[0] / l, 0, v[2] / l], 4); return !!hit && hit.index === i; };
      const good = [];
      for (let k = -40; k <= 40; k++) { window.__mouse(innerWidth / 2 + k, innerHeight / 2); window.__runFrames(6, 1 / 60); if (onBar()) good.push(k); }
      const px = good.length ? good[good.length >> 1] : 0; window.__mouse(innerWidth / 2 + px, innerHeight / 2); window.__runFrames(60, 1 / 60); const aimed = good.length > 0 && onBar();
      if (!aimed) { tried.push({ index: i, side: s, aimed: false }); continue; }
      const ev0 = g.events.length, deb0 = g.destr.debris.list.length; let shot = null, clicks = 0;
      for (let k = 0; k < 4 && !shot; k++) { window.__click(0); clicks++; window.__runFrames(12, 1 / 60); shot = g.events.slice(ev0).filter(e => e.kind === 'shot' && e.from && e.to).pop() ?? null; }
      const shots = g.events.slice(ev0).filter(e => e.kind === 'shot').length;
      const far = shot ? Math.hypot(shot.to[0] - shot.from[0], shot.to[2] - shot.from[2]) : -1, at = shot ? Math.abs((b.c[0] - shot.from[0]) * n[0] + (b.c[2] - shot.from[2]) * n[2]) : -1;
      const after = g.col.raycast([A[0], y, A[2]], d, 3);
      tried.push({ index: i, side: s, px, far: +far.toFixed(2), bar: +at.toFixed(2), deep: +(2 * half).toFixed(2), shots, clicks, hidden: (b.flags & HIDE) === HIDE, rayMeetsBar: !!after && after.index === i, pieces: g.destr.debris.list.length - deb0,
        fire: g.col.firePass ? g.col.firePass() : null, gun: (g.player.gunInHand?.() ?? g.player.pistol).def.id });
      return { on: K ? K.on : null, pick: tried[tried.length - 1], bars: bars.length };
    }
    tried.push({ index: i, skipped: true });
  }
  return { on: K ? K.on : null, pick: null, bars: bars.length, list: tried };
};

// ---- one page (a child run: WB_TAG = on | off, WB_ONLY = the bar the 'on' page used)
async function onePage(tag) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errors = []; let R = null;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return; if (/Failed to load resource/.test(x)) return; errors.push(`${tag} ${t}: ${x.slice(0, 500)}`); });
  page.on('pageerror', x => errors.push(`${tag} pageerror: ` + String(x && x.stack || x).slice(0, 800)));
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${tag} http ${r.status()}: ${r.url()}`); });
  try {
    const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute&roomclear&squad=0&levelFile=${LEVEL}${tag === 'off' ? '&winbars=0' : ''}`; log('goto', url);
    await page.goto(url);
    const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines }; });
    log(tag, 'ready', JSON.stringify(ready)); if (ready.fatal) errors.push(`${tag} fatal: ` + ready.fatal);
    R = await page.evaluate(SHOOT, { only: tag === 'off' ? +(process.env.WB_ONLY ?? -2) : -1 }); log(tag, JSON.stringify(R));
    await page.evaluate(() => { window.__runFrames(30, 1 / 60); });
    await page.screenshot({ path: path.join(outDir, `${tag}-page.png`), timeout: 20000 }).catch(() => {});
  } catch (e) { errors.push(`${tag} threw: ` + String(e && e.stack || e).slice(0, 800)); }
  fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify({ R, errors }));
  process.exit(0);   // (the browser goes with the process: a page on the software adapter can take minutes to close)
}

function judge() {
  const { spawnSync } = require('child_process'); const R = {}, errors = [];
  for (const tag of ['on', 'off']) {
    const f = path.join(outDir, `${tag}.json`); fs.rmSync(f, { force: true });
    const r = spawnSync(process.execPath, [__filename, outDir], { env: { ...process.env, WB_TAG: tag, WB_ONLY: String(R.on?.pick?.index ?? -2) }, stdio: 'inherit', timeout: 30 * 60 * 1000, killSignal: 'SIGKILL' });
    if (!fs.existsSync(f)) { errors.push(`${tag}: the page run left no result (status ${r.status}, signal ${r.signal})`); continue; }
    const J = JSON.parse(fs.readFileSync(f, 'utf8')); R[tag] = J.R; errors.push(...J.errors);
  }
  const lines = []; const ok = (pass, label, detail) => { lines.push(`- ${pass ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); return pass; };
  let all = true; const A = R.on, B = R.off, BAR = 1 << 19;
  all = ok(!!A && A.on === true && !!B && B.on === false, 'the page opens with the rule on, and ?winbars=0 puts it off', `WINBARS.on as the page opens ${A?.on}, with ?winbars=0 ${B?.on}; ${A?.bars} bars stand on ${LEVEL}`) && all;
  all = ok(!!A?.pick && A.pick.shots === 1 && A.pick.hidden && !A.pick.rayMeetsBar && A.pick.pieces >= 1 && A.pick.far > A.pick.bar + 0.02 && A.pick.fire === BAR, 'as it opens: one clicked round and the bar is gone, in pieces, and the round ended beyond where it stood',
    `bar ${A?.pick?.index} (${A?.pick?.deep} m deep), ${A?.pick?.gun}: ${A?.pick?.shots} round, hidden ${A?.pick?.hidden}, a ray still meets it ${A?.pick?.rayMeetsBar}, ${A?.pick?.pieces} pieces, the round flew ${A?.pick?.far} m, the bar's middle stood ${A?.pick?.bar} m off${A?.pick ? '' : ' — ' + JSON.stringify(A?.list ?? A)}`) && all;
  all = ok(!!B?.pick && B.pick.index === A?.pick?.index && B.pick.shots === 1 && !B.pick.hidden && B.pick.rayMeetsBar && B.pick.pieces === 0 && B.pick.far < B.pick.bar + 0.02 && B.pick.fire === 0, 'with ?winbars=0 the same click ends at the bar and the bar stands',
    `bar ${B?.pick?.index}: ${B?.pick?.shots} round, hidden ${B?.pick?.hidden}, a ray meets it ${B?.pick?.rayMeetsBar}, ${B?.pick?.pieces} pieces, the round flew ${B?.pick?.far} m, the bar's middle stands ${B?.pick?.bar} m off${B?.pick ? '' : ' — ' + JSON.stringify(B?.list ?? B)}`) && all;
  all = ok(errors.length === 0, 'no console error on either page', errors.slice(0, 6).join(' | ') || 'none') && all;
  console.log('\n=== winbars-page: a window bar broken by one round on the real page (software adapter) ===\n' + lines.join('\n') + `\n=== winbars-page: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ R, errors, pass: all }, null, 1));
  process.exit(all ? 0 : 1);
}
if (process.env.WB_TAG) onePage(process.env.WB_TAG); else judge();
