// THE GEAR SCREEN AS A TREE, ON THE PAGE (src/game/kittree.ts KITTREE; ui/kitCard.ts, ui/loadout.ts, ui/startpage.ts). The maintainer, 10-19, on a shot of
// Team & kit: guns told apart by some stats, attachments per gun and under their gun, the same for you and a teammate, sponge rounds shown and only a
// stealth build's by default, one place for named kits.
// The REAL page in headless Chromium, no WebGPU adapter (the start page is plain DOM, live from the first tick):
//   · each gun's tile is drawn with four bars, and another gun on the row draws other bars;
//   · the suppressor and the light are tiles INSIDE their gun's box, under its tile and set in from it — on your card and on a teammate's;
//   · a teammate's card has the 40 mm tile yours has, none as issued, one after a press;
//   · the Sponge rounds tile reads none on a loud mission and the mission's five on a quiet one;
//   · a card has one set (the reset) and the row of kits is drawn, live, for a man alone;
//   · at five window widths (1000 to 1512) the weight bars stay clear of the sets' row and each gun's name and every tile under a gun is whole.
//   node tools/qa/kittree-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · KITTREE_BREAK=1 (the page with ?nokittree: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. Software adapter: nothing here has been seen on a GPU.
// The tree as THIS card lays it out: the dense card (src/ui/kitDense.ts, the page's own since 10-20) puts a gun's things in its pop-up, so every page here
// is opened with `kitdense=0`; the dense lay-out of the same tree is tools/qa/kitdense-page.cjs's.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || '';
const PORT = process.env.PORT || 5199;
const BREAK = process.env.KITTREE_BREAK === '1';
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const KIT = '#missions.one #loadout .lo-kit .kc';

/** the card as drawn: each gun box (its bars, the tiles hung in it and where they sit), the sets, the sponge tile */
const read = () => {
  const kc = document.querySelector('#missions.one #loadout .lo-kit .kc'); if (!kc) return null;
  const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const guns = [...kc.querySelectorAll('.kc-gun')].map(g => { const tile = g.querySelector(':scope > .kc-row');
    return { slot: g.getAttribute('data-gun'), name: tile?.querySelector('.kc-val')?.textContent ?? '', tile: tile ? box(tile) : null,
      bars: [...g.querySelectorAll('.kc-stats .kc-stat')].map(b => ({ id: b.getAttribute('data-stat'), score: Number(b.getAttribute('data-score')), w: b.querySelector('.fill')?.getBoundingClientRect().width ?? 0, track: b.querySelector('.kc-bar-t')?.getBoundingClientRect().width ?? 0 })),
      kids: [...g.querySelectorAll('.kc-kids > .kc-row')].map(k => ({ field: k.getAttribute('data-field'), val: k.querySelector('.kc-val')?.textContent ?? '', lent: k.classList.contains('lent'), ...box(k) })) }; });
  const sponge = kc.querySelector('.kc-row[data-field="rings"]');
  const kits = document.querySelector('#missions.one #loadout .lo-kits');
  return { tree: kc.classList.contains('kc-tree'), guns, sets: [...kc.querySelectorAll('.kc-set')].map(b => b.textContent),
    sponge: sponge ? { val: sponge.querySelector('.kc-val')?.textContent ?? '', lent: sponge.classList.contains('lent'), shown: sponge.getBoundingClientRect().height > 0 } : null,
    kits: kits ? { shown: kits.getBoundingClientRect().height > 0, label: kits.querySelector('.lo-label')?.textContent ?? '', live: [...kits.querySelectorAll('.lo-set')].filter(b => !b.disabled && b.getBoundingClientRect().width > 0).length } : null };
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const open = async (mission, W = 1728, H = 1000) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript(() => { try { localStorage.removeItem('twopointsix.kit'); } catch { /* no store */ }
      addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); });
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
    await page.goto(`http://localhost:${PORT}/?loadout=${mission}&paused&mute&kitdense=0${BREAK ? '&nokittree' : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector(`#missions.one.on #loadout .lo-kit .kc`, { timeout: 60000 }); await page.waitForTimeout(600);
    return { ctx, page };
  };
  const shot = async (page, name) => { if (outDir) await page.screenshot({ path: path.join(outDir, `${name}${BREAK ? '-break' : ''}.png`) }).catch(() => {}); };
  const gun = (c, slot) => c?.guns.find(g => g.slot === slot);
  const hung = (g, f) => { const k = g?.kids.find(x => x.field === f); return !!k && !!g.tile && k.t >= g.tile.b - 0.5 && k.l > g.tile.l + 4 && k.h > 0; };

  // a loud mission with four: your card, then a teammate's
  { const { ctx, page } = await open('depot-four');
    const you = await page.evaluate(read); await shot(page, 'kittree-you');
    const P = gun(you, 'primary'), S = gun(you, 'secondary');
    check(!!you?.tree && !!P && !!S && [P, S].every(g => g.bars.length === 4 && g.bars.every(b => b.track > 20 && b.w >= 0 && b.w <= b.track + 0.5) && g.bars.some(b => b.w > 4)), 'your card: each gun is a tile with four bars drawn inside their tracks',
      [P, S].map(g => (g ? `${g.name}: ${g.bars.map(b => `${b.id} ${b.w.toFixed(0)}/${b.track.toFixed(0)}`).join(' ')}` : 'no gun box')).join(' · '));
    check(hung(P, 'suppressed') && hung(P, 'light') && hung(S, 'sideCan'), 'the suppressor and the light are tiles in their gun\'s box, under its tile and set in from it',
      [P, S].map(g => (g ? `${g.slot}: ${g.kids.map(k => `${k.field}=${k.val}`).join(', ') || 'nothing hung'}` : '')).join(' · '));
    check(!!you?.sponge?.shown && /^0$|none/i.test(you.sponge.val.trim()) && !you.sponge.lent && !!P?.kids.some(k => k.field === 'rings'), 'a loud mission: the Sponge rounds tile is on the card, under the primary, and reads none', you?.sponge ? `'${you.sponge.val}'` : 'no tile');
    check(you?.sets.length === 1 && !!you?.kits?.shown, 'the card has one set — the reset — and the row of kits is the one list', `sets: ${you?.sets.join(', ')} · kits row '${you?.kits?.label}' with ${you?.kits?.live} live`);
    // another primary reads apart
    const before = P ? P.bars.map(b => b.score) : [];
    await page.click(`${KIT} .kc-gun[data-gun="primary"] > .kc-row`); await page.keyboard.press('KeyD'); await page.waitForTimeout(250);
    const next = gun(await page.evaluate(read), 'primary');
    check(!!next && next.name !== P?.name && next.bars.some((b, k) => Math.abs(b.score - before[k]) >= 0.1), 'the next primary on the row draws other bars', next ? `${P?.name} ${before.map(x => x.toFixed(2)).join('/')} → ${next.name} ${next.bars.map(b => b.score.toFixed(2)).join('/')}` : 'no gun box');
    await shot(page, 'kittree-next-gun');
    // a teammate's card
    await page.click('#missions.one #loadout .lo-slot.in >> nth=1'); await page.waitForTimeout(300);
    const mate = await page.evaluate(read); await shot(page, 'kittree-mate');
    check(!!mate?.tree && hung(gun(mate, 'primary'), 'suppressed') && hung(gun(mate, 'primary'), 'light') && hung(gun(mate, 'secondary'), 'sideCan') && gun(mate, 'primary').bars.length === 4,
      'a teammate\'s card is laid out the same: his guns\' bars, each gun\'s suppressor and the light under it', (mate?.guns ?? []).map(g => `${g.slot} ${g.name}: ${g.kids.map(k => k.field).join(', ')}`).join(' · '));
    // his 40 mm: a tile under his primary like yours, none as issued, one after a press (he fires it on your order: game/squad40.ts)
    { const sh = (c) => gun(c, 'primary')?.kids.find(k => k.field === 'shells'), was = sh(mate);
      await page.evaluate(q => document.querySelector(q)?.click(), `${KIT} .kc-gun[data-gun="primary"] .kc-row[data-field="shells"] .kc-step:last-of-type`); await page.waitForTimeout(250);
      const after = await page.evaluate(read), now = sh(after); await shot(page, 'kittree-mate-40mm');
      check(!!was && hung(gun(mate, 'primary'), 'shells') && /^0$/.test(was.val.trim()) && !!now && /^1$/.test(now.val.trim()), 'a teammate\'s card has the 40 mm tile under his primary, where yours is: none as issued, one after a press', `as issued '${was?.val ?? 'no tile'}' → '${now?.val ?? 'no tile'}'`); }
    // alone: the row of kits is still there to press
    await page.click('#missions.one #loadout .lo-size >> nth=0').catch(() => {}); await page.waitForTimeout(300);
    const alone = await page.evaluate(read);
    await shot(page, 'kittree-alone');
    check(!!alone?.kits?.shown && alone.kits.live > 1 && alone.kits.live <= (you?.kits?.live ?? 0), 'alone: the row of kits is drawn and live, with the kits that differ on your own card', `kits row ${alone?.kits?.shown ? 'drawn' : 'not drawn'}, ${alone?.kits?.live ?? 0} live (${you?.kits?.live ?? 0} with four)`);
    await ctx.close(); }
  // narrow windows: the head's two bars (what the card weighs) stay clear of the sets' row beside them
  for (const W of [1000, 1180, 1353, 1440, 1512]) { const { ctx, page } = await open('depot-four', W, 760);
    const m = await page.evaluate(() => { const kc = document.querySelector('#missions.one #loadout .lo-kit .kc'), R = (e) => e.getBoundingClientRect();
      const btn = [...kc.querySelectorAll('.kc-sets button')].map(R).filter(r => r.width > 0), lab = [...kc.querySelectorAll('.kc-head .kc-bar-l, .kc-head .kc-pouch > *')].map(R).filter(r => r.width > 0);
      const hit = btn.some(b => lab.some(l => l.left < b.right - 0.5 && l.right > b.left + 0.5 && l.top < b.bottom - 0.5 && l.bottom > b.top + 0.5));
      const guns = [...kc.querySelectorAll('.kc-gun > .kc-row')].map(g => { const r = R(g), v = R(g.querySelector('.kc-val')), l = R(g.querySelector('.kc-label')); return { cut: g.querySelector('.kc-val').scrollWidth > g.querySelector('.kc-val').clientWidth + 1, in: v.left >= r.left && v.right <= r.right + 0.5 && l.width > 30 }; });
      const cut = [...kc.querySelectorAll('.kc-kids .kc-row')].filter(k => R(k).height > 0).filter(k => ['.kc-label', '.kc-val'].some(q => { const e = k.querySelector(q); return !!e && e.scrollWidth > e.clientWidth + 1; })).map(k => k.getAttribute('data-field'));
      return { hit, cut, sets: Math.max(...btn.map(b => b.right)), head: Math.min(...lab.map(l => l.left)), guns, over: document.documentElement.scrollWidth - innerWidth }; });
    await shot(page, `kittree-${W}`);
    check(!m.hit, `${W} px wide: the weight bars and the pouches do not run into the sets' row`, `sets end at ${m.sets.toFixed(0)}, the head starts at ${m.head.toFixed(0)}`);
    check(m.guns.length === 2 && m.guns.every(g => g.in && !g.cut) && m.over <= 0 && m.cut.length === 0, `${W} px wide: each gun's name and every tile under a gun is whole, and the page does not scroll sideways`, `${m.guns.map(g => `${g.in ? 'in' : 'OUT'}${g.cut ? ' CUT' : ''}`).join(' · ')} · cut under a gun: ${m.cut.join(', ') || 'none'} · ${m.over} px over`);
    await ctx.close(); }
  // a quiet mission: the mission hands you the launcher's five
  { const { ctx, page } = await open('vault-quiet');
    const q = await page.evaluate(read); await shot(page, 'kittree-quiet');
    check(!!q?.sponge?.shown && q.sponge.lent && /5/.test(q.sponge.val), 'a quiet mission: the Sponge rounds tile shows the five the mission hands you', q?.sponge ? `'${q.sponge.val}'${q.sponge.lent ? ' (lent)' : ''}` : 'no tile');
    await ctx.close(); }
  await browser.close();
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `=== kittree-page: ${fails} FAIL ===` : '=== kittree-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
