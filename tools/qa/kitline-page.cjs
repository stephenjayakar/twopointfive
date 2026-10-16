// A MAN'S KIT HOLDS ONE LINE ON HIS CHIP (the Team & kit step's roster chips: ui/loadout.ts drawSlots + ui/startpage.ts '.lo-ics'). The maintainer, 10-12, on a
// shot of The Depot with four: "line wrap for blue two" — his wall charge had dropped under the rest and every chip grew a row taller for it.
// The REAL page in headless Chromium, no WebGPU adapter (the start page is plain DOM, live from the first tick), with FULL kit cards planted in the store:
// at each window size every chip's things sit on one line, none runs out of its chip, all chips draw at one size, and where the fullest row has room that is the size it always was.
//   node tools/qa/kitline-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · SIZES (default below) · KITLINE_BREAK=1 (the old wrapping rule: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || '';
const PORT = process.env.PORT || 5199;
const SIZES = (process.env.SIZES || '1353x770,1440x900,1728x1000,2200x1200,1200x760,1100x720,960x700').split(',').map(s => s.split('x').map(Number));
const BREAK = process.env.KITLINE_BREAK === '1';
// full cards, each legal under the pouches rule (four a man): you as issued (five things with the rifle), a wall charge beside door charge and stun (the shot's
// Blue Two), four small things, a stun with two door charges (it was the shield: off in the page, `?shield`, and a planted one is dropped), three stun and a door charge
const CARDS = { v: 2, members: [
  { smoke: 1, bangs: 1, frags: 1, shells: 1 },
  { bangs: 1, charges: 1, walls: 1 },
  { smoke: 1, bangs: 1, frags: 1, charges: 1 },
  { bangs: 1, charges: 2 },
  { bangs: 3, charges: 1 },
] };
let fails = 0, sawFull = false; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
if (outDir) fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  for (const [W, H] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(([k, v, brk]) => { try { localStorage.setItem(k, v); } catch { /* no store */ }
      addEventListener('DOMContentLoaded', () => { const s = document.createElement('style');
        s.textContent = '#fatal { display: none !important; }' + (brk ? ' #missions.one #loadout .lo-ics { flex-wrap: wrap !important; height: auto !important; } #missions.one #loadout .lo-ic { font-size: 17px !important; }' : '');
        document.head.appendChild(s); }); }, ['twopointsix.kit', JSON.stringify(CARDS), BREAK]);
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
    await page.goto(`http://localhost:${PORT}/?loadout=depot-four&paused&mute`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector('#missions.one.on #loadout .lo-slot.in .lo-ics', { timeout: 60000 }); await page.waitForTimeout(600);
    const chips = await page.evaluate(() => [...document.querySelectorAll('#missions.one #loadout .lo-slot.in')].map(s => {
      const ics = s.querySelector('.lo-ics'), B = s.getBoundingClientRect(), R = ics.getBoundingClientRect(), kids = [...ics.children].map(c => c.getBoundingClientRect());
      const cs = getComputedStyle(s), inner = B.right - parseFloat(cs.paddingRight);
      return { name: s.querySelector('.lo-name')?.textContent ?? '', n: kids.length, tops: [...new Set(kids.map(k => Math.round(k.top)))].length, right: Math.max(...kids.map(k => k.right)) - inner,
        h: kids.length ? kids[0].height : 0, rowH: R.height, chipH: B.height, icon: parseFloat(getComputedStyle(ics.children[0]).fontSize), room: inner - R.left,
        natural: parseFloat(getComputedStyle(ics).getPropertyValue('--u')) * 17, own: kids.length ? (Math.max(...kids.map(k => k.right)) - R.left) : 0 };
    }));
    const said = chips.map(c => `${c.name} ${c.n} things, icon ${c.icon.toFixed(1)} px, ${c.right > 0 ? '+' : ''}${c.right.toFixed(1)} px past the chip`).join(' · ');
    check(chips.length === 5 && chips.every(c => c.n >= 3) && chips.some(c => c.n >= 5), `${W}x${H}: five chips, each with its kit drawn, one of them five things`, `${chips.length} chips: ${chips.map(c => `${c.name} ${c.n}`).join(', ')}`);
    check(chips.every(c => c.tops === 1), `${W}x${H}: every chip's things are on one line`, said);
    check(chips.every(c => c.right <= 0.5), `${W}x${H}: nothing runs out of its chip`, `furthest ${Math.max(...chips.map(c => c.right)).toFixed(1)} px`);
    check(new Set(chips.map(c => Math.round(c.chipH))).size === 1 && chips.every(c => Math.abs(c.rowH - 17) < 0.6), `${W}x${H}: the row of things is 17 px tall on every chip`, `rows ${chips.map(c => c.rowH.toFixed(1)).join(' ')} · chips ${chips.map(c => c.chipH.toFixed(0)).join(' ')}`);
    if (chips.length && chips.every(c => c.natural <= c.room && Math.abs(c.icon - 17) < 0.05)) sawFull = true;
    check(chips.every(c => Math.abs(c.icon - chips[0].icon) < 0.05), `${W}x${H}: every chip draws its things at the one size`, chips.map(c => `${c.name} ${c.icon.toFixed(1)}`).join(' · '));
    check(chips.every(c => c.natural > c.room || Math.abs(c.icon - 17) < 0.05), `${W}x${H}: with room for the fullest row the things are 17 px, as before`, `fullest row ${chips[0].natural.toFixed(0)} px of ${chips[0].room.toFixed(0)} px → ${chips[0].icon.toFixed(1)} px · rows drawn ${chips.map(c => c.own.toFixed(0)).join(' ')} px`);
    check(chips.every(c => c.icon >= (W >= 1100 ? 9 : 8)), `${W}x${H}: no thing is drawn under ${W >= 1100 ? 9 : 8} px tall`, `smallest ${Math.min(...chips.map(c => c.icon)).toFixed(1)} px`);
    if (outDir) { const el = await page.$('#missions.one #loadout .lo-slots'); await el?.screenshot({ path: path.join(outDir, `chips-${W}x${H}${BREAK ? '-break' : ''}.png`) }).catch(() => {}); }
    await ctx.close();
  }
  await browser.close();
  check(sawFull, 'at one size at least the fullest row had room and drew at 17 px', sawFull ? 'yes' : 'never: every size shrank the things');
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `\n=== kitline-page: ${fails} FAILED ===` : '\n=== kitline-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
