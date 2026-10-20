// THE DENSE KIT CARD, ON THE PAGE (src/ui/kitDense.ts KITDENSE; ui/kitCard.ts `dense`). The maintainer, 10-20, on Team & kit beside a loadout card of
// Door Kickers 2: "this menu is pretty unwieldy … maybe we have a popup menu per gun, more information density".
// The REAL page in headless Chromium, no WebGPU adapter (the start page is plain DOM, live from the first tick):
//   · the two guns are tiles side by side, each with its name whole, four bars, and what rides on it as chips (lit where carried, a count on a round);
//   · the rest of the kit is one line of small tiles, the colours and the sets a strip under it, no word on a tile cut;
//   · the whole screen fits with nothing scrolled at four window sizes (1200 × 675, the smallest the screens hold, to 1728 × 1000), for you and a teammate;
//   · a click on a gun's tile opens ITS pop-up over the foot's line: every gun the row offers with a name and bars, the one on the card lit, the gun's
//     fittings and rounds as tiles inside it; a click on another gun puts it on the card (tile, bars, chips, the kept kit); a click off it shuts it;
//   · by the keys alone: S walks the tiles as they lie, Enter on a gun opens its pop-up, A D change, W S stay inside it, Esc shuts it and the screen stays,
//     and S walks on through the kit, the colours and the sets to Deploy;
//   · a quiet mission's lent rounds read whole in the pop-up and are counted on the tile's chips;
//   · at the largest text size nothing on the card is cut and the pop-up still ends over the foot.
//   node tools/qa/kitdense-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · KITDENSE_BREAK=1 (the page with ?kitdense=0: must FAIL)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. Software adapter: nothing here has been seen on a GPU.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || '';
const PORT = process.env.PORT || 5199;
const BREAK = process.env.KITDENSE_BREAK === '1';
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const KC = '#missions.one #loadout .lo-kit .kc';

/** the card as drawn */
const read = () => {
  const kc = document.querySelector('#missions.one #loadout .lo-kit .kc'); if (!kc) return null;
  const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const cut = [...kc.querySelectorAll('.kc-val, .kc-label, .kc-pick-name, .kc-clip, .kc-set')].filter(e => shown(e) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2)).map(e => `${e.className}:${e.textContent}`);
  const tile = (g) => g.querySelector(':scope > .kc-row');
  const guns = [...kc.querySelectorAll('.kc-gun')].map(g => { const t = tile(g), pop = g.querySelector('.kc-pop');
    return { slot: g.getAttribute('data-gun'), name: t?.querySelector('.kc-val')?.textContent ?? '', tile: t ? box(t) : null, sel: !!t?.classList.contains('sel'),
      bars: [...(t?.querySelectorAll('.kc-stats .kc-stat') ?? [])].filter(shown).map(b => Number(b.getAttribute('data-score'))),
      chips: [...(t?.querySelectorAll('.kc-chip') ?? [])].map(c => ({ f: c.getAttribute('data-chip'), on: !c.classList.contains('off'), lent: c.classList.contains('lent'), n: c.querySelector('b')?.textContent ?? '', shown: shown(c) })),
      pop: pop && shown(pop) ? { ...box(pop), picks: [...pop.querySelectorAll('.kc-pick')].map(p => ({ v: p.getAttribute('data-pick'), name: p.querySelector('.kc-pick-name')?.textContent ?? '', on: p.classList.contains('on'), bars: [...p.querySelectorAll('.kc-pick-bars:not(.off) .fill')].map(f => f.getBoundingClientRect().width), ...box(p) })),
        kids: [...pop.querySelectorAll('.kc-kids > .kc-row')].filter(shown).map(k => ({ f: k.getAttribute('data-field'), val: k.querySelector('.kc-val')?.textContent ?? '', sel: k.classList.contains('sel'), ...box(k) })) } : null }; });
  const rows = (sel) => [...kc.querySelectorAll(sel)].filter(shown).map(r => ({ f: r.getAttribute('data-field'), val: r.querySelector('.kc-val')?.textContent ?? '', sel: r.classList.contains('sel'), ...box(r) }));
  const body = document.querySelector('#loadout .lo-body'), foot = document.querySelector('#loadout .lo-actions'), one = document.getElementById('missions');
  const scroller = (() => { for (let e = kc.parentElement; e; e = e.parentElement) { const o = getComputedStyle(e).overflowY; if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1) return `${e.id || e.className}: ${e.scrollHeight} in ${e.clientHeight}`; } return ''; })();
  return { dense: kc.classList.contains('kc-dense'), focus: kc.classList.contains('focus'), card: box(kc), guns, gear: rows('.kc-gear > .kc-row'), look: rows('.kc-look > .kc-row'), sets: !!kc.querySelector('.kc-look .kc-sets'), setsSel: !!kc.querySelector('.kc-sets.sel'),
    cut, scroller, footTop: foot ? foot.getBoundingClientRect().top : 0, bodyB: body ? body.getBoundingClientRect().bottom : 0, pane: one?.classList.contains('pane-loadout') ?? false, deploySel: !!document.querySelector('#loadout .lo-btn.primary.sel'),
    kept: (() => { try { return JSON.parse(localStorage.getItem('twopointsix.kit') || 'null'); } catch { return null; } })() };
};

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  const open = async (mission, W = 1728, H = 1000, textStep = null) => {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    await ctx.addInitScript((step) => { try { if (!sessionStorage.getItem('kd-once')) { sessionStorage.setItem('kd-once', '1'); localStorage.removeItem('twopointsix.kit'); if (step === null) localStorage.removeItem('twopointsix.textsize'); else localStorage.setItem('twopointsix.textsize', String(step)); } } catch { /* no store */ }
      addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); }, textStep);
    const page = await ctx.newPage();
    page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
    await page.goto(`http://localhost:${PORT}/?loadout=${mission}&paused&mute${BREAK ? '&kitdense=0' : ''}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await page.waitForSelector(`#missions.one.on #loadout .lo-kit .kc`, { timeout: 60000 }); await page.waitForTimeout(600);
    return { ctx, page };
  };
  const shot = async (page, name) => { if (outDir) await page.screenshot({ path: path.join(outDir, `${name}${BREAK ? '-break' : ''}.png`) }).catch(() => {}); };
  const gun = (c, slot) => c?.guns.find(g => g.slot === slot);
  const click = async (page, sel) => { await page.click(sel, { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(150); };
  const key = async (page, k) => { await page.keyboard.press(k); await page.waitForTimeout(90); };
  const TILE = (slot) => `${KC} .kc-gun[data-gun="${slot}"] > .kc-row`;

  // the card as it opens: a loud mission with four, your card
  { const { ctx, page } = await open('depot-four', 1317, 775);
    const c = await page.evaluate(read); await shot(page, 'kitdense-you');
    const P = gun(c, 'primary'), S = gun(c, 'secondary');
    check(!!c?.dense && !!P?.tile && !!S?.tile && Math.abs(P.tile.t - S.tile.t) < 1 && S.tile.l >= P.tile.r && P.tile.w > S.tile.w && [P, S].every(g => g.bars.length === 4 && g.bars.some(b => b > 0.05)), 'the two guns are tiles side by side, each with four bars',
      [P, S].map(g => (g?.tile ? `${g.name} ${g.tile.w.toFixed(0)} × ${g.tile.h.toFixed(0)} at ${g.tile.l.toFixed(0)},${g.tile.t.toFixed(0)} bars ${g.bars.map(b => b.toFixed(2)).join(' ')}` : 'no tile')).join(' · '));
    const chip = (g, f) => g?.chips.find(x => x.f === f);
    check(!!P && ['suppressed', 'light', 'rings', 'shells', 'cams'].every(f => chip(P, f)?.shown) && chip(P, 'suppressed').on && chip(P, 'light').on && chip(P, 'shells').on && chip(P, 'shells').n === '1' && !chip(P, 'rings').on && !chip(P, 'cams').on && !!chip(S, 'sideCan')?.on,
      'a gun\'s tile wears what rides on it as chips: fitted and carried lit, a count on a round, none faint', [P, S].map(g => g?.chips.map(x => `${x.f}${x.on ? '+' : '-'}${x.n}`).join(' ') ?? '').join(' · '));
    const top = c?.gear.length ? Math.min(...c.gear.map(r => r.t)) : 0;
    check(!!c && c.gear.length >= 6 && c.gear.every(r => Math.abs(r.t - top) < 1) && c.gear.every(r => r.t >= P.tile.b) && c.look.length === 2 && c.sets && c.look.every(r => r.t >= Math.max(...c.gear.map(g => g.b)) - 0.5),
      'the rest of the kit is one line of small tiles under the guns, the colours and the sets a strip under it', c ? `${c.gear.map(r => `${r.f}=${r.val}`).join(' ')} · strip ${c.look.map(r => r.f).join(' ')}${c.sets ? ' + sets' : ''}` : 'no card');
    check(!!c && !c.cut.length, 'no word on the card is cut', c?.cut.join(' | ') || 'none');
    // the pop-up by the mouse
    await click(page, TILE('primary')); const o = await page.evaluate(read), OP = gun(o, 'primary')?.pop; await shot(page, 'kitdense-pop');
    check(!!OP && !gun(o, 'secondary').pop && OP.picks.length >= 5 && OP.picks.every(p => p.name && p.w > 60) && OP.picks.filter(p => p.on).length === 1 && OP.picks.find(p => p.on).name === gun(o, 'primary').name && OP.picks.filter(p => p.bars.length === 4).length >= 4,
      'a click on the primary\'s tile opens its pop-up: every gun it could be, named, with bars, the one on the card lit', OP ? OP.picks.map(p => `${p.name}${p.on ? '*' : ''}(${p.bars.map(b => b.toFixed(0)).join(',')})`).join(' ') : 'no pop-up');
    check(!!OP && ['suppressed', 'light', 'shells'].every(f => OP.kids.some(k => k.f === f)) && OP.kids.every(k => k.t >= OP.t && k.b <= OP.b + 0.5) && OP.t >= gun(o, 'primary').tile.b && OP.b <= o.footTop + 0.5 && !o.cut.length,
      'its fittings and rounds are tiles inside the pop-up, which opens under the guns and ends over the foot, nothing cut', OP ? `${OP.kids.map(k => `${k.f}=${k.val}`).join(' ')} · pop ${OP.t.toFixed(0)}‥${OP.b.toFixed(0)}, foot at ${o.footTop.toFixed(0)}${o.cut.length ? ' · cut ' + o.cut.join(' | ') : ''}` : 'no pop-up');
    const other = OP?.picks.find(p => !p.on && p.bars.length === 4);
    if (other) await click(page, `${KC} .kc-pop.open .kc-pick[data-pick="${other.v}"]`);
    const n = await page.evaluate(read), NP = gun(n, 'primary');
    check(!!other && NP?.name === other.name && !!NP.pop && NP.pop.picks.find(p => p.on)?.v === other.v && JSON.stringify(NP.bars) !== JSON.stringify(P.bars) && n.kept?.members?.[0]?.primary === other.v,
      'a click on another gun puts it on the card at once: the tile, its bars, the kept kit', other ? `${P.name} → ${NP?.name} · bars ${NP?.bars.map(b => b.toFixed(2)).join(' ')} · kept primary ${n.kept?.members?.[0]?.primary}` : 'no other gun');
    await page.mouse.click(700, 80); await page.waitForTimeout(150);
    const z = await page.evaluate(read);
    check(!!z && z.guns.every(g => !g.pop), 'a click off the pop-up shuts it', z ? z.guns.map(g => `${g.slot}: ${g.pop ? 'open' : 'shut'}`).join(' · ') : 'no card');
    await ctx.close(); }

  // by the keys alone
  { const { ctx, page } = await open('depot-four', 1317, 775);
    let c = await page.evaluate(read), n = 0; while (c && !c.focus && n++ < 6) { await key(page, 'KeyS'); c = await page.evaluate(read); }
    const at0 = gun(c, 'primary')?.sel; await key(page, 'KeyS'); await key(page, 'Enter'); const o = await page.evaluate(read), was = gun(o, 'secondary')?.name;
    await key(page, 'KeyD'); const d = await page.evaluate(read);
    check(!!at0 && !!gun(o, 'secondary')?.pop && gun(d, 'secondary').name !== was && !!gun(d, 'secondary').pop, 'S walks onto the card at the primary, S the secondary, Enter opens its pop-up, D is the next gun', `primary first: ${!!at0} · ${was} → ${gun(d, 'secondary')?.name} · pop-up ${gun(d, 'secondary')?.pop ? 'open' : 'shut'}`);
    await key(page, 'KeyS'); const k1 = await page.evaluate(read); for (let i = 0; i < 5; i++) await key(page, 'KeyS'); const k2 = await page.evaluate(read);
    for (let i = 0; i < 5; i++) await key(page, 'KeyW'); const k3 = await page.evaluate(read);
    check(!!gun(k1, 'secondary')?.pop?.kids.some(k => k.sel) && !!gun(k2, 'secondary')?.pop && k2.pane && !k2.deploySel && !!gun(k3, 'secondary')?.pop && gun(k3, 'secondary').sel, 'inside it S goes to the gun\'s things and W back to the gun, and neither walks out of it',
      `after S: ${gun(k1, 'secondary')?.pop?.kids.find(k => k.sel)?.f ?? 'no tile'} · after five more: pop-up ${gun(k2, 'secondary')?.pop ? 'open' : 'shut'} · after five W: the gun ${gun(k3, 'secondary')?.sel ? 'lit' : 'not lit'}`);
    await key(page, 'Escape'); const e = await page.evaluate(read);
    check(!!e && e.guns.every(g => !g.pop) && e.pane && gun(e, 'secondary').sel, 'Esc shuts the pop-up and the screen stays, the keys on the gun', e ? `pop-ups ${e.guns.some(g => g.pop) ? 'open' : 'shut'} · Team & kit ${e.pane ? 'up' : 'gone'}` : 'no card');
    const walk = []; let s = e, steps = 0;
    while (s && !s.deploySel && steps++ < 20) { await key(page, 'KeyS'); s = await page.evaluate(read); if (s) walk.push(s.gear.find(r => r.sel)?.f ?? s.look.find(r => r.sel)?.f ?? (s.setsSel && s.focus ? 'sets' : s.deploySel ? 'deploy' : '?')); }
    const want = e ? [...e.gear.map(r => r.f), ...e.look.map(r => r.f), 'sets', 'deploy'] : ['no card'];
    check(JSON.stringify(walk) === JSON.stringify(want), 'S walks on through the tiles as they lie — the kit, the colours, the sets — to Deploy', `walked ${walk.join(' ')} · laid ${want.join(' ')}`);
    await ctx.close(); }

  // nothing scrolled, nothing cut: four windows, you and a teammate, the pop-up open over the foot
  for (const [W, H] of [[1200, 675], [1317, 775], [1440, 900], [1728, 1000]]) {
    const { ctx, page } = await open('mousehole-four', W, H);
    const you = await page.evaluate(read); await click(page, TILE('primary')); const yo = await page.evaluate(read); if (W === 1200) await shot(page, 'kitdense-small-pop');
    await page.mouse.click(Math.round(W * 0.6), 30); await click(page, '#loadout .lo-slot[data-slot="1"]'); const mate = await page.evaluate(read); await click(page, TILE('primary')); const mo = await page.evaluate(read); await shot(page, `kitdense-mate-${W}`);
    const ok = (c) => !!c?.dense && !c.scroller && !c.cut.length && c.card.b <= c.footTop + 0.5, popOk = (c) => { const p = gun(c, 'primary')?.pop; return !!p && p.b <= c.footTop + 0.5 && !c.cut.length; };
    check(ok(you) && ok(mate) && popOk(yo) && popOk(mo), `${W} × ${H}: the screen fits with nothing scrolled and nothing cut, for you and a teammate, and a gun's pop-up ends over the foot`,
      [['you', you, yo], ['teammate', mate, mo]].map(([w, c, o]) => `${w}: card to ${c?.card.b.toFixed(0)}, pop-up to ${gun(o, 'primary')?.pop?.b.toFixed(0) ?? '—'}, foot at ${c?.footTop.toFixed(0)}${c?.scroller ? ' · scrolls ' + c.scroller : ''}${[...(c?.cut ?? []), ...(o?.cut ?? [])].length ? ' · cut ' + [...c.cut, ...o.cut].join(' | ') : ''}`).join(' · '));
    await ctx.close(); }

  // a quiet mission: what the mission lends
  { const { ctx, page } = await open('police-post-quiet', 1317, 775);
    const c = await page.evaluate(read), rings = gun(c, 'primary')?.chips.find(x => x.f === 'rings');
    await click(page, TILE('primary')); const o = await page.evaluate(read), kid = gun(o, 'primary')?.pop?.kids.find(k => k.f === 'rings'); await shot(page, 'kitdense-quiet-pop');
    check(!!rings?.on && rings.lent && rings.n === '5' && !!kid && /5/.test(kid.val) && !o.cut.length && gun(o, 'primary').pop.b <= o.footTop + 0.5, 'a quiet mission\'s sponge rounds are counted on the gun\'s chip and read whole in its pop-up',
      `chip ${rings ? `${rings.on ? 'lit' : 'faint'} ${rings.n}${rings.lent ? ' lent' : ''}` : 'none'} · tile '${kid?.val ?? ''}'${o.cut.length ? ' · cut ' + o.cut.join(' | ') : ''}`);
    await ctx.close(); }

  // a quiet mission in a small window (the maintainer's own is about 1000 × 673): its cursor moves no tile, and a pop-up of two lines of things still ends over the foot
  for (const [W, H] of [[1000, 673], [1200, 675]]) {
    const { ctx, page } = await open('solo-night', W, H);
    const lay = () => page.evaluate(() => [...document.querySelectorAll('#loadout .lo-kit .kc .kc-gear .kc-val, #loadout .lo-kit .kc .kc-look .kc-val, #loadout .lo-kit .kc .kc-gun > .kc-row .kc-val')].map(v => { const b = v.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)}`; }).join(' '));
    const was = await lay(), moved = []; let c = await page.evaluate(read), n = 0;
    while (c && !c.deploySel && n++ < 24) { await key(page, 'KeyS'); c = await page.evaluate(read); const now = await lay(); if (c?.focus && now !== was) moved.push(c.gear.find(r => r.sel)?.f ?? c.look.find(r => r.sel)?.f ?? c.guns.find(g => g.sel)?.slot ?? '?'); }
    await click(page, TILE('primary')); const o = await page.evaluate(read), pop = gun(o, 'primary')?.pop; await shot(page, `kitdense-quiet-${W}`);
    check(!!c?.deploySel && !moved.length && !!pop && pop.b <= o.footTop + 0.5 && !o.cut.length && !o.scroller, `${W} × ${H}, a quiet mission: the keys walk the card and no tile moves under them, and the primary's pop-up ends over the foot`,
      `walked to Deploy: ${!!c?.deploySel} · moved under the keys: ${moved.join(' ') || 'none'} · pop-up to ${pop?.b.toFixed(0) ?? '—'}, foot at ${o?.footTop.toFixed(0)}${o?.cut.length ? ' · cut ' + o.cut.join(' | ') : ''}`);
    await ctx.close(); }

  // the largest text size
  { const { ctx, page } = await open('depot-four', 1728, 1000, 4);
    const tz = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tz').trim());
    const c = await page.evaluate(read); await click(page, TILE('primary')); const o = await page.evaluate(read); await shot(page, 'kitdense-largest');
    check(Number(tz) > 1 && !!c?.dense && !c.cut.length && !o.cut.length && !!gun(o, 'primary')?.pop && gun(o, 'primary').pop.b <= o.footTop + 0.5 && gun(o, 'primary').pop.r <= 1728.5, 'at the largest text size nothing on the card is cut and the pop-up is inside the window, over the foot',
      `factor ${tz} · pop-up to ${gun(o, 'primary')?.pop?.b.toFixed(0) ?? '—'}, foot at ${o?.footTop.toFixed(0)}${[...(c?.cut ?? []), ...(o?.cut ?? [])].length ? ' · cut ' + [...c.cut, ...o.cut].join(' | ') : ''}`);
    await ctx.close(); }

  await browser.close();
  if (errors.length) { fails++; console.log(`- FAIL — page errors\n    ${errors.slice(0, 5).join('\n    ')}`); }
  console.log(`\n${fails ? `${fails} FAILED` : 'all passed'}${BREAK ? ' (KITDENSE_BREAK=1: the page with ?kitdense=0 — this run must fail)' : ''}`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
