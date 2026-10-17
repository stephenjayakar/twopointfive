// A QUIET MISSION'S GEAR SCREEN (ui/startpage.ts QUIET_CSS, ui/kitNoise.ts), on the REAL page in headless Chromium with no WebGPU adapter: the start page and
// the loadout are plain DOM, live from the first tick (as tools/qa/startpage-look.cjs runs them).
//   PORT=<the dev server's, default 5199> node tools/qa/quietgear-page.cjs [outDir]      exit 0 all PASS · 1 a FAIL or a page error
// What it holds: on a quiet mission's Team & kit step the root wears `quiet`, nothing drawn there is the accent (Deploy is hollow), every tile says how loud
// its thing is (the game's own steps) and the suppressed pistol alone is the quietest gun; `kitloud` on the address and a loud mission are the screen as it was.
// QUIETGEAR_BREAK=1 opens the quiet mission WITH `kitloud` where the quiet look is expected: 'quiet look' must fail.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const outDir = process.argv[2] || '', PORT = process.env.PORT || 5199, BREAK = process.env.QUIETGEAR_BREAK === '1';
let fails = 0;
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const read = () => { const root = document.getElementById('missions'), go = document.querySelector('#loadout .lo-btn.primary'), cs = e => getComputedStyle(e);
  const rows = [...document.querySelectorAll('#loadout .lo-kit .kc-row')];
  return { quiet: !!root && root.classList.contains('quiet'), goBg: go ? cs(go).backgroundColor : '', accent: cs(root).getPropertyValue('--m-accent').trim(), base: cs(document.documentElement).getPropertyValue('--m-accent').trim(),
    noise: Object.fromEntries(rows.map(r => [r.dataset.field, +r.dataset.noise])), marks: rows.filter(r => getComputedStyle(r.querySelector('.kc-val'), '::after').content !== 'none').map(r => r.dataset.field),
    bigWide: (() => { const b = rows.find(r => r.dataset.field === 'big'), a = rows.find(r => r.dataset.field === 'weapon'); return b && a ? b.getBoundingClientRect().width > a.getBoundingClientRect().width * 1.5 : null; })(),
    zero: rows.filter(r => r.classList.contains('zero')).map(r => r.dataset.field) }; };
(async () => {
  const b = await chromium.launch({ args: ['--no-sandbox'] }), errs = [];
  const open = async (q, shot, press) => { const p = await b.newPage({ viewport: { width: 1440, height: 900 } }); p.on('pageerror', e => errs.push(`${q}: ${e.message}`));
    await p.goto(`http://localhost:${PORT}/?${q}&mute&paused&quality=verylow`, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('#loadout .lo-kit .kc-row', { timeout: 30000 });
    if (press) await p.evaluate(t => { const x = [...document.querySelectorAll('#loadout .kc-set')].find(e => e.textContent.trim().toLowerCase() === t); if (x) x.click(); }, press);
    await p.waitForTimeout(300); const r = await p.evaluate(read);
    if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await p.addStyleTag({ content: '#fatal { display: none !important; }' }); await p.screenshot({ path: `${outDir}/${shot}.png` }); }
    await p.close(); return r; };
  const clear = c => { const m = /rgba\(([^)]+)\)/.exec(c); return c === 'transparent' || (!!m && +m[1].split(',')[3] < 0.3); };   // (hollow: no fill, or a faint one)
  const q = await open(`loadout=vault-quiet${BREAK ? '&kitloud' : ''}`, 'quiet');
  check(q.quiet && clear(q.goBg) && q.accent !== q.base, 'quiet look', `root quiet ${q.quiet} · Deploy's fill ${q.goBg} · the step's accent ${q.accent} (the page's ${q.base})`);
  const n = q.noise;
  check(n.smoke === 1 && n.bangs === 2 && n.frags === 3 && n.shells === 3 && n.cams === 1 && n.suit === 0 && n.trim === 0, 'noise steps', JSON.stringify(n));
  check(q.marks.length > 0 && q.marks.every(f => n[f] > 0) && Object.keys(n).filter(f => n[f] > 0).every(f => q.marks.includes(f)), 'a mark on every tile that makes a noise, on no other', `marked: ${q.marks.join(' ')}`);
  check(q.bigWide === false && q.zero.includes('big'), 'an empty big slot is a tile like the rest', `big wider than a tile: ${q.bigWide} · none carried: ${q.zero.join(' ') || '(nothing)'}`);
  const s = await open('loadout=vault-quiet', 'quiet-set', 'quiet set');
  check(s.noise.weapon === 1, 'the quiet set\'s gun is the quietest', `guns step ${s.noise.weapon} with the quiet set on (the suppressed pistol's report is not loud)`);
  const k = await open('loadout=vault-quiet&kitloud', 'kitloud');
  check(!k.quiet && !clear(k.goBg) && k.marks.length === 0 && k.accent === k.base, '`kitloud` is the screen as it was', `root quiet ${k.quiet} · Deploy's fill ${k.goBg} · marks ${k.marks.length}`);
  const o = await open('loadout=solo-night', 'solo');
  check(o.quiet && clear(o.goBg) && o.marks.length > 0, 'the solo night takes the quiet look too', `root quiet ${o.quiet} · Deploy's fill ${o.goBg} · marks ${o.marks.length}`);
  const l = await open('loadout=room-clear-pair', 'loud');
  check(!l.quiet && !clear(l.goBg) && l.marks.length === 0, 'a loud mission is the screen as it was', `root quiet ${l.quiet} · Deploy's fill ${l.goBg} · marks ${l.marks.length}`);
  check(errs.length === 0, 'no page error', errs.join(' | ') || 'none');
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
