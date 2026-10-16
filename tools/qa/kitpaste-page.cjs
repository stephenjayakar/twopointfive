// COPY AND PASTE FOR LOADOUTS, ON THE REAL PAGE (the Team & kit step: ui/kitCard.ts KIT_CLIP — the two buttons, C and V — ui/loadout.ts — the keys from any
// row, the roster's mark — game/kit.ts kitPaste). The maintainer, 10-15: "we should have copy and paste for loadouts".
// The REAL page in headless Chromium, no WebGPU adapter (the start page is plain DOM, live from the first tick), with five cards planted in the store by
// the big slot's own fields: a man's kit is copied by the key and pasted onto another by the key, onto you by the button, the kit of the man whose card says
// shield onto you by Ctrl+C / Ctrl+V (the shield is out of the page: his card reads without it; on a `?shield` visit it is back and your big slot keeps its own); each time the store holds the kit, written ONCE, the tiles that moved flash, the men who wear the copied kit are marked on the roster,
// Copy is lit and Paste dim on their cards, and the tile the highlight was on has not moved. Then `?nokitcopy`: no buttons, and the keys do nothing.
// And a mission whose level file issues its own kit: no cards, and the key line stops naming the two keys.
//   node tools/qa/kitpaste-page.cjs [outDir]      env: PORT (the dev server's, default 5199) · KITPASTE_BREAK=1 (the page opened ?nokitcopy throughout: must FAIL)
// Then the Cmd key of a Mac (no keyup for the letter) and a Dvorak board, by key events built by hand. (A Deploy with a pasted kit, end to end, is the
// slow tools/qa/kitpaste-deploy-page.cjs.)
// PASS / FAIL lines, exit 1 on a FAIL or a page error. Nothing here needs a GPU, and nothing here has been seen on one: the door picture behind the tiles
// (ui/kitView.ts) is not up on this adapter.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const outDir = process.argv[2] || '';
const PORT = process.env.PORT || 5199;
const BREAK = process.env.KITPASTE_BREAK === '1';
const KEY = 'twopointsix.kit';
const CARDS = { v: 2, members: [
  { smoke: 1, bangs: 1, frags: 1, shells: 1 },
  { bangs: 2, charges: 1, frags: 1, big: 'hammer' },
  { bangs: 1, charges: 1, frags: 1 },
  { shield: true, charges: 2 },
  {},
] };
let fails = 0; const errors = [];
const check = (ok, label, detail) => { if (!ok) fails++; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
if (outDir) fs.mkdirSync(outDir, { recursive: true });
const J = JSON.stringify;

async function open(browser, extra, mission = 'depot-four') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([k, v]) => { try { localStorage.setItem(k, v); } catch { /* no store */ }
    window.__kitWrites = 0; const set = Storage.prototype.setItem; Storage.prototype.setItem = function (key, val) { if (key === k) window.__kitWrites++; return set.call(this, key, val); };
    addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#fatal { display: none !important; }'; document.head.appendChild(s); }); }, [KEY, J(CARDS)]);
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (/WebGPU|adapter/i.test(String(e))) return; errors.push(String(e).slice(0, 200)); });
  await page.goto(`http://localhost:${PORT}/?loadout=${mission}&paused&mute${extra}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#missions.one.on #loadout .lo-slot.in', { timeout: 60000 }); await page.waitForTimeout(600);
  const read = () => page.evaluate(k => { const q = (s, r = document) => [...r.querySelectorAll(s)], lo = '#missions.one #loadout';
    const btn = id => document.querySelector(`${lo} .kc-clip[data-clip="${id}"]`), box = e => { const r = e?.getBoundingClientRect(); return r ? { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) } : null; };
    return { kit: JSON.parse(localStorage.getItem(k) || '{}').members ?? [], writes: window.__kitWrites, marks: q(`${lo} .lo-slot.clip`).map(s => +s.getAttribute('data-slot')), glyphs: q(`${lo} .lo-slot .lo-clip svg`).length,
      member: +(document.querySelector(`${lo} .kc`)?.getAttribute('data-member') ?? -1), sets3: q(`${lo} .kc-set`).length, copy: btn('copy') ? { on: btn('copy').classList.contains('on'), ...box(btn('copy')) } : null, paste: btn('paste') ? { off: btn('paste').classList.contains('off'), ...box(btn('paste')) } : null,
      sets: q(`${lo} .kc-set[data-set]`).map(box), flash: q(`${lo} .kc-row.pasted`).map(r => r.getAttribute('data-field')), sel: document.querySelector(`${lo} .kc.focus .kc-row.sel`)?.getAttribute('data-field') ?? null,
      big: document.querySelector(`${lo} .kc-row[data-field="big"] .kc-val`)?.textContent ?? '', said: document.querySelector(`${lo} .kc-words.refused`)?.textContent ?? '', legend: document.querySelector(`${lo} [data-row="actions"]`)?.getAttribute('data-what') ?? '', head: box(document.querySelector(`${lo} .kc-head`)) }; }, KEY);
  const pick = async i => { await page.click(`#missions.one #loadout .lo-slot[data-slot="${i}"]`); await page.waitForTimeout(80); };
  const key = async k => { await page.keyboard.press(k); await page.waitForTimeout(120); };
  const shot = async name => { if (outDir) await page.screenshot({ path: path.join(outDir, `${name}${BREAK ? '-break' : ''}.png`) }).catch(() => {}); };
  return { ctx, page, read, pick, key, shot };
}
const kitOf = m => ({ bangs: m?.bangs, charges: m?.charges, frags: m?.frags, smoke: m?.smoke, shells: m?.shells, big: m?.big, shield: m?.shield, walls: m?.walls });

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
  { const P = await open(browser, BREAK ? '&nokitcopy' : '');
    const a = await P.read(); await P.shot('paste-0-open');
    check(!!a.copy && !!a.paste && a.sets.length === 3 && a.sets3 === 3 && a.copy.top === a.sets[0].top && a.paste.top === a.sets[0].top && a.copy.left > a.sets[2].right && a.paste.left >= a.copy.right && (!a.head || a.paste.right <= a.head.left + 1),
      'the card has Copy and Paste at the end of the sets\' line, on that one line, clear of the pouches', `sets ${J(a.sets)} · copy ${J(a.copy)} · paste ${J(a.paste)} · pouches ${J(a.head)}`);
    check(!!a.paste && a.paste.off && !a.copy.on && a.marks.length === 0, 'nothing copied yet: Paste is dim, Copy is not lit, nobody on the roster is marked', `paste off ${a.paste?.off} · copy on ${a.copy?.on} · marks ${J(a.marks)}`);
    check(/C copy/.test(a.legend) && /V paste/.test(a.legend), 'the key line names the two keys', a.legend);
    // copy Red One by the key, from the roster's row
    await P.pick(1); const w0 = (await P.read()).writes; await P.key('KeyC'); const b = await P.read(); await P.shot('paste-1-copied');
    check(!!b.copy && b.copy.on && b.paste.off && J(b.marks) === '[1]' && b.glyphs === 1 && b.writes === w0 && J(b.kit.map(kitOf)) === J(a.kit.map(kitOf)),
      'C on Red One: Copy is lit and Paste dim on his card (he wears it), his chip is marked, and no card or store is written', `copy on ${b.copy?.on} · marks ${J(b.marks)} · writes +${b.writes - w0}`);
    // paste onto Blue Two by the key
    await P.pick(4); const c0 = await P.read(); await P.key('KeyV'); const c = await P.read(); await P.shot('paste-2-pasted');
    check(!!c0.copy && !c0.copy.on && !c0.paste.off, 'on Blue Two\'s card, before: Copy is not lit and Paste is live', `copy on ${c0.copy?.on} · paste off ${c0.paste?.off}`);
    check(J(kitOf(c.kit[4])) === J(kitOf(c.kit[1])) && c.kit[4].big === 'hammer' && c.kit[4].bangs === 2 && c.writes - c0.writes === 1,
      'V on Blue Two: the store holds Red One\'s kit on him, the hammer in his big slot, in ONE write', `Blue Two ${J(kitOf(c.kit[4]))} · writes +${c.writes - c0.writes}`);
    check(J([...c.flash].sort()) === J(['bangs', 'big', 'charges', 'frags']) && J(c.marks) === '[1,4]' && c.copy.on && c.paste.off && c.member === 4 && c.sel === c0.sel,
      'the four tiles that moved flash, his chip is marked beside Red One\'s, Copy is lit and Paste dim, and the highlight is where it was', `flash ${c.flash.join(' ')} · marks ${J(c.marks)} · highlighted tile ${c0.sel} → ${c.sel}`);
    await P.key('KeyV'); const c2 = await P.read();
    check(c2.writes === c.writes && J(c2.kit) === J(c.kit), 'V again: nothing to change, nothing written', `writes +${c2.writes - c.writes}`);
    // paste onto you by the button
    await P.pick(0); await P.page.click('#missions.one #loadout .kc-clip[data-clip="paste"]', { timeout: 3000 }).catch(() => { /* no button (the break) */ }); await P.page.waitForTimeout(120); const d = await P.read(); await P.shot('paste-3-you');
    check(d.kit[0].bangs === 2 && d.kit[0].charges === 1 && d.kit[0].frags === 1 && d.kit[0].big === 'hammer' && d.kit[0].shells === 0 && d.kit[0].smoke === 0 && d.writes - c2.writes === 1 && J(d.marks) === '[0,1,4]',
      'the Paste button on your card: his kit is yours (your launcher round and smoke go: his card has none), one write, three men marked', `you ${J(kitOf(d.kit[0]))} · writes +${d.writes - c2.writes} · marks ${J(d.marks)}`);
    // the card that says shield, by Ctrl+C / Ctrl+V onto you. The shield is out of the page since 10-15 (shield.ts SHIELD.on): where it is, a stored card
    // that says shield reads as a card without one, an empty big slot, and that is what a paste hands over. Where the build still has it, see the next page.
    await P.pick(3); await P.key('Control+KeyC'); const e0 = await P.read(); await P.pick(0); await P.key('Control+KeyV'); const e = await P.read(); await P.shot('paste-4-shield');
    const shieldIn = /shield/.test(e0.big);   // (what his card's Big slot tile reads on this build's page)
    check(J(e0.marks) === '[3]' && e.kit[0].charges === 2 && !e.kit[0].shield && e.kit[0].big === (shieldIn ? 'hammer' : 'none') && e.kit[0].bangs === 0 && e.writes - e0.writes === 1 && J(e.marks) === '[0,3]',
      shieldIn ? 'Ctrl+C on the shield man, Ctrl+V on you: his two door charges, no shield (it is no tile of yours: your big slot keeps its hammer); you are marked as wearing it'
        : 'Ctrl+C on the man whose stored card says shield, Ctrl+V on you (the shield is out of the page): his two door charges and the empty big slot his card shows; no shield is written; you are marked as wearing it',
      `his Big slot tile reads '${e0.big}' · marks after copy ${J(e0.marks)} · you ${J(kitOf(e.kit[0]))} · writes +${e.writes - e0.writes} · marks ${J(e.marks)}`);
    await P.ctx.close(); }
  { const P = await open(browser, BREAK ? '&nokitcopy' : '');   // the Cmd key of a Mac, and a board whose letters are not where QWERTY's are (events made by hand: no such board here)
    const down = init => P.page.evaluate(i => { (document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...i })); }, init).then(() => P.page.waitForTimeout(120));
    // Cmd+C, Cmd+V: macOS sends no keyup for a letter let go under Cmd, so none is sent here — and the plain keys must still be live after
    await P.pick(1); await down({ key: 'c', code: 'KeyC', metaKey: true }); const a = await P.read();
    await P.pick(4); await down({ key: 'v', code: 'KeyV', metaKey: true }); const b = await P.read();
    await P.pick(2); await down({ key: 'c', code: 'KeyC' }); const c = await P.read();
    check(J(a.marks) === '[1]' && J(kitOf(b.kit[4])) === J(kitOf(b.kit[1])) && b.kit[4].big === 'hammer' && b.writes - a.writes === 1 && J(c.marks) === '[2]',
      'Cmd+C on Red One, Cmd+V on Blue Two, no keyup for either letter: copied, pasted in one write; and a plain C after them still copies (Red Two)', `marks ${J(a.marks)} → ${J(b.marks)} → ${J(c.marks)} · Blue Two ${J(kitOf(b.kit[4]))} · writes +${b.writes - a.writes}`);
    // a Dvorak board: C and V go by the LETTER on the key (c is where QWERTY has I, v where it has the full stop; QWERTY's C key types j)
    await P.pick(1); await down({ key: 'j', code: 'KeyC' }); const d = await P.read();
    await down({ key: 'c', code: 'KeyI' }); const e = await P.read();
    await P.pick(3); await down({ key: 'v', code: 'Period' }); const f = await P.read();
    check(J(d.marks) === '[2]' && J(e.marks) === '[1,4]' && J(kitOf(f.kit[3])) === J(kitOf(f.kit[1])) && f.writes - e.writes === 1 && J(f.marks) === '[1,3,4]',
      'a Dvorak board: the key that types j (QWERTY\'s C) copies nothing; the keys that type c and v copy Red One and paste him onto Blue One', `marks after j ${J(d.marks)} · after c ${J(e.marks)} · after v ${J(f.marks)} · Blue One ${J(kitOf(f.kit[3]))} · writes +${f.writes - e.writes}`);
    await P.ctx.close(); }
  { const P = await open(browser, `&shield${BREAK ? '&nokitcopy' : ''}`);   // (?shield: the shield back for the visit — and no flag at all to a build from before it left)
    await P.pick(1); await P.key('KeyC'); await P.pick(0); await P.key('KeyV'); const a = await P.read();
    await P.pick(3); const b0 = await P.read(); await P.key('Control+KeyC'); await P.pick(0); const b1 = await P.read(); await P.key('Control+KeyV'); const b = await P.read(); await P.shot('paste-5-shield-in');
    check(/shield/.test(b0.big) && a.kit[0].big === 'hammer' && b.kit[0].charges === 2 && !b.kit[0].shield && b.kit[0].big === 'hammer' && b.kit[0].bangs === 0 && b.writes - b1.writes === 1 && J(b.marks) === '[0,3]' && J(b.kit[3]) === J(b1.kit[3]),
      '?shield, the shield man onto you: his two door charges, no shield (it is no tile of yours: your big slot keeps the hammer it had); his own card is not written; you are marked as wearing it',
      `his Big slot tile reads '${b0.big}' · you before ${J(kitOf(a.kit[0]))} · you ${J(kitOf(b.kit[0]))} · writes +${b.writes - b1.writes} · marks ${J(b.marks)}`);
    await P.ctx.close(); }
  { const P = await open(browser, '&nokitcopy');
    const a = await P.read(); await P.pick(1); await P.key('KeyC'); await P.pick(4); await P.key('KeyV'); const b = await P.read();
    check(!a.copy && !a.paste && a.sets.length === 3 && a.sets3 === 3 && b.writes === a.writes && b.marks.length === 0 && J(b.kit) === J(a.kit) && !/copy/.test(a.legend),
      '?nokitcopy: no Copy, no Paste, the three sets as they were; C and V write nothing and mark nobody; the key line as it was', `buttons ${a.copy ? 'there' : 'none'} · writes +${b.writes - a.writes} · marks ${J(b.marks)} · ${a.legend}`);
    await P.ctx.close(); }
  { const P = await open(browser, '', 'hall-four');   // (its level file issues its own kit: the cards go once the file has come)
    await P.page.waitForFunction(() => !document.querySelector('#missions.one #loadout .kc'), null, { timeout: 20000 }).catch(() => {}); await P.page.waitForTimeout(200);
    const a = await P.read(), cards = await P.page.evaluate(() => document.querySelectorAll('#missions.one #loadout .kc').length);
    check(cards === 0 && !a.copy && !/copy/.test(a.legend) && a.legend.length > 0, 'a mission that issues its own kit (the long hall): no cards, so no Copy or Paste, and the key line does not name them', `cards ${cards} · ${a.legend}`);
    await P.ctx.close(); }
  await browser.close();
  check(errors.length === 0, 'no page error', errors.join(' | ') || 'none');
  console.log(fails ? `\n=== kitpaste-page: ${fails} FAILED ===` : '\n=== kitpaste-page: ALL PASS ===');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
