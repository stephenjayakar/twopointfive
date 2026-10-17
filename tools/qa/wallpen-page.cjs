// ROUNDS THROUGH THIN WALLS, ON THE REAL PAGE (game/wallpen.ts; the headless family is `probes.ts wallpen`): boots the page in headless Chromium on the
// SOFTWARE WebGPU adapter (SwiftShader — no GPU needed, and no GPU's picture), twice — as it opens, and with ?wallpen=0 — stands Sam a stride and a half off
// a full-height plasterboard partition of the office with floor on its far side, the cursor on that floor, and clicks the trigger through the page's own input.
// Asked: as it opens, the switch reads on in the page's knob registry, the round's own 'shot' event ends BEYOND the partition's far face and both faces got a
// mark; with ?wallpen=0 the same click's round ends AT the partition; the Tab panel has the row; no console error on either page.
// The partition is found in the page (the first that fits), so the check moves with the level and names what it used.
//   node tools/qa/wallpen-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · SIZE (960x540) · QUALITY (verylow)
// exit 0 = every line passed · 1 = one failed. Slow by nature: minutes a boot on the software adapter. Each page is its own run of this file and its own
// browser (WP_TAG=on|off, set by the parent run): a second page booted beside a first that is still drawing on the software adapter starves.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || 'wallpen-page';
const PORT = process.env.PORT || 5199;
const [W, H] = (process.env.SIZE || '960x540').split('x').map(Number);
const QUALITY = process.env.QUALITY || 'verylow';
const FLAGS = ['--enable-unsafe-webgpu', '--use-gl=angle', '--use-angle=swiftshader', '--enable-features=Vulkan', '--use-vulkan=swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog'];
const T0 = Date.now(); const log = (...a) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)}s]`, ...a);
fs.mkdirSync(outDir, { recursive: true });

// in the page: find the partition, stage Sam, click, read the round
const SHOOT = async ({ only }) => {
  const g = window.__game, K = window.__knobs.registry().WALLPEN, nav = g.col.nav, boxes = g.col.boxes;
  window.__menu.close(); window.__smoke.params.enabled = false; g.godMode = true; g.aiEnabled = false; g.infiniteAmmo = true;
  const free = (x, z) => !nav.isBlocked(x, z);
  const cast = (o, d, L) => g.col.raycast(o, d, L);
  const tried = [];
  for (let i = 0; i < boxes.length && tried.length < 12; i++) {
    const b = boxes[i]; if (only >= 0 && i !== only) continue; if (b.flags & (2 | 8 | (1 << 17)) || b.rot || Math.abs(Math.sin(b.yaw)) > 1e-6) continue;
    const y0 = b.c[1] - b.h[1], y1 = b.c[1] + b.h[1], thin = Math.min(b.h[0], b.h[2]) * 2, long = Math.max(b.h[0], b.h[2]) * 2;
    if (y0 > 0.1 || y1 < 2.2 || thin > 0.17 || long < 1.5) continue;
    const n = b.h[0] < b.h[2] ? [1, 0, 0] : [0, 0, 1], half = thin / 2;
    for (const s of [1, -1]) {
      const A = [b.c[0] + n[0] * s * (half + 1.5), 0, b.c[2] + n[2] * s * (half + 1.5)], B = [b.c[0] - n[0] * s * (half + 1.5), 0, b.c[2] - n[2] * s * (half + 1.5)];
      if (!free(A[0], A[2]) || !free(B[0], B[2])) continue;
      const d = [-n[0] * s, 0, -n[2] * s], h = cast([A[0], 1.2, A[2]], d, 3 + thin); if (!h || h.index !== i) continue;
      if (cast([b.c[0] + d[0] * (half + 0.01), 1.2, b.c[2] + d[2] * (half + 0.01)], d, 1.6)) continue;   // open floor beyond it
      // Sam at A facing the wall, the camera pinned over the far-side floor so the middle of the page is the point B
      window.__stage({ look: [B[0], 1.0, B[2]], yaw: 0, pitch: 1.45, dist: 9 }, { player: { pos: A, yaw: Math.atan2(d[0], d[2]), invisible: true } });
      g.player.holstered = false; window.__mouse(innerWidth / 2, innerHeight / 2);
      window.__runFrames(50, 1 / 60);
      const ev0 = g.events.length, m0 = g.decals.list.length; let shot = null;
      for (let k = 0; k < 4 && !shot; k++) { window.__click(0); window.__runFrames(12, 1 / 60); shot = g.events.slice(ev0).filter(e => e.kind === 'shot' && e.from && e.to).pop() ?? null; }
      const far = shot ? Math.hypot(shot.to[0] - shot.from[0], shot.to[2] - shot.from[2]) : -1, wall = shot ? Math.abs((b.c[0] - shot.from[0]) * n[0] + (b.c[2] - shot.from[2]) * n[2]) : -1;
      tried.push({ index: i, thin: +thin.toFixed(3), far: +far.toFixed(2), wall: +wall.toFixed(2), marks: g.decals.list.length - m0, gun: (g.player.gunInHand?.() ?? g.player.pistol).def.id });
      const T = tried[tried.length - 1]; if (shot && (only >= 0 || T.far > T.wall + T.thin + 0.3)) return { on: K ? K.on : null, men: K ? K.men : null, pick: T, tried: tried.length };   // (as it opens: the first partition a round gets through — a shell wall in the same paint stops it, rightly, and is passed over)
      break;
    }
  }
  return { on: K ? K.on : null, men: K ? K.men : null, pick: null, tried: tried.length, list: tried };
};
const PANEL = () => { window.__panel.toggle(); const s = document.querySelector('#panel input[type=search], #panel input'); if (s) { s.value = 'thin walls'; s.dispatchEvent(new Event('input', { bubbles: true })); }
  return (document.querySelector('#panel')?.innerText ?? '').split('\n').filter(l => /thin walls/.test(l)).slice(0, 6); };

// ---- one page (a child run: WP_TAG = on | off, WP_ONLY = the partition the 'on' page used)
async function onePage(tag) {
  const browser = await chromium.launch({ headless: true, channel: 'chromium', args: FLAGS });
  const errors = []; let R = null;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', m => { const t = m.type(), x = m.text(); if (t !== 'error' && !(t === 'warning' && !/WebGPU is experimental|SwiftShader|powerPreference|fallback adapter/i.test(x))) return; if (/Failed to load resource/.test(x)) return; errors.push(`${tag} ${t}: ${x.slice(0, 500)}`); });
  page.on('pageerror', x => errors.push(`${tag} pageerror: ` + String(x && x.stack || x).slice(0, 800)));
  page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) errors.push(`${tag} http ${r.status()}: ${r.url()}`); });
  try {
    const url = `http://localhost:${PORT}/?paused&quality=${QUALITY}&mute${tag === 'off' ? '&wallpen=0' : ''}`; log('goto', url);
    await page.goto(url);
    const ready = await page.evaluate(async () => { await window.__ready; window.__testVisible = true; return { fatal: document.getElementById('fatal')?.textContent || '', pipelines: window.__boot?.pipelines }; });
    log(tag, 'ready', JSON.stringify(ready)); if (ready.fatal) errors.push(`${tag} fatal: ` + ready.fatal);
    R = await page.evaluate(SHOOT, { only: tag === 'off' ? +(process.env.WP_ONLY ?? -2) : -1 }); log(tag, JSON.stringify(R));
    if (tag === 'on') { R.panel = await page.evaluate(PANEL); log(tag, 'panel', JSON.stringify(R.panel).slice(0, 200)); }
    await page.screenshot({ path: path.join(outDir, `${tag}-page.png`), timeout: 20000 }).catch(() => {});
  } catch (e) { errors.push(`${tag} threw: ` + String(e && e.stack || e).slice(0, 800)); }
  fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify({ R, errors }));
  process.exit(0);   // (the browser goes with the process: a page on the software adapter can take minutes to close)
}

function judge() {
  const { spawnSync } = require('child_process'); const R = {}, errors = [];
  for (const tag of ['on', 'off']) {
    const f = path.join(outDir, `${tag}.json`); fs.rmSync(f, { force: true });
    const r = spawnSync(process.execPath, [__filename, outDir], { env: { ...process.env, WP_TAG: tag, WP_ONLY: String(R.on?.pick?.index ?? -2) }, stdio: 'inherit', timeout: 30 * 60 * 1000, killSignal: 'SIGKILL' });
    if (!fs.existsSync(f)) { errors.push(`${tag}: the page run left no result (status ${r.status}, signal ${r.signal})`); continue; }
    const J = JSON.parse(fs.readFileSync(f, 'utf8')); R[tag] = J.R; errors.push(...J.errors);
  }
  const lines = []; const ok = (pass, label, detail) => { lines.push(`- ${pass ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); return pass; };
  let all = true; const A = R.on, B = R.off;
  all = ok(!!A && A.on === true && A.men === true && !!B && B.on === false, 'the page opens with the rule on, and ?wallpen=0 puts it off', `WALLPEN.on as the page opens ${A?.on} (men ${A?.men}), with ?wallpen=0 ${B?.on}`) && all;
  all = ok(!!A?.pick && A.pick.far > A.pick.wall + A.pick.thin + 0.3 && A.pick.marks >= 2, 'as it opens: a round clicked at a partition ends beyond its far face and marks both faces', `partition ${A?.pick?.index} (${A?.pick?.thin} m), ${A?.pick?.gun}: the round flew ${A?.pick?.far} m, the wall stands ${A?.pick?.wall} m off, +${A?.pick?.marks} marks${A?.pick ? '' : ' — ' + JSON.stringify(A?.list ?? A)}`) && all;
  all = ok(!!B?.pick && B.pick.index === A?.pick?.index && B.pick.far < B.pick.wall + 0.1, 'with ?wallpen=0 the same click ends at the partition', `partition ${B?.pick?.index}: the round flew ${B?.pick?.far} m, the wall stands ${B?.pick?.wall} m off${B?.pick ? '' : ' — ' + JSON.stringify(B?.list ?? B)}`) && all;
  all = ok((A?.panel ?? []).some(l => /rounds pass through thin walls and doors/.test(l)) && (A?.panel ?? []).some(l => /crossed/.test(l)), 'the Tab panel has the row and its counter', JSON.stringify(A?.panel ?? []).slice(0, 500)) && all;
  all = ok(errors.length === 0, 'no console error on either page', errors.slice(0, 6).join(' | ') || 'none') && all;
  console.log('\n=== wallpen-page: rounds through thin walls on the real page (software adapter) ===\n' + lines.join('\n') + `\n=== wallpen-page: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ R, errors, pass: all }, null, 1));
  process.exit(all ? 0 : 1);
}
if (process.env.WP_TAG) onePage(process.env.WP_TAG); else judge();
